/**
 * CareLink — benchmark traces.
 *
 * A trace is a reproducible tracking session: a list of fixes with the exact
 * offset at which each is delivered. Synthetic traces are generated from a
 * SEEDED pseudo-random source, so "the noisy urban trace" is the same sequence
 * of bytes on every run, on every device, forever. An unseeded benchmark
 * compares two renderers against two different inputs and calls the difference
 * a result.
 *
 * Recorded traces use the same shape, so a real session captured from a nurse's
 * phone can be dropped in later and replayed identically — see `toTrace`.
 */
import type { Trace, TraceFix } from "./types";

/**
 * Deterministic PRNG (mulberry32). Seeded so every replay is byte-identical.
 * Math.random() would silently make each run a different experiment.
 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const METRES_PER_DEG_LAT = 111_320;

type SynthOptions = {
  id: string;
  label: string;
  rationale?: string;
  /** Metres per second along the path. */
  speedMps: number;
  /** Gap between fixes in ms — the real cadence of the GPS stream. */
  intervalMs: number;
  durationMs: number;
  /** Standard deviation of positional noise, in metres. */
  jitterM?: number;
  /** Reported accuracy attached to each fix. */
  accuracyM?: number;
  /** Degrees of heading change per second (a curve, roundabout, or turn). */
  turnRateDegS?: number;
  /** Windows where the signal drops entirely, as [startMs, endMs]. */
  outages?: [number, number][];
  /** Injected garbage: fraction of fixes given implausible values. */
  glitchRate?: number;
  seed?: number;
  start?: { lat: number; lng: number };
};

/** Build a synthetic trace. Pure and deterministic given the same options. */
export function synthesise(opts: SynthOptions): Trace {
  const {
    id, label, speedMps, intervalMs, durationMs,
    jitterM = 0, accuracyM = 8, turnRateDegS = 0,
    outages = [], glitchRate = 0, seed = 1, start = { lat: 34.037, lng: -5.004 },
  } = opts;

  const rnd = seeded(seed);
  const fixes: TraceFix[] = [];
  let lat = start.lat;
  let lng = start.lng;
  let bearing = 45;
  let seq = 0;

  for (let t = 0; t <= durationMs; t += intervalMs) {
    const dt = intervalMs / 1000;
    bearing = (bearing + turnRateDegS * dt + 360) % 360;

    const step = speedMps * dt;
    const rad = (bearing * Math.PI) / 180;
    lat += (step * Math.cos(rad)) / METRES_PER_DEG_LAT;
    lng += (step * Math.sin(rad)) / (METRES_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));

    if (outages.some(([from, to]) => t >= from && t <= to)) continue;

    const jitterDeg = jitterM / METRES_PER_DEG_LAT;
    let fLat = lat + (rnd() - 0.5) * 2 * jitterDeg;
    let fLng = lng + (rnd() - 0.5) * 2 * jitterDeg;
    let accuracy = accuracyM;

    // Garbage the filter is supposed to reject. Included deliberately: a
    // renderer's behaviour under bad input is part of what we are comparing.
    if (glitchRate > 0 && rnd() < glitchRate) {
      if (rnd() < 0.5) accuracy = 250; // wildly imprecise
      else fLat += 0.5; // ~55km teleport
    }

    fixes.push({
      lat: fLat,
      lng: fLng,
      heading: bearing,
      speed: speedMps,
      accuracy,
      seq: ++seq,
      offsetMs: t,
    });
  }

  return {
    id,
    label,
    source: "synthetic",
    durationMs,
    fixes,
    notes: opts.rationale,
  };
}

/**
 * Convert a captured real-world session into a replayable trace.
 * Offsets are normalised to the first sample so the replay starts at zero.
 */
export function toTrace(
  meta: { id: string; label: string; notes?: string },
  samples: { lat: number; lng: number; heading: number | null; speed: number | null; accuracy: number | null; seq: number; receivedAt: number }[],
): Trace {
  if (samples.length === 0) {
    return { ...meta, source: "recorded", durationMs: 0, fixes: [] };
  }
  const t0 = samples[0].receivedAt;
  const fixes: TraceFix[] = samples.map((s) => ({
    lat: s.lat, lng: s.lng, heading: s.heading, speed: s.speed,
    accuracy: s.accuracy, seq: s.seq, offsetMs: s.receivedAt - t0,
  }));
  return {
    ...meta,
    source: "recorded",
    durationMs: fixes[fixes.length - 1].offsetMs,
    fixes,
  };
}

// ── The standard suite ──────────────────────────────────────────────────────
// Chosen to cover the conditions that actually break tracking in Morocco, not
// the conditions that flatter a benchmark. Each is 60s so a full comparison run
// is ~4 minutes per renderer — long enough for thermal effects to appear.

const MINUTE = 60_000;

/** Dense city driving: frequent fixes, moderate noise, constant gentle turning. */
export const URBAN_DRIVE = synthesise({
  id: "urban-drive",
  label: "Urban drive (50 km/h, 1.5s fixes, 8m noise)",
  rationale: "The common case. Establishes the baseline frame budget.",
  speedMps: 14, intervalMs: 1500, durationMs: MINUTE,
  jitterM: 8, turnRateDegS: 3, seed: 11,
});

/** Walking pace with heavy multipath — the medina, tall buildings, courtyards. */
export const DENSE_URBAN_WALK = synthesise({
  id: "dense-walk",
  label: "Walking, heavy multipath (5 km/h, 25m noise, 10% glitches)",
  rationale:
    "Old-town streets: poor sky view, reflected signal. Exercises the filter " +
    "hard and is where a naive renderer visibly twitches.",
  speedMps: 1.4, intervalMs: 2000, durationMs: MINUTE,
  jitterM: 25, accuracyM: 22, turnRateDegS: 8, glitchRate: 0.1, seed: 23,
});

/** Fast, straight, sparse — motorway between towns. */
export const HIGHWAY = synthesise({
  id: "highway",
  label: "Highway (110 km/h, 3s fixes, low noise)",
  rationale:
    "Large distance per fix, so interpolation carries the most weight and any " +
    "stutter is maximally visible.",
  speedMps: 30, intervalMs: 3000, durationMs: MINUTE,
  jitterM: 5, turnRateDegS: 0.5, seed: 37,
});

/** Two tunnels and a long dropout. */
export const SIGNAL_LOSS = synthesise({
  id: "signal-loss",
  label: "Tunnels and dropouts (two outages, one 20s)",
  rationale:
    "Dead reckoning, staleness, and recovery. A renderer that teleports on " +
    "reacquisition fails here even if its frame times look perfect.",
  speedMps: 16, intervalMs: 1500, durationMs: MINUTE,
  jitterM: 10, turnRateDegS: 2, seed: 41,
  outages: [[12_000, 20_000], [35_000, 55_000]],
});

/** Stationary: the nurse is parked, or waiting at the door. */
export const STATIONARY = synthesise({
  id: "stationary",
  label: "Stationary (parked, GPS wobble only)",
  rationale:
    "Should cost almost nothing. Measures whether the pipeline correctly does " +
    "no work, which over a whole trip is the dominant battery term.",
  speedMps: 0, intervalMs: 2000, durationMs: MINUTE,
  jitterM: 4, seed: 53,
});

export const STANDARD_TRACES: Trace[] = [
  URBAN_DRIVE,
  DENSE_URBAN_WALK,
  HIGHWAY,
  SIGNAL_LOSS,
  STATIONARY,
];

export function traceById(id: string): Trace | undefined {
  return STANDARD_TRACES.find((t) => t.id === id);
}
