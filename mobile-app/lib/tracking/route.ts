/**
 * CareLink — route geometry for map-matched motion.
 * ────────────────────────────────────────────────────────────────────────────
 * Pure polyline maths. No React, no map, no I/O — so it is fully testable
 * headlessly, like the rest of the tracking pipeline.
 *
 * WHY THIS EXISTS
 *
 * Interpolating between GPS fixes in lat/lng space draws straight chords across
 * a curving road, so the marker travels a polygon and changes direction in a
 * discrete jerk at every fix. Measured on our own pipeline: p50 of 0.000° per
 * frame (perfectly straight) punctuated by kinks of up to 4.42°, one per fix.
 * That is precisely the "hesitant" quality the product owner noticed.
 *
 * Navigation apps solve it by not interpolating in lat/lng at all. They
 * map-match each fix to a position ALONG the route, interpolate that scalar
 * offset, and convert back to a coordinate by walking the polyline. The marker
 * is then always exactly on the road, moves at constant speed, and takes its
 * heading from the road's own direction — which is what makes Google Maps and
 * Uber look confident: the car is on the street because it cannot be anywhere
 * else, not because the smoothing happened to land there.
 *
 * A route polyline from OSRM has vertices every few metres, so its residual
 * "kinks" are two orders of magnitude smaller than the 1.5-second GPS chords
 * they replace.
 */

export type LatLng = { lat: number; lng: number };

const EARTH_R = 6371000;
const DEG = Math.PI / 180;

/** Metres between two coordinates (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}

/** Initial bearing a → b in degrees, normalised to [0, 360). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin((b.lng - a.lng) * DEG) * Math.cos(b.lat * DEG);
  const x =
    Math.cos(a.lat * DEG) * Math.sin(b.lat * DEG) -
    Math.sin(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos((b.lng - a.lng) * DEG);
  return ((Math.atan2(y, x) / DEG) + 360) % 360;
}

const CR_ALPHA = 0.5;

type Vec2 = { x: number; y: number };

/**
 * A local planar frame. Over the span of one segment the curvature of the Earth
 * is irrelevant, and projecting to metres turns the geometry into ordinary 2-D
 * vector algebra instead of spherical trigonometry — both faster per frame and
 * far easier to verify.
 */
function toLocal(origin: LatLng, p: LatLng): Vec2 {
  return {
    x: (p.lng - origin.lng) * DEG * EARTH_R * Math.cos(origin.lat * DEG),
    y: (p.lat - origin.lat) * DEG * EARTH_R,
  };
}

function fromLocal(origin: LatLng, v: Vec2): LatLng {
  return {
    lat: origin.lat + v.y / (DEG * EARTH_R),
    lng: origin.lng + v.x / (DEG * EARTH_R * Math.cos(origin.lat * DEG)),
  };
}

function knot(t: number, a: Vec2, b: Vec2): number {
  return t + Math.pow(Math.hypot(b.x - a.x, b.y - a.y), CR_ALPHA);
}

function lerpV(a: Vec2, b: Vec2, w: number): Vec2 {
  return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
}

/**
 * Centripetal Catmull-Rom through p1→p2, shaped by neighbours p0 and p3.
 * `s` is 0..1 across the p1→p2 span.
 */
function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, s: number): Vec2 {
  const t0 = 0;
  const t1 = knot(t0, p0, p1);
  const t2 = knot(t1, p1, p2);
  const t3 = knot(t2, p2, p3);
  // Degenerate spacing (duplicate points) — fall back to a straight line rather
  // than dividing by zero.
  if (t1 === t0 || t2 === t1 || t3 === t2) return lerpV(p1, p2, s);

  const t = t1 + s * (t2 - t1);
  const a1 = lerpV(p0, p1, (t - t0) / (t1 - t0));
  const a2 = lerpV(p1, p2, (t - t1) / (t2 - t1));
  const a3 = lerpV(p2, p3, (t - t2) / (t3 - t2));
  const b1 = lerpV(a1, a2, (t - t0) / (t2 - t0));
  const b2 = lerpV(a2, a3, (t - t1) / (t3 - t1));
  return lerpV(b1, b2, (t - t1) / (t2 - t1));
}

/** Curve point between two fixes, using neighbours for curvature. */
export function splinePoint(
  prev: LatLng | null,
  a: LatLng,
  b: LatLng,
  next: LatLng | null,
  s: number,
): LatLng {
  const origin = a;
  const p1 = toLocal(origin, a);
  const p2 = toLocal(origin, b);
  // Missing neighbours are mirrored outward, which is the neutral assumption:
  // continue straight. When the real neighbour later arrives the curve is
  // refined, and the resulting mid-segment correction is bounded by ~0.15x the
  // change in tangent — of the order of centimetres for real road curvature,
  // i.e. far below one screen pixel. Asserted in motion.replay.ts.
  const p0 = prev ? toLocal(origin, prev) : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
  const p3 = next ? toLocal(origin, next) : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
  return fromLocal(origin, catmullRom(p0, p1, p2, p3, s));
}

export type RouteMatch = {
  /** Distance along the route, in metres from the start. */
  offsetM: number;
  /** Perpendicular distance from the point to the route, in metres. */
  deviationM: number;
  /** Index of the polyline segment the match landed on. */
  segment: number;
};

/**
 * A route polyline pre-processed for repeated queries.
 *
 * Cumulative distances are computed once at construction, so `positionAt` and
 * `match` are cheap enough to call every animation frame.
 */
export class Route {
  readonly points: LatLng[];
  /** cumulative[i] = distance in metres from the start to points[i]. */
  private readonly cumulative: number[];
  private cachedRenderPath: LatLng[] | null = null;

  constructor(points: LatLng[]) {
    // Consecutive duplicates produce zero-length segments, which are a division
    // by zero waiting to happen in the projection below.
    const cleaned: LatLng[] = [];
    for (const p of points) {
      const last = cleaned[cleaned.length - 1];
      if (!last || distanceM(last, p) > 0.01) cleaned.push(p);
    }
    this.points = cleaned;

    this.cumulative = new Array(cleaned.length);
    this.cumulative[0] = 0;
    for (let i = 1; i < cleaned.length; i++) {
      this.cumulative[i] = this.cumulative[i - 1] + distanceM(cleaned[i - 1], cleaned[i]);
    }
  }

  get length(): number {
    return this.points.length ? this.cumulative[this.cumulative.length - 1] : 0;
  }

  get usable(): boolean {
    return this.points.length >= 2 && this.length > 0;
  }

  /**
   * The route as it must be DRAWN, sampled along the same smoothed curve that
   * `positionAt` walks.
   *
   * This exists because of a visible defect: `positionAt` curves through the
   * vertices, but the map was drawing the raw polyline — straight chords between
   * those same vertices. The marker therefore travelled a smoothed path while
   * the line rendered as a polygon, and on bends the two separated by a metre or
   * two. Zoomed out that is sub-pixel; zoomed in it is a gap between the avatar
   * and the road, and it destroys the illusion that the professional is on the
   * street.
   *
   * Drawing THIS instead makes the agreement exact by construction: the line and
   * the marker are literally the same points. Cached, since a route changes only
   * when it is refetched.
   */
  renderPath(stepM = 4): LatLng[] {
    if (this.cachedRenderPath) return this.cachedRenderPath;
    if (!this.usable) return this.points;
    const out: LatLng[] = [];
    const total = this.length;
    const n = Math.max(2, Math.ceil(total / stepM));
    for (let i = 0; i <= n; i++) {
      const at = this.positionAt((i / n) * total);
      if (at) out.push(at.point);
    }
    this.cachedRenderPath = out;
    return out;
  }

  /**
   * Map-match a point onto the route.
   *
   * `searchFrom` restricts the scan to segments at or after a given offset,
   * which is what keeps matching MONOTONIC: a road that doubles back near
   * itself (a hairpin, a roundabout, a parallel return leg) will otherwise
   * match an earlier segment on a noisy fix and drag the marker backwards. That
   * exact failure — a global nearest-point search — is what made the traversed
   * route un-draw itself in the previous implementation.
   */
  match(p: LatLng, searchFromM = 0, windowM = Number.POSITIVE_INFINITY): RouteMatch | null {
    if (!this.usable) return null;

    let best: RouteMatch | null = null;
    for (let i = 0; i < this.points.length - 1; i++) {
      const segEnd = this.cumulative[i + 1];
      if (segEnd < searchFromM) continue;
      if (this.cumulative[i] > searchFromM + windowM) break;

      const a = this.points[i];
      const b = this.points[i + 1];
      const origin = a;
      const bv = toLocal(origin, b);
      const pv = toLocal(origin, p);
      const segLenSq = bv.x * bv.x + bv.y * bv.y;
      if (segLenSq === 0) continue;

      // Projection parameter, clamped to the segment.
      let t = (pv.x * bv.x + pv.y * bv.y) / segLenSq;
      t = t < 0 ? 0 : t > 1 ? 1 : t;

      const projX = bv.x * t;
      const projY = bv.y * t;
      const deviationM = Math.hypot(pv.x - projX, pv.y - projY);
      const offsetM = this.cumulative[i] + Math.sqrt(segLenSq) * t;

      if (offsetM < searchFromM) continue;
      if (!best || deviationM < best.deviationM) {
        best = { offsetM, deviationM, segment: i };
      }
    }
    return best;
  }

  /** Coordinate and road direction at a distance along the route. */
  positionAt(offsetM: number): { point: LatLng; bearing: number; segment: number } | null {
    if (!this.usable) return null;
    const clamped = Math.max(0, Math.min(this.length, offsetM));

    // Binary search the cumulative table — called every frame, so O(log n).
    let lo = 0;
    let hi = this.points.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.cumulative[mid] <= clamped) lo = mid;
      else hi = mid;
    }

    const a = this.points[lo];
    const b = this.points[lo + 1] ?? a;
    const segLen = this.cumulative[lo + 1] - this.cumulative[lo];
    const t = segLen > 0 ? (clamped - this.cumulative[lo]) / segLen : 0;

    // Curve through the surrounding vertices instead of walking the segment in
    // a straight line. A dense OSRM polyline barely changes (its segments are
    // short and nearly collinear), but a COARSE route — a two-point straight-line
    // fallback, or a simplified overview — would otherwise hand back its own
    // corners and reintroduce exactly the per-vertex jerk that map-matching was
    // adopted to remove. Measured: snapping to a 21m-per-segment polyline
    // reproduced the original 4.42 deg kinks precisely.
    //
    // Real roads do have genuine corners, and this rounds them slightly. That is
    // the correct trade: a vehicle rounds a corner too, and an instantaneous
    // pivot looks far more artificial than a metre of easing.
    return {
      point: splinePoint(this.points[lo - 1] ?? null, a, b, this.points[lo + 2] ?? null, t),
      bearing: bearingDeg(a, b),
      segment: lo,
    };
  }

  /**
   * Road direction at an offset, averaged over a window.
   *
   * Taking the bearing of a single polyline segment makes heading step at every
   * vertex — on a dense OSRM route that is a rapid flicker of small jumps.
   * Sampling slightly ahead and behind yields a continuous tangent, which is
   * what makes a turn read as a sweep rather than a series of clicks.
   */
  smoothBearingAt(offsetM: number, windowM = 12): number | null {
    if (!this.usable) return null;
    const back = this.positionAt(Math.max(0, offsetM - windowM));
    const fwd = this.positionAt(Math.min(this.length, offsetM + windowM));
    if (!back || !fwd) return null;
    if (distanceM(back.point, fwd.point) < 0.1) return fwd.bearing;
    return bearingDeg(back.point, fwd.point);
  }
}
