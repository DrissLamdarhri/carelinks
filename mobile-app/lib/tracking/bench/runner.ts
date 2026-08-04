/**
 * CareLink — benchmark runner.
 *
 * Drives one candidate renderer through one scenario and returns a BenchResult.
 *
 * The guarantee this file exists to provide is that every candidate sees
 * IDENTICAL conditions: the same fixes, delivered at the same offsets from the
 * start of the run, with the same camera movements at the same moments. Fix
 * delivery is scheduled against elapsed time rather than a fixed timer, so a
 * device that stutters still receives the whole trace at the right offsets
 * instead of silently replaying a shorter session.
 *
 * A short warm-up runs before measurement so JIT, shader compilation and the
 * first texture upload are not attributed to the renderer under test.
 */
import { Platform } from "react-native";
import { TrackingStore } from "../store";
import { FrameCollector, MemorySampler, StallProbe } from "./metrics";
import type {
  BenchCamera,
  BenchRendererHandle,
  BenchResult,
  CameraCommand,
  RendererCandidate,
  Scenario,
} from "./types";

/** Discarded before measurement begins — first-frame costs are not the renderer's. */
const WARMUP_MS = 1500;

export type RunHooks = {
  /** Progress 0..1, for the benchmark UI. */
  onProgress?: (fraction: number) => void;
  onPhase?: (phase: "warmup" | "measuring" | "done") => void;
};

function applyCamera(camera: BenchCamera, cmd: CameraCommand): void {
  switch (cmd.kind) {
    case "zoom":
      camera.zoomTo(cmd.to, cmd.durationMs);
      break;
    case "pan":
      camera.panBy(cmd.dLat, cmd.dLng, cmd.durationMs);
      break;
    case "rotate":
      camera.rotateTo(cmd.to, cmd.durationMs);
      break;
    case "pitch":
      camera.pitchTo(cmd.to, cmd.durationMs);
      break;
  }
}

function environment(): BenchResult["environment"] {
  const hermes = typeof (globalThis as { HermesInternal?: unknown }).HermesInternal !== "undefined";
  const consts = (Platform.constants ?? {}) as { Brand?: string; Model?: string };
  const brand = consts.Brand ?? null;
  const model = consts.Model ?? null;
  // Heuristic only. Cheaper than adding expo-device as a native dependency for
  // a field that exists to help a human read the report.
  const emulatorHint = /sdk|emulator|simulator|generic/i.test(`${brand ?? ""} ${model ?? ""}`);
  return { os: Platform.OS, osVersion: Platform.Version, brand, model, emulatorHint, hermes, dev: __DEV__ };
}

/**
 * Run one candidate against one scenario.
 *
 * `store` must be freshly constructed and already subscribed to by the
 * renderer; the runner does not mount anything itself, because how a renderer
 * subscribes and re-renders is exactly the property under measurement.
 */
export async function runScenario(
  candidate: RendererCandidate,
  scenario: Scenario,
  store: TrackingStore,
  handle: BenchRendererHandle,
  hooks: RunHooks = {},
): Promise<BenchResult> {
  const frames = new FrameCollector();
  const stalls = new StallProbe(50);
  const memory = new MemorySampler();

  const markerAtStart = handle.markerUpdates();
  const cameraAtStart = handle.cameraUpdates();

  const t0 = Date.now();
  let raf: number | null = null;
  let measuring = false;

  hooks.onPhase?.("warmup");

  // The trace is delivered on elapsed-time offsets rather than a chain of
  // setTimeouts, so a stuttering device cannot quietly compress the session.
  let nextFixIdx = 0;
  let nextCameraIdx = 0;
  const camera = [...scenario.camera].sort((a, b) => a.atMs - b.atMs);
  const totalMs = WARMUP_MS + scenario.trace.durationMs;

  await new Promise<void>((resolve) => {
    const tick = () => {
      const now = Date.now();
      const elapsed = now - t0;

      if (!measuring && elapsed >= WARMUP_MS) {
        // Discard everything accumulated so far: the warm-up is not a result.
        measuring = true;
        frames.start(now);
        stalls.start();
        memory.begin();
        hooks.onPhase?.("measuring");
      }

      const traceElapsed = elapsed - WARMUP_MS;

      // Deliver every fix whose offset has passed. Catching up in a single
      // frame is correct: the alternative is dropping data on a slow device,
      // which would make the slower renderer look like it had less to do.
      while (
        nextFixIdx < scenario.trace.fixes.length &&
        scenario.trace.fixes[nextFixIdx].offsetMs <= traceElapsed
      ) {
        const f = scenario.trace.fixes[nextFixIdx++];
        store.push({
          lat: f.lat, lng: f.lng, heading: f.heading, speed: f.speed,
          accuracy: f.accuracy, seq: f.seq, receivedAt: now,
        });
      }

      while (nextCameraIdx < camera.length && camera[nextCameraIdx].atMs <= traceElapsed) {
        applyCamera(handle.camera, camera[nextCameraIdx++]);
      }

      if (measuring) {
        frames.frame(now);
        if (frames.sampleCount % 30 === 0) memory.sample();
      }

      hooks.onProgress?.(Math.min(1, elapsed / totalMs));

      if (elapsed >= totalMs) {
        frames.stop(now);
        stalls.stop();
        memory.finish();
        if (raf !== null) cancelAnimationFrame(raf);
        resolve();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });

  hooks.onPhase?.("done");

  const rejected = store.rejectionCounts();
  return {
    candidateId: candidate.id,
    candidateLabel: candidate.label,
    approach: candidate.approach,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    startedAt: new Date(t0).toISOString(),
    frames: frames.result(),
    stalls: stalls.result(),
    memory: memory.result(),
    store: {
      accepted: nextFixIdx - (rejected["stale-seq"] + rejected.inaccurate + rejected.teleport),
      rejectedStaleSeq: rejected["stale-seq"],
      rejectedInaccurate: rejected.inaccurate,
      rejectedTeleport: rejected.teleport,
      emitted: store.stats.emitted,
      suppressed: store.stats.suppressed,
      ticks: store.stats.ticks,
    },
    markerUpdates: handle.markerUpdates() - markerAtStart,
    cameraUpdates: handle.cameraUpdates() - cameraAtStart,
    environment: environment(),
  };
}
