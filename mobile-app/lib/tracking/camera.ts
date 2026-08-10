/**
 * CareLink — tracking camera policy.
 * ────────────────────────────────────────────────────────────────────────────
 * Decides where the camera should be. Pure logic: given the current state and
 * the world, it returns the camera command to issue, or null for "leave it
 * alone". No MapLibre, no React — so the behaviour that is hardest to judge by
 * eye is testable headlessly.
 *
 * THREE RULES, ALL LEARNED FROM WHAT USERS HATE
 *
 * 1. NEVER FIGHT THE FINGER. The instant a gesture is detected the camera stops
 *    following and stays stopped. The current implementation is the opposite —
 *    `follow={!!nurse}` re-issues a 700ms flyTo on every position update, so
 *    the pro's map yanks itself back roughly every two seconds while they are
 *    trying to look at the next junction.
 *
 * 2. MOVE ONLY WHEN IT MATTERS. Recentring on every frame is the "shaking" in
 *    the original complaint. The camera holds still while the marker is inside
 *    a generous dead zone and only eases when it approaches the edge, so the
 *    map drifts occasionally instead of twitching continuously.
 *
 * 3. ZOOM IS QUANTISED. A zoom that varies continuously with speed makes the
 *    world breathe and is deeply unpleasant. Zoom changes only when speed
 *    crosses a band boundary, and the bands overlap (hysteresis) so hovering at
 *    a threshold cannot oscillate.
 */

export type CameraMode = "following" | "user" | "resuming";

export type CameraState = {
  mode: CameraMode;
  /** When the user last touched the map (ms), or null. */
  userTouchedAt: number | null;
  /** Zoom band currently applied. */
  zoom: number;
  /** Last centre the camera was commanded to. */
  center: { lat: number; lng: number } | null;
  /**
   * Map rotation last commanded, degrees. 0 = north-up.
   *
   * Held across commands so rotation can be rate-limited and dead-banded
   * against what is actually on screen, not against the previous sample.
   */
  bearing: number;
};

export type CameraCommand = {
  center: { lat: number; lng: number };
  zoom: number;
  /** Map tilt in degrees. */
  pitch: number;
  /** Map rotation, degrees. 0 = north-up. */
  bearing: number;
  durationMs: number;
  reason: "initial" | "drift" | "zoom-band" | "resume" | "fit" | "rotate";
};

/**
 * Speed bands, in m/s, with the zoom each implies.
 *
 * Deliberately tight: the product owner asked for streets and surroundings to
 * stay readable, and the failure mode of a tracking map is being too far out —
 * a patient wants to see which street the nurse is on, not a regional overview.
 * `enterAbove`/`exitBelow` overlap so a car hovering at a threshold does not
 * flip between bands.
 */
/**
 * Hard floor on zoom.
 *
 * Not a round number chosen for comfort: on the MapTiler style this app uses,
 * building footprints stop rendering below roughly z16 and street labels thin
 * out sharply below z15.5. Going wider trades the exact information the screen
 * exists to convey — WHICH STREET the nurse is on — for a regional overview
 * nobody asked for. A first draft used z15, which spans ~3.2km across a phone
 * and fails that requirement outright; the camera test now asserts this floor.
 */
export const MIN_ZOOM = 16.4;

/**
 * Map tilt during tracking. ZERO.
 *
 * A 38-degree tilt was tried for cinematic depth and made things worse: a
 * ViewAnnotation is positioned in screen space, so under pitch the marker no
 * longer sits convincingly on the ground plane it is supposed to be standing
 * on, and the avatar reads as floating BESIDE the road rather than on it. On a
 * tracking screen, "is he actually on that street?" has to be answerable at a
 * glance, and tilt was trading that away for atmosphere.
 *
 * Flat is not a compromise here — it is what makes the alignment legible.
 * Revisit only with a style that genuinely extrudes buildings, and only after
 * confirming annotations stay glued to the surface under pitch.
 */
export const TRACKING_PITCH = 0;

export type ZoomBand = {
  readonly name: string;
  /** Speed above which this band applies. */
  readonly enterAbove: number;
  /** Speed below which this band is left — overlaps `enterAbove` on purpose. */
  readonly exitBelow: number;
  readonly zoom: number;
};

/**
 * Deliberately CLOSE. An earlier set topped out around z16 and the feedback was
 * immediate: too much of the city, movement looks slow, no immersion. Uber,
 * Bolt and inDrive all stay near enough that individual streets, junctions and
 * buildings are legible, because recognising your own neighbourhood is what
 * makes an approach feel real. Distance travelled per second also reads as
 * faster when the frame is tighter — the same motion simply feels more alive.
 */
export const ZOOM_BANDS: readonly ZoomBand[] = [
  { name: "stationary", enterAbove: -1, exitBelow: -1, zoom: 17.8 },
  { name: "walking", enterAbove: 0.8, exitBelow: 0.5, zoom: 17.6 },
  { name: "urban", enterAbove: 6.0, exitBelow: 4.5, zoom: 17.1 },
  { name: "fast", enterAbove: 18.0, exitBelow: 15.0, zoom: MIN_ZOOM },
] as const;

/**
 * Fraction of the visible map the marker may roam before the camera eases.
 *
 * Measured against the interaction reference, which follows LOOSELY: the
 * vehicle drifts across roughly a third of the frame before the camera responds
 * at all. A tight zone makes the camera appear to chase the marker; a loose one
 * with an unhurried correction reads as the map letting the journey happen and
 * only occasionally catching up. Measured against the VISIBLE map, so the sheet
 * does not shrink the usable frame.
 */
export const DEAD_ZONE = 0.30;
/**
 * Dead zone while NAVIGATING.
 *
 * Tighter than the tracking value. A patient watching someone approach wants
 * the journey to breathe; a driver wants their position where they left it.
 */
export const NAV_DEAD_ZONE = 0.18;
/** Idle time after a gesture before following resumes (ms). */
export const RESUME_AFTER_MS = 6000;
/** Drift correction. Long and soft: the camera should float, never snap. */
const DRIFT_MS = 1200;
const ZOOM_MS = 1100;

// ── Course-up rotation ───────────────────────────────────────────────────────
// STABILITY IS THE REQUIREMENT, not responsiveness. A map that yaws with every
// GPS bearing wobble is worse than one that never rotates: the whole world
// swims, and the driver loses the fixed frame they were using to read it.
//
// Three independent brakes, all of which must release before the map turns:
//
//   1. Only while genuinely moving. A stationary vehicle's course is noise.
//   2. A dead band. Under this, the commanded bearing is simply not changed.
//   3. A rate limit. Above this, the turn is stretched over more time rather
//      than delivered faster.
//
// `sample.bearing` is already smoothed, short-path and rate-limited by the
// motion pipeline, so this brakes an input that is itself well behaved.

/** Below this the vehicle is stopped or crawling; course means nothing. */
export const ROTATE_MIN_SPEED_MPS = 2.5;
/** Bearing changes smaller than this never move the map. */
export const ROTATE_DEADBAND_DEG = 8;
/** Hard ceiling on how fast the world may yaw. */
export const ROTATE_MAX_DEG_S = 45;
/** Floor on a rotation ease, so small corrections still glide. */
const ROTATE_MIN_MS = 450;

/** Signed shortest angular difference from → to, in (-180, 180]. */
function shortestAngleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

const norm360 = (d: number): number => ((d % 360) + 360) % 360;

export type RotationPlan = {
  /** Bearing to command. Equal to the current one when nothing should move. */
  bearing: number;
  /** True when this is a change worth issuing a command for on its own. */
  changed: boolean;
  /** Minimum ease duration that keeps the yaw under the rate limit. */
  minDurationMs: number;
};

/**
 * Decide the map's rotation. Pure, and the single place the brakes live.
 *
 * Returns the CURRENT bearing unchanged whenever any brake is engaged, which is
 * most of the time and is the point.
 */
export function planRotation(
  state: CameraState,
  input: { navigating?: boolean; bearing?: number | null; speedMps: number | null },
): RotationPlan {
  const still: RotationPlan = { bearing: state.bearing, changed: false, minDurationMs: 0 };

  // Not navigating: north-up, always. This is what keeps the patient's camera
  // byte-identical — `navigating` is never set on that screen.
  if (!input.navigating) {
    if (state.bearing === 0) return still;
    const delta = Math.abs(shortestAngleDelta(state.bearing, 0));
    return { bearing: 0, changed: true, minDurationMs: (delta / ROTATE_MAX_DEG_S) * 1000 };
  }

  // Stopped: HOLD the last bearing rather than snapping back to north. A car
  // waiting at a light would otherwise spin the world once on stopping and
  // again on moving off — two large rotations to convey nothing.
  const speed = input.speedMps ?? 0;
  if (speed < ROTATE_MIN_SPEED_MPS) return still;
  if (input.bearing == null) return still;

  const target = norm360(input.bearing);
  const delta = shortestAngleDelta(state.bearing, target);
  if (Math.abs(delta) < ROTATE_DEADBAND_DEG) return still;

  return {
    bearing: target,
    changed: true,
    // Stretch the turn rather than accelerating it: a 90° corner becomes a
    // two-second sweep, which reads as the map following rather than snapping.
    minDurationMs: Math.max(ROTATE_MIN_MS, (Math.abs(delta) / ROTATE_MAX_DEG_S) * 1000),
  };
}

export function initialCameraState(zoom = 16.0): CameraState {
  return { mode: "following", userTouchedAt: null, zoom, center: null, bearing: 0 };
}

/** Zoom for a speed, given the band currently applied (hysteresis). */
export function zoomForSpeed(speedMps: number | null, currentZoom: number): number {
  const speed = speedMps ?? 0;
  let chosen = ZOOM_BANDS[0];
  for (const band of ZOOM_BANDS) {
    if (speed > band.enterAbove) chosen = band;
  }
  // Only leave the current band once speed drops below its exit threshold —
  // otherwise a car oscillating around 6 m/s makes the map pump in and out.
  const current = ZOOM_BANDS.find((b) => b.zoom === currentZoom);
  if (current && chosen.zoom > current.zoom && speed > current.exitBelow) {
    return current.zoom;
  }
  return chosen.zoom;
}

/**
 * Approximate metres covered by the viewport's shorter side at a given zoom.
 * Web-mercator ground resolution; good enough to size a dead zone.
 */
export function viewportSpanM(zoom: number, pixels: number, lat: number): number {
  const metresPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  return metresPerPixel * pixels;
}

export type CameraInputs = {
  now: number;
  /** Where the marker is. */
  target: { lat: number; lng: number };
  /** Marker speed in m/s, for the zoom band. */
  speedMps: number | null;
  /** Shorter viewport dimension in pixels. */
  viewportPx: number;
  /** Pixels hidden behind the sheet — excluded from the usable frame. */
  obscuredPx?: number;
  /** Metres between the last commanded centre and the marker. */
  distanceFromCenterM: number;
  /**
   * Turn-by-turn framing: course-up, tighter dead zone, closer zoom.
   *
   * Off by default, and the patient's screen never sets it — so every path
   * below behaves exactly as it did before Phase 2 when this is absent.
   */
  navigating?: boolean;
  /** Marker heading in degrees, for course-up. Ignored unless navigating. */
  bearing?: number | null;
  /** Extra zoom while a maneuver is imminent. Ignored unless navigating. */
  zoomBoost?: number;
};

/**
 * Decide the next camera command.
 *
 * Returns null when the camera should be left exactly where it is — which is
 * most of the time, and is the single most important thing this function does.
 */
export function nextCameraCommand(
  state: CameraState,
  input: CameraInputs,
): { state: CameraState; command: CameraCommand | null } {
  // A gesture suspends following, full stop. No command is issued while the
  // user is in control, however far the marker drifts.
  if (state.mode === "user") {
    const idleFor = state.userTouchedAt == null ? 0 : input.now - state.userTouchedAt;
    if (idleFor < RESUME_AFTER_MS) return { state, command: null };
    // Idle long enough — glide back, slowly, so it reads as the app helping
    // rather than snatching the map away.
    const zoom = zoomForSpeed(input.speedMps, state.zoom);
    const rot = planRotation(state, input);
    return {
      state: { ...state, mode: "following", userTouchedAt: null, zoom, center: input.target, bearing: rot.bearing },
      command: {
        center: input.target,
        zoom,
        pitch: TRACKING_PITCH,
        bearing: rot.bearing,
        durationMs: Math.max(1800, rot.minDurationMs),
        reason: "resume",
      },
    };
  }

  const zoom = zoomForSpeed(input.speedMps, state.zoom) + (input.navigating ? (input.zoomBoost ?? 0) : 0);
  const rot = planRotation(state, input);

  // First frame: frame the subject.
  if (!state.center) {
    return {
      state: { ...state, zoom, center: input.target, bearing: rot.bearing },
      command: {
        center: input.target,
        zoom,
        pitch: TRACKING_PITCH,
        bearing: rot.bearing,
        durationMs: 0,
        reason: "initial",
      },
    };
  }

  // A zoom band change is worth a camera move on its own, and recentres too.
  if (zoom !== state.zoom) {
    return {
      state: { ...state, zoom, center: input.target, bearing: rot.bearing },
      command: {
        center: input.target,
        zoom,
        pitch: TRACKING_PITCH,
        bearing: rot.bearing,
        durationMs: Math.max(ZOOM_MS, rot.minDurationMs),
        reason: "zoom-band",
      },
    };
  }

  // Dead zone: hold still until the marker approaches the edge of the
  // comfortable middle of the screen. Navigation uses a tighter one — a driver
  // wants their position where they left it.
  const usablePx = Math.max(120, input.viewportPx - (input.obscuredPx ?? 0));
  const zoneFraction = input.navigating ? NAV_DEAD_ZONE : DEAD_ZONE;
  const allowedM = (viewportSpanM(zoom, usablePx, input.target.lat) * zoneFraction) / 2;
  if (input.distanceFromCenterM < allowedM) {
    // A TURN still has to move the map even when the marker has not left the
    // dead zone — which is exactly what happens rounding a corner. Without
    // this the world stays locked through the one moment rotation matters.
    if (rot.changed) {
      return {
        state: { ...state, bearing: rot.bearing },
        command: {
          center: state.center,
          zoom,
          pitch: TRACKING_PITCH,
          bearing: rot.bearing,
          durationMs: rot.minDurationMs,
          reason: "rotate",
        },
      };
    }
    return { state, command: null };
  }

  // Far outside the frame — the subject is not merely drifting, they are
  // off-screen. Easing over more than a second means staring at empty map
  // hunting for the marker, which is exactly what happens at the start of a
  // trip when the professional begins a kilometre away. Snap, then resume
  // normal easing.
  const lost = input.distanceFromCenterM > allowedM * 3;
  return {
    state: { ...state, center: input.target, bearing: rot.bearing },
    command: {
      center: input.target,
      zoom,
      pitch: TRACKING_PITCH,
      bearing: rot.bearing,
      // A recovery snap must not be slowed down by a pending rotation, but an
      // ordinary drift correction should still respect the yaw rate limit.
      durationMs: lost ? 0 : Math.max(DRIFT_MS, rot.minDurationMs),
      reason: lost ? "initial" : "drift",
    },
  };
}

/** Record a user gesture. Called from the map's region-change handler. */
export function withUserGesture(state: CameraState, now: number): CameraState {
  return { ...state, mode: "user", userTouchedAt: now };
}

/** Explicit "recentre" tap — cancels user control immediately. */
export function withRecenterRequest(state: CameraState): CameraState {
  return { ...state, mode: "following", userTouchedAt: null, center: null };
}
