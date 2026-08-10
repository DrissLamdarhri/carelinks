/**
 * CareLink — tracking benchmark framework: shared contracts.
 * ────────────────────────────────────────────────────────────────────────────
 * This is a PERMANENT engineering tool, not a one-off script for choosing a
 * renderer. Every future change to the tracking stack — a new interpolation
 * strategy, a MapLibre upgrade, an RN upgrade — should be run through it and
 * compared against a stored baseline, because rendering regressions are
 * invisible in code review and unreliable to judge by eye.
 *
 * The contracts here exist so that two candidate renderers can be measured
 * under conditions that are IDENTICAL by construction: same fixes, same
 * arrival timings, same camera movements, same duration. A comparison where the
 * inputs differ is not evidence, and a benchmark that is merely plausible is
 * worse than none — it launders a preference into a number.
 */
import type { Fix, MotionSample } from "../motion";
import type { TrackingStore } from "../store";

// ── Traces ──────────────────────────────────────────────────────────────────

/**
 * A recorded or synthetic tracking session. `offsetMs` is the delay from the
 * start of the run at which the fix is delivered to the store, so replays are
 * reproducible regardless of how fast the device happens to be.
 */
export type TraceFix = Omit<Fix, "receivedAt"> & { offsetMs: number };

export type Trace = {
  id: string;
  label: string;
  /** Where this came from — synthetic generator, or a real recorded session. */
  source: "synthetic" | "recorded";
  /** Total wall time the replay should occupy. */
  durationMs: number;
  fixes: TraceFix[];
  /** Free-form provenance: device, city, date, road type… */
  notes?: string;
};

// ── Camera choreography ─────────────────────────────────────────────────────

/**
 * Camera movements are scripted rather than performed by hand. "Performance
 * while interacting with the map" is only comparable between renderers if the
 * interaction is byte-identical, which a human finger cannot deliver.
 */
export type CameraCommand =
  | { atMs: number; kind: "zoom"; to: number; durationMs: number }
  | { atMs: number; kind: "pan"; dLat: number; dLng: number; durationMs: number }
  | { atMs: number; kind: "rotate"; to: number; durationMs: number }
  | { atMs: number; kind: "pitch"; to: number; durationMs: number };

export type Scenario = {
  id: string;
  label: string;
  trace: Trace;
  camera: CameraCommand[];
  /** What this scenario is designed to expose. */
  rationale: string;
};

// ── Renderer under test ─────────────────────────────────────────────────────

/** Imperative camera surface every candidate renderer must expose. */
export type BenchCamera = {
  zoomTo(zoom: number, durationMs: number): void;
  panBy(dLat: number, dLng: number, durationMs: number): void;
  rotateTo(bearing: number, durationMs: number): void;
  pitchTo(pitch: number, durationMs: number): void;
};

export type BenchRendererHandle = {
  camera: BenchCamera;
  /** Total marker repositions performed — the renderer's real work rate. */
  markerUpdates(): number;
  /** Total camera mutations applied. */
  cameraUpdates(): number;
};

/**
 * Props every candidate renderer accepts. The renderer subscribes to the store
 * itself — how it does so (React state, useSyncExternalStore, Reanimated
 * shared value, imperative native call) is exactly what we are measuring.
 */
export type BenchRendererProps = {
  store: TrackingStore;
  /** Initial camera centre so both candidates start framed identically. */
  center: { lat: number; lng: number };
};

export type RendererCandidate = {
  id: string;
  label: string;
  /** One-line summary of the approach, printed in the report. */
  approach: string;
};

// ── Results ─────────────────────────────────────────────────────────────────

export type FrameMetrics = {
  /** Frames observed during the measured window. */
  frames: number;
  durationMs: number;
  fpsAverage: number;
  /** Frame-interval percentiles in ms. Lower is better; consistency matters
   *  more than the average, which is why p95/p99 are reported. */
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  worstMs: number;
  /** Frames slower than one 60Hz budget (16.7ms) and than two (33.4ms). */
  over16_7: number;
  over33_4: number;
  /**
   * Estimated frames the device failed to present, derived from how many 60Hz
   * budgets each interval overran. This is an ESTIMATE from JS-side timing, not
   * a report from the compositor — see docs/tracking-benchmark.md.
   */
  droppedEstimate: number;
};

export type StallMetrics = {
  /** Samples taken by the JS-thread lateness probe. */
  samples: number;
  /** Worst observed lateness of a fixed-interval timer, in ms. */
  worstMs: number;
  /** Probe wake-ups later than 100ms — a blocked JS thread. */
  over100: number;
  meanMs: number;
};

export type MemoryMetrics = {
  /** JS heap in bytes at start/end, when the runtime exposes it. Hermes
   *  generally does not, in which case these are null and the report says so
   *  rather than inventing a figure. */
  startBytes: number | null;
  endBytes: number | null;
  peakBytes: number | null;
  available: boolean;
};

export type StoreMetrics = {
  accepted: number;
  rejectedStaleSeq: number;
  rejectedInaccurate: number;
  rejectedTeleport: number;
  /** Frames the store emitted to subscribers, and those it suppressed as
   *  sub-threshold. A high suppression ratio is GOOD: work avoided. */
  emitted: number;
  suppressed: number;
  ticks: number;
};

export type BenchResult = {
  candidateId: string;
  candidateLabel: string;
  approach: string;
  scenarioId: string;
  scenarioLabel: string;
  startedAt: string;
  frames: FrameMetrics;
  stalls: StallMetrics;
  memory: MemoryMetrics;
  store: StoreMetrics;
  markerUpdates: number;
  cameraUpdates: number;
  /** Device/runtime provenance — a number is meaningless without it. */
  environment: {
    os: string;
    osVersion: string | number;
    /** Reported hardware, when the platform exposes it. */
    brand: string | null;
    model: string | null;
    /**
     * Heuristic, from the model string — deliberately NOT authoritative. We do
     * not pull in expo-device (another native module, another rebuild) purely
     * to populate a diagnostic field, so this is a hint the reader should
     * sanity-check, not a fact the report relies on.
     */
    emulatorHint: boolean;
    hermes: boolean;
    /** __DEV__ builds are substantially slower; comparisons across this
     *  boundary are invalid and the report flags it. */
    dev: boolean;
  };
};

export type BenchSuite = {
  ranAt: string;
  results: BenchResult[];
};

export type { Fix, MotionSample, TrackingStore };
