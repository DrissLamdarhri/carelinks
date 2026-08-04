/**
 * CareLink — motion pipeline for live tracking.
 * ────────────────────────────────────────────────────────────────────────────
 * Turns a sparse, noisy, out-of-order stream of GPS fixes into a continuous
 * position that can be rendered every frame.
 *
 * Deliberately pure: no React, no MapLibre, no timers, no I/O. `push()` accepts
 * fixes, `sampleAt(now)` returns where the marker should be drawn. That makes
 * the whole thing replayable against recorded traces (tunnel, noisy, parked,
 * motorway) in a test harness — smoothness regressions are invisible to code
 * review and to the naked eye, so they have to be asserted.
 *
 * FIVE STAGES
 *
 *  1. FILTER   — drop fixes that are physically implausible or too imprecise
 *                to be worth rendering. Bad data smoothed beautifully is still
 *                bad data.
 *
 *  2. BUFFER   — hold a short window and render the recent PAST, not the
 *                present. This is the single decision that makes motion look
 *                alive. Animating toward the newest fix means always chasing an
 *                unknown future: the marker arrives, stalls, then lurches when
 *                the next packet lands. Rendering at `now - RENDER_DELAY_MS`
 *                means we interpolate BETWEEN TWO KNOWN POINTS, which is
 *                constant-velocity and reads as continuous. Google Maps and
 *                Uber both pay this latency; ~2s is invisible when watching
 *                someone drive to you.
 *
 *  3. EXTRAPOLATE — when no newer fix has arrived (tunnel, dropped packet),
 *                continue along the last known heading and speed for a few
 *                seconds, then hold. Freezing instantly reads as "the app
 *                broke"; extrapolating forever reads as a lie.
 *
 *  4. SHAPE    — the path between fixes is a CURVE, not a chord. Straight-line
 *                interpolation made the marker travel a polygon and jerk at
 *                every fix (measured: p99 2.400°, max 4.42° per frame — the
 *                "hesitant" quality next to Google Maps). Where a trusted route
 *                exists the position is map-matched and interpolated ALONG THE
 *                ROAD, so it cannot drift across buildings; otherwise a
 *                centripetal Catmull-Rom curve through the fixes is used. The
 *                two are blended by a confidence that eases in and out, so
 *                leaving and rejoining a road is continuous rather than a jump.
 *
 *  5. BEARING  — taken from the tangent of the curve actually being travelled,
 *                rotated along the SHORTEST angular path and rate-limited, so
 *                350°→10° sweeps +20° instead of spinning -340°.
 *
 * Positions here are for RENDERING. Business logic (ETA, distance, arrival,
 * re-routing) must keep using the raw fix — smoothed values feeding decisions
 * is how you get an ETA that oscillates.
 */

import { Route, bearingDeg, distanceM, splinePoint, type LatLng, type RouteMatch } from "./route";

// Re-exported so callers keep a single import site for tracking geometry.
export { bearingDeg, distanceM, Route, splinePoint, type LatLng };

export type Fix = {
  lat: number;
  lng: number;
  /** GPS course over ground (deg), null when stationary or unavailable. */
  heading: number | null;
  /** m/s, null when unknown. */
  speed: number | null;
  /** Reported horizontal accuracy in metres, null when unknown. */
  accuracy: number | null;
  /** Monotonic per-session counter from the sender. */
  seq: number;
  /**
   * LOCAL receipt time (ms). Deliberately not the sender's timestamp: two
   * phones' clocks disagree by seconds, and a skewed clock would place fixes
   * in the wrong order or in the future. Ordering is ours to decide.
   */
  receivedAt: number;
};

export type MotionSample = {
  lat: number;
  lng: number;
  /** Smoothed bearing in degrees, 0 = north. */
  bearing: number;
  /** True while the subject is actually moving (not a parked phone jittering). */
  moving: boolean;
  /** True once we are extrapolating or holding rather than interpolating. */
  stale: boolean;
  /** Age of the newest accepted fix, ms — drives the "position is old" UI. */
  ageMs: number;
};

/** Render this far behind real time so interpolation always has an endpoint. */
export const RENDER_DELAY_MS = 2000;
/** Fixes worse than this are noise; rendering them makes the marker twitch. */
const MAX_ACCURACY_M = 50;
/** ~200 km/h. Anything faster is a GPS glitch, not a car. */
const MAX_SPEED_MPS = 55;
/** Continue along the last vector this long before admitting we've lost them. */
export const DEAD_RECKON_MS = 5000;
/** Below this, `heading` from the GPS is noise and the phone may be stationary. */
const MOVING_SPEED_MPS = 0.4;
/** Cap on how fast the rendered arrow may rotate (deg/sec). */
const MAX_TURN_RATE_DEG_S = 180;
/** Enough history to interpolate through a stall; older fixes are dead weight. */
const MAX_BUFFER = 40;

const EARTH_R = 6371000;

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Signed shortest angular difference from → to, in (-180, 180]. */
export function shortestAngleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Move `from` toward `to` by at most `maxStep` degrees, the short way round. */
function approachAngle(from: number, to: number, maxStep: number): number {
  const delta = shortestAngleDelta(from, to);
  const step = Math.max(-maxStep, Math.min(maxStep, delta));
  return (((from + step) % 360) + 360) % 360;
}

/** Project `from` `metres` along `bearing` — used for dead reckoning. */
function project(
  from: { lat: number; lng: number },
  bearing: number,
  metres: number,
): { lat: number; lng: number } {
  const δ = metres / EARTH_R;
  const θ = toRad(bearing);
  const φ1 = toRad(from.lat);
  const λ1 = toRad(from.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: (φ2 * 180) / Math.PI, lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180 };
}

// ── Curved interpolation ────────────────────────────────────────────────────
// Straight-line interpolation between fixes draws chords across a curving road:
// the marker travels a polygon and turns in a discrete jerk at every fix.
// Measured on this pipeline before the change: p50 of 0.000 deg/frame (dead
// straight) punctuated by kinks up to 4.42 deg, one per fix. That is what reads
// as "hesitant" next to Google Maps.
//
// CENTRIPETAL Catmull-Rom (alpha = 0.5), not uniform. GPS fixes are unevenly
// spaced in both time and distance, and uniform Catmull-Rom forms cusps and
// self-intersecting loops on uneven spacing — visibly worse than the straight
// lines it replaces. The centripetal parameterisation is provably free of both.

// ── Map-matching confidence ─────────────────────────────────────────────────
// Snapping must never be a hard on/off switch. Route position and free position
// differ by the lateral deviation, so flipping between them between adjacent
// segments teleports the marker by up to MAX_SNAP_M. Measured with a two-point
// straight-line fallback route, where fixes near the endpoints matched and those
// mid-curve did not: an 89.9 deg direction change and an apparent 1253 m/s.
// A pro taking a side street would reproduce it.
//
// Instead the two positions are BLENDED by a confidence that eases in and out,
// so leaving and rejoining a road is continuous.

/** At or below this deviation, trust the road completely. */
const SNAP_FULL_M = 12;
/** Beyond this, ignore the road: they are genuinely somewhere else. */
const MAX_SNAP_M = 25;
/** Confidence units per second — 2.0 gives a ~0.5s crossfade. */
const SNAP_RATE_PER_S = 2;
/** How far ahead of the last match to scan — bounds per-fix matching cost. */
const MATCH_WINDOW_M = 500;

export type RejectReason = "stale-seq" | "inaccurate" | "teleport";

/**
 * One tracked subject (the nurse, or the patient when they've opted in).
 * Feed it fixes; ask it where to draw.
 */
export class MotionTrack {
  private buffer: Fix[] = [];
  /** Map-match for each buffered fix; null when it could not be matched. */
  private matches: (RouteMatch | null)[] = [];
  /** Eased 0..1 confidence that the marker is on the road. */
  private renderSnap = 0;
  private route: Route | null = null;
  private lastMatchedOffsetM = 0;
  private lastSeq = -1;
  /** Rendered bearing, carried across samples so rotation can be rate-limited. */
  private renderBearing: number | null = null;
  private lastSampleAt: number | null = null;
  /** Counters for diagnostics — a spike in rejects is a signal worth seeing. */
  readonly rejected: Record<RejectReason, number> = {
    "stale-seq": 0,
    inaccurate: 0,
    teleport: 0,
  };

  /** True once at least one fix has been accepted. */
  get hasData(): boolean {
    return this.buffer.length > 0;
  }

  /** The newest accepted fix — this is what business logic should read. */
  get latest(): Fix | null {
    return this.buffer.length ? this.buffer[this.buffer.length - 1] : null;
  }

  /**
   * Lateral distance of the newest fix from the attached route, or null when it
   * could not be matched at all.
   *
   * Callers use this to decide whether a RE-ROUTE is warranted. The question
   * "should we fetch a new road?" is about being laterally OFF the road, never
   * about how far along it we have travelled.
   */
  get routeDeviationM(): number | null {
    return this.matches.length ? (this.matches[this.matches.length - 1]?.deviationM ?? null) : null;
  }

  /**
   * Offer a fix. Returns null if accepted, or why it was rejected.
   * Rejection is normal and frequent; it is not an error.
   */
  push(fix: Fix): RejectReason | null {
    // Out of order or replayed. Realtime gives no ordering guarantee, and a
    // packet that overtook another must never drag the marker backwards.
    if (fix.seq <= this.lastSeq) {
      this.rejected["stale-seq"]++;
      return "stale-seq";
    }

    // Too imprecise to be worth drawing. A 200 m fix rendered smoothly is a
    // confident lie about where someone is.
    if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY_M) {
      this.rejected.inaccurate++;
      return "inaccurate";
    }

    // Physically impossible jump — a cold-start fix or a multipath glitch.
    const prev = this.latest;
    if (prev) {
      const dt = (fix.receivedAt - prev.receivedAt) / 1000;
      if (dt > 0 && distanceM(prev, fix) / dt > MAX_SPEED_MPS) {
        this.rejected.teleport++;
        return "teleport";
      }
    }

    this.lastSeq = fix.seq;
    this.buffer.push(fix);
    this.matches.push(this.matchToRoute(fix));
    if (this.buffer.length > MAX_BUFFER) {
      this.buffer.shift();
      this.matches.shift();
    }
    return null;
  }

  /**
   * Attach (or clear) the road the subject is following.
   *
   * With a route attached the marker is map-matched and interpolated ALONG the
   * road rather than through open space, so it cannot drift across buildings
   * and its heading comes from the street. Pass null when no route is drawn —
   * before departure, after arrival, or when routing failed — and the pipeline
   * falls back to the spline.
   */
  setRoute(points: LatLng[] | null): void {
    this.route = points && points.length >= 2 ? new Route(points) : null;
    this.lastMatchedOffsetM = 0;
    // Re-match everything already buffered so a route arriving mid-trip takes
    // effect immediately instead of only for future fixes.
    this.matches = this.buffer.map((f) => this.matchToRoute(f));
  }

  /** True while positions are being map-matched to a road. */
  get onRoute(): boolean {
    return this.route != null && this.routeTrusted;
  }

  /**
   * Is this route actually describing the journey being travelled?
   *
   * Snapping asserts "the subject is on this road". When most recent fixes fail
   * to match, that assertion is false and snapping to it produces nonsense —
   * measured with a two-point straight-line fallback route, where fixes near the
   * endpoints matched while those mid-curve did not: matching flickered on and
   * off and the marker jumped 7m in a single frame (an apparent 424 m/s).
   *
   * Requiring a majority of the recent window to match encodes the claim
   * directly, and degrades to pure free-space interpolation when a route is
   * merely a rough hint (a straight-line routing fallback) rather than a road.
   */
  private get routeTrusted(): boolean {
    if (!this.route) return false;
    const window = this.matches.slice(-8);
    if (window.length < 3) return false;
    let matched = 0;
    for (const m of window) if (m) matched++;
    return matched / window.length >= 0.6;
  }

  /**
   * Match a fix to a distance along the route, or null when it should not be
   * snapped.
   *
   * Matching is forward-only from the last accepted match: roads double back on
   * themselves at hairpins, roundabouts and parallel return legs, and a global
   * nearest-point search will happily snap a noisy fix to an earlier segment and
   * drag the marker backwards. That is the exact defect that made the traversed
   * route un-draw itself in the previous implementation.
   *
   * A fix further than MAX_SNAP_M from the road is left unmatched: the subject
   * is genuinely off-route (a side street, a car park, a footpath), and drawing
   * them on the road anyway would be a confident lie.
   */
  private matchToRoute(fix: Fix): RouteMatch | null {
    if (!this.route) return null;
    const m = this.route.match(fix, this.lastMatchedOffsetM, MATCH_WINDOW_M);
    if (!m || m.deviationM > MAX_SNAP_M) return null;
    this.lastMatchedOffsetM = m.offsetM;
    return m;
  }

  /** Discard all state — call when the tracked subject changes. */
  reset(): void {
    this.buffer = [];
    this.matches = [];
    this.lastSeq = -1;
    this.renderBearing = null;
    this.lastSampleAt = null;
    this.lastMatchedOffsetM = 0;
    this.renderSnap = 0;
  }

  /**
   * Where to draw, at wall-clock `now` (ms). Returns null until the first fix.
   * Safe to call every frame; it is O(buffer) and allocation-light.
   */
  sampleAt(now: number): MotionSample | null {
    const newest = this.latest;
    if (!newest) return null;

    const dtSec = this.lastSampleAt == null ? 0 : Math.max(0, (now - this.lastSampleAt) / 1000);
    this.lastSampleAt = now;

    const t = now - RENDER_DELAY_MS;
    const ageMs = now - newest.receivedAt;

    let pos: { lat: number; lng: number };
    let targetBearing: number;
    let moving: boolean;
    let stale: boolean;

    const oldest = this.buffer[0];
    if (t <= oldest.receivedAt) {
      // Still inside the initial delay — sit on the first known point rather
      // than inventing motion we have no evidence for.
      pos = { lat: oldest.lat, lng: oldest.lng };
      targetBearing = oldest.heading ?? this.renderBearing ?? 0;
      moving = false;
      stale = false;
    } else if (t >= newest.receivedAt) {
      // No fix newer than the render clock: extrapolate briefly, then hold.
      const overshoot = t - newest.receivedAt;
      const speed = newest.speed ?? 0;
      const canReckon = overshoot <= DEAD_RECKON_MS && speed > MOVING_SPEED_MPS;
      const heading = newest.heading ?? this.renderBearing ?? 0;
      pos = canReckon
        ? project(newest, heading, speed * (overshoot / 1000))
        : { lat: newest.lat, lng: newest.lng };
      targetBearing = heading;
      moving = canReckon;
      // "Stale" the moment we stop having real data to interpolate through —
      // the UI can start warning before the marker visibly freezes.
      stale = overshoot > DEAD_RECKON_MS;
    } else {
      // The good case: interpolate between two known fixes at constant velocity.
      let i = this.buffer.length - 2;
      while (i > 0 && this.buffer[i].receivedAt > t) i--;
      const a = this.buffer[i];
      const b = this.buffer[i + 1];
      const span = b.receivedAt - a.receivedAt;
      const f = span > 0 ? (t - a.receivedAt) / span : 1;

      const segment = distanceM(a, b);
      moving = span > 0 && segment / (span / 1000) > MOVING_SPEED_MPS;
      stale = false;

      const mA = this.matches[i];
      const mB = this.matches[i + 1];

      // The free-space path is ALWAYS computed. It is the fallback the blend
      // eases back to, so it must exist even while fully snapped.
      const freePos = splinePoint(this.buffer[i - 1] ?? null, a, b, this.buffer[i + 2] ?? null, f);
      const freeBearing = this.curveBearing(i, f, a, b, moving);

      let roadPos: LatLng | null = null;
      let roadBearing: number | null = null;
      let targetSnap = 0;

      if (mA && mB && this.route && this.routeTrusted) {
        // Interpolate a scalar DISTANCE ALONG THE ROAD rather than a coordinate
        // pair. The marker is then always exactly on the polyline and advances
        // at a constant rate — the reason a navigation app's vehicle never clips
        // a corner: its position simply cannot leave the street.
        const offset = mA.offsetM + (mB.offsetM - mA.offsetM) * f;
        const at = this.route.positionAt(offset);
        if (at) {
          roadPos = at.point;
          // Road direction averaged over a short window. A single polyline
          // segment's bearing steps at every vertex, which on a dense route is a
          // flicker of small jumps rather than a sweep.
          roadBearing = this.route.smoothBearingAt(offset);
          const deviation = mA.deviationM + (mB.deviationM - mA.deviationM) * f;
          targetSnap =
            deviation <= SNAP_FULL_M
              ? 1
              : Math.max(0, 1 - (deviation - SNAP_FULL_M) / (MAX_SNAP_M - SNAP_FULL_M));
        }
      }

      // Ease toward the target confidence instead of jumping to it.
      const maxSnapStep = SNAP_RATE_PER_S * dtSec;
      this.renderSnap =
        this.renderSnap < targetSnap
          ? Math.min(targetSnap, this.renderSnap + maxSnapStep)
          : Math.max(targetSnap, this.renderSnap - maxSnapStep);

      const w = roadPos ? this.renderSnap : 0;
      pos =
        w <= 0 || !roadPos
          ? freePos
          : {
              lat: freePos.lat + (roadPos.lat - freePos.lat) * w,
              lng: freePos.lng + (roadPos.lng - freePos.lng) * w,
            };
      targetBearing =
        w <= 0 || roadBearing == null
          ? freeBearing
          : (((freeBearing + shortestAngleDelta(freeBearing, roadBearing) * w) % 360) + 360) % 360;
    }

    // Rotate the short way, rate-limited, so turns sweep instead of snapping.
    this.renderBearing =
      this.renderBearing == null
        ? targetBearing
        : approachAngle(this.renderBearing, targetBearing, MAX_TURN_RATE_DEG_S * dtSec);

    return { lat: pos.lat, lng: pos.lng, bearing: this.renderBearing, moving, stale, ageMs };
  }

  /**
   * Heading from the TANGENT OF THE CURVE the marker is actually travelling,
   * sampled either side of the current point.
   *
   * The previous implementation took the chord bearing a→b, which is constant
   * across a whole segment and then steps at the fix boundary — the rotational
   * half of the same polygon problem. Reading the tangent of the curve instead
   * gives a heading that varies continuously through a bend.
   *
   * The device's own GPS course is deliberately NOT preferred here: it is
   * quantised, noisy at low speed, and unrelated to the path being drawn, so
   * trusting it makes the icon point somewhere the marker is not going.
   */
  private curveBearing(i: number, f: number, a: Fix, b: Fix, moving: boolean): number {
    if (!moving) return this.renderBearing ?? a.heading ?? bearingDeg(a, b);
    const prev = this.buffer[i - 1] ?? null;
    const next = this.buffer[i + 2] ?? null;
    const eps = 0.02;
    const s0 = Math.max(0, f - eps);
    const s1 = Math.min(1, f + eps);
    if (s1 <= s0) return bearingDeg(a, b);
    const p0 = splinePoint(prev, a, b, next, s0);
    const p1 = splinePoint(prev, a, b, next, s1);
    // Degenerate sample (stationary within the epsilon) — keep what we had.
    if (distanceM(p0, p1) < 0.001) return this.renderBearing ?? bearingDeg(a, b);
    return bearingDeg(p0, p1);
  }
}
