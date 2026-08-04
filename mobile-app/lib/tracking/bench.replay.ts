/**
 * CareLink — headless tests for the benchmark framework itself.
 *
 *   pnpm -C mobile-app test:tracking
 *
 * A measuring instrument that is wrong is worse than no instrument: it produces
 * confident numbers that get quoted in decisions for years. Percentiles,
 * dropped-frame arithmetic and trace determinism are all easy to get subtly
 * wrong, so they are asserted here rather than trusted.
 *
 * Only the PURE parts are covered — the runner needs React Native and is
 * exercised on-device.
 */
import { FrameCollector, MemorySampler, StallProbe, percentile } from "./bench/metrics";
import { synthesise, STANDARD_TRACES, toTrace } from "./bench/traces";
import { SCENARIOS } from "./bench/scenarios";
import { compareToBaseline, formatSuite } from "./bench/report";
import type { BenchResult, BenchSuite } from "./bench/types";

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) {
    console.log(`  FAIL: ${msg}`);
    failures++;
  }
}

// ── 1. Percentiles ──────────────────────────────────────────────────────────
{
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  console.log(`1. percentile: p50=${percentile(v, 50)} p95=${percentile(v, 95)} p99=${percentile(v, 99)}`);
  ok(percentile(v, 50) === 5, "p50 wrong");
  ok(percentile(v, 100) === 10, "p100 should be the max");
  ok(percentile([], 95) === 0, "empty sample should be 0, not NaN");
  ok(percentile([42], 95) === 42, "single sample should be itself");
}

// ── 2. Frame maths: a known interval pattern ────────────────────────────────
// 10 clean 16ms frames, then one 50ms hitch (~2 frames missed).
{
  const fc = new FrameCollector();
  let t = 0;
  fc.start(t);
  for (let i = 0; i < 10; i++) {
    t += 16;
    fc.frame(t);
  }
  t += 50;
  fc.frame(t);
  fc.stop(t);
  const r = fc.result();
  console.log(
    `2. frames: n=${r.frames} avg=${r.fpsAverage.toFixed(1)}fps p50=${r.p50Ms} worst=${r.worstMs} ` +
      `>16.7=${r.over16_7} >33.4=${r.over33_4} dropped=${r.droppedEstimate}`,
  );
  // First frame establishes the baseline and yields no interval.
  ok(r.frames === 10, `expected 10 intervals from 11 frames, got ${r.frames}`);
  ok(r.p50Ms === 16, "p50 should be the clean 16ms interval");
  ok(r.worstMs === 50, "worst interval should be the 50ms hitch");
  ok(r.over16_7 === 1 && r.over33_4 === 1, "the hitch should count in both over-budget buckets");
  ok(r.droppedEstimate === 2, `50ms interval should imply 2 dropped frames, got ${r.droppedEstimate}`);
}

// ── 3. An empty collector must not produce NaN ──────────────────────────────
{
  const r = new FrameCollector().result();
  const finite = Object.values(r).every((v) => Number.isFinite(v));
  console.log(`3. empty collector: all finite=${finite}`);
  ok(finite, "empty FrameCollector produced NaN/Infinity — would poison a report");
}

// ── 4. Traces are deterministic ─────────────────────────────────────────────
// Two renderers must be fed byte-identical input or the comparison is void.
{
  const a = synthesise({ id: "t", label: "t", speedMps: 14, intervalMs: 1500, durationMs: 30_000, jitterM: 20, seed: 7 });
  const b = synthesise({ id: "t", label: "t", speedMps: 14, intervalMs: 1500, durationMs: 30_000, jitterM: 20, seed: 7 });
  const same = JSON.stringify(a.fixes) === JSON.stringify(b.fixes);
  const c = synthesise({ id: "t", label: "t", speedMps: 14, intervalMs: 1500, durationMs: 30_000, jitterM: 20, seed: 8 });
  const differs = JSON.stringify(a.fixes) !== JSON.stringify(c.fixes);
  console.log(`4. traces: same seed identical=${same}, different seed differs=${differs}, fixes=${a.fixes.length}`);
  ok(same, "same seed produced different traces — every benchmark run would be a different experiment");
  ok(differs, "different seeds produced identical traces — the PRNG is not being used");
}

// ── 5. Outages actually remove fixes; monotonic offsets ─────────────────────
{
  const t = synthesise({
    id: "o", label: "o", speedMps: 14, intervalMs: 1000, durationMs: 30_000,
    outages: [[10_000, 20_000]], seed: 3,
  });
  const inside = t.fixes.filter((f) => f.offsetMs >= 10_000 && f.offsetMs <= 20_000);
  let monotonic = true;
  for (let i = 1; i < t.fixes.length; i++) {
    if (t.fixes[i].offsetMs <= t.fixes[i - 1].offsetMs) monotonic = false;
    if (t.fixes[i].seq <= t.fixes[i - 1].seq) monotonic = false;
  }
  console.log(`5. outage: fixes inside window=${inside.length}, offsets+seq monotonic=${monotonic}`);
  ok(inside.length === 0, "outage window still contained fixes");
  ok(monotonic, "offsets or sequence numbers are not strictly increasing");
}

// ── 6. Recorded traces normalise to a zero base ─────────────────────────────
{
  const t = toTrace({ id: "r", label: "r" }, [
    { lat: 34, lng: -5, heading: 1, speed: 2, accuracy: 5, seq: 1, receivedAt: 5_000_000 },
    { lat: 34.001, lng: -5, heading: 1, speed: 2, accuracy: 5, seq: 2, receivedAt: 5_001_500 },
  ]);
  console.log(`6. recorded: first offset=${t.fixes[0].offsetMs}, duration=${t.durationMs}, source=${t.source}`);
  ok(t.fixes[0].offsetMs === 0, "recorded trace did not rebase to zero");
  ok(t.durationMs === 1500, "recorded duration wrong");
  ok(toTrace({ id: "e", label: "e" }, []).fixes.length === 0, "empty recording should not throw");
}

// ── 7. Every scenario is well-formed ────────────────────────────────────────
{
  let bad = 0;
  for (const s of SCENARIOS) {
    if (s.trace.fixes.length === 0 && s.trace.durationMs > 0) bad++;
    // Camera commands must fall inside the trace, or a candidate could receive
    // a gesture the other never sees.
    for (const c of s.camera) if (c.atMs < 0 || c.atMs > s.trace.durationMs) bad++;
  }
  console.log(`7. scenarios: ${SCENARIOS.length} defined, ${STANDARD_TRACES.length} traces, malformed=${bad}`);
  ok(bad === 0, "a scenario has camera commands outside its trace window");
  ok(SCENARIOS.length >= 5, "expected a broad scenario suite");
}

// ── 8. Regression comparison flags the right direction ──────────────────────
{
  const make = (fps: number, p95: number): BenchResult =>
    ({
      candidateId: "c", candidateLabel: "C", approach: "x",
      scenarioId: "s", scenarioLabel: "S", startedAt: "",
      frames: { frames: 100, durationMs: 1000, fpsAverage: fps, p50Ms: 16, p95Ms: p95, p99Ms: p95, worstMs: p95, over16_7: 0, over33_4: 0, droppedEstimate: 0 },
      stalls: { samples: 0, worstMs: 0, over100: 0, meanMs: 0 },
      memory: { startBytes: null, endBytes: null, peakBytes: null, available: false },
      store: { accepted: 0, rejectedStaleSeq: 0, rejectedInaccurate: 0, rejectedTeleport: 0, emitted: 0, suppressed: 0, ticks: 0 },
      markerUpdates: 0, cameraUpdates: 0,
      environment: { os: "android", osVersion: 34, brand: "x", model: "y", emulatorHint: false, hermes: true, dev: false },
    }) as BenchResult;

  const baseline: BenchSuite = { ranAt: "", results: [make(60, 17)] };
  const worse: BenchSuite = { ranAt: "", results: [make(48, 30)] };
  const better: BenchSuite = { ranAt: "", results: [make(60, 15)] };

  const bad = compareToBaseline(worse, baseline).filter((v) => v.regressed);
  const good = compareToBaseline(better, baseline).filter((v) => v.regressed);
  console.log(`8. regressions: worse-run flagged=${bad.length}, better-run flagged=${good.length}`);
  ok(bad.some((v) => v.metric === "fpsAverage"), "a 20% FPS drop was not flagged");
  ok(bad.some((v) => v.metric === "p95Ms"), "a 76% p95 increase was not flagged");
  ok(good.length === 0, "an improvement was reported as a regression");
}

// ── 9. Report renders without a device and states its caveats ───────────────
{
  const suite: BenchSuite = {
    ranAt: new Date(0).toISOString(),
    results: [
      {
        candidateId: "a", candidateLabel: "Candidate A", approach: "approach a",
        scenarioId: "s", scenarioLabel: "Scenario", startedAt: "",
        frames: { frames: 600, durationMs: 10_000, fpsAverage: 60, p50Ms: 16, p95Ms: 18, p99Ms: 22, worstMs: 40, over16_7: 5, over33_4: 1, droppedEstimate: 3 },
        stalls: { samples: 200, worstMs: 40, over100: 0, meanMs: 2 },
        memory: { startBytes: null, endBytes: null, peakBytes: null, available: false },
        store: { accepted: 40, rejectedStaleSeq: 0, rejectedInaccurate: 2, rejectedTeleport: 1, emitted: 500, suppressed: 100, ticks: 600 },
        markerUpdates: 500, cameraUpdates: 12,
        environment: { os: "android", osVersion: 34, brand: "samsung", model: "SM-G991B", emulatorHint: false, hermes: true, dev: true },
      },
    ],
  };
  const text = formatSuite(suite);
  console.log(`9. report: ${text.split("\n").length} lines, warns about DEV build=${text.includes("DEV BUILD")}`);
  ok(text.includes("DEV BUILD"), "report did not warn that a dev build is unrepresentative");
  ok(text.includes("n/a"), "unavailable memory should print n/a, never a fabricated 0");
  ok(text.includes("Candidate A"), "candidate missing from report");
}

// ── 10. Memory sampler degrades honestly ────────────────────────────────────
{
  const unavailable = new MemorySampler(() => null);
  unavailable.begin();
  unavailable.sample();
  unavailable.finish();
  const r = unavailable.result();

  let v = 100;
  const available = new MemorySampler(() => (v += 50));
  available.begin();
  available.sample();
  available.finish();
  const r2 = available.result();

  console.log(`10. memory: unavailable=${!r.available}, peak when available=${r2.peakBytes}`);
  ok(!r.available && r.peakBytes === null, "missing heap API should report null, not 0");
  ok(r2.available && (r2.peakBytes ?? 0) >= 150, "peak tracking wrong");
}

// ── 11. Stall probe arithmetic ──────────────────────────────────────────────
{
  const p = new StallProbe();
  [0, 5, 250, 10].forEach((l) => p.record(l));
  const r = p.result();
  console.log(`11. stalls: samples=${r.samples} worst=${r.worstMs} over100=${r.over100} mean=${r.meanMs.toFixed(1)}`);
  ok(r.samples === 4 && r.worstMs === 250 && r.over100 === 1, "stall aggregation wrong");
  ok(new StallProbe().result().samples === 0, "empty stall probe should not throw");
}

// ── 12. Assets referenced by candidates actually exist ─────────────────────
// REGRESSION: the marker PNG was generated into the wrong directory (repo root
// instead of mobile-app/), so `git add mobile-app/assets` matched nothing,
// silently succeeded, and a commit shipped referencing a file that was not in
// the repo at all. Metro only caught it at bundle time, on the device. A
// require() of a missing asset is a build break, not a type error, so tsc will
// never see it — this check is the only cheap place to catch it.
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");

  const importers: [string, string][] = [
    ["lib/tracking/bench/SymbolLayerCandidate.tsx", "../../../assets/tracking/marker-arrow.png"],
    ["lib/tracking/bench/ViewAnnotationCandidate.tsx", "../../../assets/tracking/marker-arrow.png"],
  ];
  // Tests run from .motion-replay/, so resolve against the package root.
  const root = path.resolve(__dirname, "..");
  let missing = 0;
  for (const [importer, rel] of importers) {
    const resolved = path.resolve(root, path.dirname(importer), rel);
    if (!fs.existsSync(resolved)) {
      console.log(`  missing asset: ${importer} -> ${rel}`);
      missing++;
    }
  }
  console.log(`12. assets: ${importers.length} references checked, missing=${missing}`);
  ok(missing === 0, "a candidate requires an asset that does not exist — Metro will fail to bundle");
}

// ── 13. The validity gate catches a compromised run ────────────────────────
// REGRESSION: the first real run reported the control at 12.8 FPS because the
// runner fired onProgress every frame and the screen's setState re-rendered the
// mounted candidate 60x/sec. The harness was measuring itself, and nothing in
// the report said so. A benchmark that cannot detect its own invalidity is a
// machine for producing confident wrong answers.
{
  const mk = (id: string, fps: number, model = "SM-A065F"): BenchResult =>
    ({
      candidateId: id, candidateLabel: id, approach: "x",
      scenarioId: "s", scenarioLabel: "S", startedAt: "",
      frames: { frames: 100, durationMs: 1000, fpsAverage: fps, p50Ms: 16, p95Ms: 18, p99Ms: 20, worstMs: 30, over16_7: 0, over33_4: 0, droppedEstimate: 0 },
      stalls: { samples: 0, worstMs: 0, over100: 0, meanMs: 0 },
      memory: { startBytes: null, endBytes: null, peakBytes: null, available: false },
      store: { accepted: 0, rejectedStaleSeq: 0, rejectedInaccurate: 0, rejectedTeleport: 0, emitted: 0, suppressed: 0, ticks: 0 },
      markerUpdates: 0, cameraUpdates: 0,
      environment: { os: "android", osVersion: 34, brand: "samsung", model, emulatorHint: false, hermes: true, dev: true },
    }) as BenchResult;

  const bad = formatSuite({ ranAt: "", results: [mk("control", 12.8), mk("view-annotation", 11)] });
  const good = formatSuite({ ranAt: "", results: [mk("control", 58), mk("view-annotation", 55)] });
  const noControl = formatSuite({ ranAt: "", results: [mk("view-annotation", 55)] });
  const mixed = formatSuite({
    ranAt: "", results: [mk("control", 58), mk("control", 58, "SM-A405FN")],
  });

  console.log(
    `13. validity gate: slow-control flagged=${bad.includes("RUN INVALID")}, ` +
      `healthy clean=${!good.includes("RUN INVALID")}, ` +
      `no-control flagged=${noControl.includes("No control candidate")}, ` +
      `mixed-device flagged=${mixed.includes("MIXED DEVICES")}`,
  );
  ok(bad.includes("RUN INVALID"), "a 12.8 FPS control was NOT flagged as invalid");
  ok(!good.includes("RUN INVALID"), "a healthy run was wrongly flagged invalid");
  ok(noControl.includes("No control candidate"), "a run without a control was not flagged");
  ok(mixed.includes("MIXED DEVICES"), "results from two different phones were not flagged");
}

console.log(failures === 0 ? "\nALL BENCH-FRAMEWORK CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
