/**
 * CareLink — benchmark scenarios: a trace plus a camera choreography.
 *
 * Camera work is scripted because "performance while interacting with the map"
 * is only comparable if the interaction is identical, and no human can swipe
 * the same way twice. Every candidate therefore receives exactly the same
 * zooms, pans, rotations and pitches at exactly the same offsets.
 *
 * The camera script is deliberately hostile in `interaction-stress`: real users
 * fidget with the map precisely when they are anxious about where their nurse
 * is, which is the worst possible moment for the renderer to stutter.
 */
import {
  DENSE_URBAN_WALK,
  HIGHWAY,
  SIGNAL_LOSS,
  STATIONARY,
  URBAN_DRIVE,
} from "./traces";
import type { CameraCommand, Scenario } from "./types";

/** Camera left alone — isolates pure marker/interpolation cost. */
const STILL: CameraCommand[] = [];

/** What a calm user does: an occasional zoom to check the street. */
const CASUAL: CameraCommand[] = [
  { atMs: 10_000, kind: "zoom", to: 16.5, durationMs: 600 },
  { atMs: 25_000, kind: "zoom", to: 14, durationMs: 600 },
  { atMs: 40_000, kind: "pan", dLat: 0.002, dLng: 0.002, durationMs: 500 },
  { atMs: 50_000, kind: "zoom", to: 15.5, durationMs: 600 },
];

/** Continuous fiddling, overlapping animations, all four gesture types. */
const STRESS: CameraCommand[] = (() => {
  const out: CameraCommand[] = [];
  for (let t = 3000; t < 58_000; t += 2500) {
    const phase = (t / 2500) % 4;
    if (phase === 0) out.push({ atMs: t, kind: "zoom", to: 13 + ((t / 5000) % 4), durationMs: 700 });
    else if (phase === 1) out.push({ atMs: t, kind: "pan", dLat: 0.0015, dLng: -0.001, durationMs: 500 });
    else if (phase === 2) out.push({ atMs: t, kind: "rotate", to: (t / 200) % 360, durationMs: 700 });
    else out.push({ atMs: t, kind: "pitch", to: t % 5000 < 2500 ? 50 : 0, durationMs: 600 });
  }
  return out;
})();

export const SCENARIOS: Scenario[] = [
  {
    id: "urban-still",
    label: "Urban drive, camera still",
    trace: URBAN_DRIVE,
    camera: STILL,
    rationale:
      "Baseline. Isolates the cost of marker interpolation with nothing else " +
      "competing for the frame.",
  },
  {
    id: "urban-casual",
    label: "Urban drive, casual map use",
    trace: URBAN_DRIVE,
    camera: CASUAL,
    rationale: "The realistic common case: tracking plus occasional zooming.",
  },
  {
    id: "walk-multipath",
    label: "Walking, heavy multipath",
    trace: DENSE_URBAN_WALK,
    camera: CASUAL,
    rationale:
      "Worst GPS quality. Exercises the filter hard; a renderer that draws " +
      "every raw fix visibly twitches here.",
  },
  {
    id: "highway",
    label: "Highway, sparse fixes",
    trace: HIGHWAY,
    camera: CASUAL,
    rationale:
      "Longest distance per fix, so interpolation carries the most weight and " +
      "any stutter is maximally visible.",
  },
  {
    id: "signal-loss",
    label: "Tunnels and dropouts",
    trace: SIGNAL_LOSS,
    camera: CASUAL,
    rationale:
      "Dead reckoning and recovery. Watch for a teleport on reacquisition — " +
      "frame times can look perfect while the marker jumps.",
  },
  {
    id: "stationary",
    label: "Stationary (idle cost)",
    trace: STATIONARY,
    camera: STILL,
    rationale:
      "Should cost almost nothing. Over a whole trip, idle cost dominates " +
      "battery — a renderer that keeps working here loses on power even if it " +
      "wins on peak FPS.",
  },
  {
    id: "interaction-stress",
    label: "Interaction stress (continuous gestures)",
    trace: URBAN_DRIVE,
    camera: STRESS,
    rationale:
      "Overlapping zoom/pan/rotate/pitch throughout. Users fidget with the map " +
      "exactly when they are anxious about where their nurse is, which is the " +
      "worst moment to stutter.",
  },
];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
