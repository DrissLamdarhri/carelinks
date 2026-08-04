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
 * FOUR STAGES
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
 *  4. BEARING  — rotate along the SHORTEST angular path and rate-limit the
 *                turn, so 350°→10° sweeps +20° instead of spinning -340°.
 *
 * Positions here are for RENDERING. Business logic (ETA, distance, arrival,
 * re-routing) must keep using the raw fix — smoothed values feeding decisions
 * is how you get an ETA that oscillates.
 */

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
const DEAD_RECKON_MS = 5000;
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

/** Metres between two coordinates (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}

/** Initial bearing a → b, degrees, normalised to [0, 360). */
export function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
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

export type RejectReason = "stale-seq" | "inaccurate" | "teleport";

/**
 * One tracked subject (the nurse, or the patient when they've opted in).
 * Feed it fixes; ask it where to draw.
 */
export class MotionTrack {
  private buffer: Fix[] = [];
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
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
    return null;
  }

  /** Discard all state — call when the tracked subject changes. */
  reset(): void {
    this.buffer = [];
    this.lastSeq = -1;
    this.renderBearing = null;
    this.lastSampleAt = null;
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
      pos = { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };

      const segment = distanceM(a, b);
      moving = span > 0 && segment / (span / 1000) > MOVING_SPEED_MPS;
      // Prefer the device's own course while genuinely moving; fall back to the
      // segment's geometry. A stationary phone's `heading` is noise.
      targetBearing = moving
        ? (b.heading ?? bearingDeg(a, b))
        : (this.renderBearing ?? b.heading ?? bearingDeg(a, b));
      stale = false;
    }

    // Rotate the short way, rate-limited, so turns sweep instead of snapping.
    this.renderBearing =
      this.renderBearing == null
        ? targetBearing
        : approachAngle(this.renderBearing, targetBearing, MAX_TURN_RATE_DEG_S * dtSec);

    return { lat: pos.lat, lng: pos.lng, bearing: this.renderBearing, moving, stale, ageMs };
  }
}
