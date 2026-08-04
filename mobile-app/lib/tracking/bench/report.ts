/**
 * CareLink — benchmark reporting and regression comparison.
 *
 * Pure formatting and arithmetic, so it is testable headlessly and can also be
 * run over archived JSON results outside the app.
 *
 * The report deliberately refuses to declare a winner. It surfaces the numbers,
 * flags comparisons that are INVALID (different scenario, dev vs release build,
 * simulator vs device), and leaves the judgement to a human — because the right
 * renderer depends on trade-offs the harness cannot see, like how much native
 * code we are willing to maintain.
 */
import type { BenchResult, BenchSuite } from "./types";

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}
function padL(s: string, width: number): string {
  return s.length >= width ? s : " ".repeat(width - s.length) + s;
}
function n1(v: number): string {
  return v.toFixed(1);
}
function mb(bytes: number | null): string {
  return bytes === null ? "n/a" : `${(bytes / 1048576).toFixed(1)}MB`;
}

/** Human-readable comparison of every candidate for one scenario. */
export function formatScenario(results: BenchResult[]): string {
  if (results.length === 0) return "(no results)";
  const scenario = results[0].scenarioLabel;
  const lines: string[] = [];

  lines.push(`\n── ${scenario} ${"─".repeat(Math.max(0, 62 - scenario.length))}`);

  const rows: [string, (r: BenchResult) => string][] = [
    ["avg FPS", (r) => n1(r.frames.fpsAverage)],
    ["p50 frame ms", (r) => n1(r.frames.p50Ms)],
    ["p95 frame ms", (r) => n1(r.frames.p95Ms)],
    ["p99 frame ms", (r) => n1(r.frames.p99Ms)],
    ["worst frame ms", (r) => n1(r.frames.worstMs)],
    [">16.7ms frames", (r) => String(r.frames.over16_7)],
    [">33.4ms frames", (r) => String(r.frames.over33_4)],
    ["dropped (est)", (r) => String(r.frames.droppedEstimate)],
    ["JS stall worst ms", (r) => n1(r.stalls.worstMs)],
    ["JS stalls >100ms", (r) => String(r.stalls.over100)],
    ["heap peak", (r) => mb(r.memory.peakBytes)],
    ["marker updates", (r) => String(r.markerUpdates)],
    ["camera updates", (r) => String(r.cameraUpdates)],
    ["store emitted", (r) => String(r.store.emitted)],
    ["store suppressed", (r) => String(r.store.suppressed)],
    ["fixes accepted", (r) => String(r.store.accepted)],
    [
      "fixes rejected",
      (r) =>
        String(r.store.rejectedStaleSeq + r.store.rejectedInaccurate + r.store.rejectedTeleport),
    ],
  ];

  const labelW = 20;
  const colW = Math.max(14, ...results.map((r) => r.candidateLabel.length + 2));

  lines.push(pad("", labelW) + results.map((r) => padL(r.candidateLabel, colW)).join(""));
  for (const [label, get] of rows) {
    lines.push(pad(label, labelW) + results.map((r) => padL(get(r), colW)).join(""));
  }
  return lines.join("\n");
}

/** Full report across every scenario, with provenance and caveats. */
export function formatSuite(suite: BenchSuite): string {
  const out: string[] = [];
  out.push("═".repeat(80));
  out.push("CareLink — tracking renderer benchmark");
  out.push(`ran at: ${suite.ranAt}`);

  const env = suite.results[0]?.environment;
  if (env) {
    out.push(
      `device: ${env.os} ${env.osVersion} | ${env.brand ?? "?"} ${env.model ?? "?"} | ` +
        `hermes=${env.hermes} | build=${env.dev ? "DEV" : "release"}`,
    );
    if (env.dev) {
      out.push("");
      out.push("!! DEV BUILD — absolute figures are not representative of release.");
      out.push("!! Relative comparison between candidates remains valid; treat");
      out.push("!! headline FPS as a floor, not a forecast.");
    }
    if (env.emulatorHint) {
      out.push("");
      out.push("!! Model string looks like an EMULATOR. GPU behaviour differs");
      out.push("!! fundamentally from a phone — verify, and do not choose a");
      out.push("!! renderer on emulator numbers.");
    }
  }
  out.push("═".repeat(80));

  const candidates = new Map<string, string>();
  for (const r of suite.results) candidates.set(r.candidateLabel, r.approach);
  out.push("");
  for (const [label, approach] of candidates) out.push(`  ${label}: ${approach}`);

  const byScenario = new Map<string, BenchResult[]>();
  for (const r of suite.results) {
    const list = byScenario.get(r.scenarioId) ?? [];
    list.push(r);
    byScenario.set(r.scenarioId, list);
  }
  for (const list of byScenario.values()) out.push(formatScenario(list));

  out.push("");
  out.push("─".repeat(80));
  out.push("Frame timings are observed from the JS thread via requestAnimationFrame.");
  out.push("They are the right signal for comparing JS-driven renderers, but they are");
  out.push("NOT the compositor's record of presented frames: a renderer that pushes");
  out.push("work to the native thread can post excellent JS timings while the user");
  out.push("still sees jank. Pair these with the adb capture in");
  out.push("docs/tracking-benchmark.md before deciding.");
  out.push("─".repeat(80));
  return out.join("\n");
}

export type RegressionVerdict = {
  metric: string;
  scenarioId: string;
  candidateId: string;
  baseline: number;
  current: number;
  deltaPct: number;
  regressed: boolean;
};

/** Default tolerances: how much worse a metric may get before it is a regression. */
export const DEFAULT_TOLERANCE_PCT = {
  fpsAverage: 5, // a drop of >5% average FPS
  p95Ms: 15,
  p99Ms: 20,
  droppedEstimate: 25,
};

/**
 * Compare a run against a stored baseline. This is what makes the harness a
 * permanent tool rather than a one-off: every future tracking change can be
 * checked against the last known-good numbers on the same device.
 */
export function compareToBaseline(
  current: BenchSuite,
  baseline: BenchSuite,
  tolerancePct: Partial<typeof DEFAULT_TOLERANCE_PCT> = {},
): RegressionVerdict[] {
  const tol = { ...DEFAULT_TOLERANCE_PCT, ...tolerancePct };
  const key = (r: BenchResult) => `${r.candidateId}::${r.scenarioId}`;
  const base = new Map(baseline.results.map((r) => [key(r), r]));
  const verdicts: RegressionVerdict[] = [];

  for (const r of current.results) {
    const b = base.get(key(r));
    if (!b) continue;

    // Higher is better.
    const fpsDelta = pctChange(b.frames.fpsAverage, r.frames.fpsAverage);
    verdicts.push({
      metric: "fpsAverage", scenarioId: r.scenarioId, candidateId: r.candidateId,
      baseline: b.frames.fpsAverage, current: r.frames.fpsAverage,
      deltaPct: fpsDelta, regressed: fpsDelta < -tol.fpsAverage,
    });

    // Lower is better.
    for (const [metric, bv, cv, limit] of [
      ["p95Ms", b.frames.p95Ms, r.frames.p95Ms, tol.p95Ms],
      ["p99Ms", b.frames.p99Ms, r.frames.p99Ms, tol.p99Ms],
      ["droppedEstimate", b.frames.droppedEstimate, r.frames.droppedEstimate, tol.droppedEstimate],
    ] as [string, number, number, number][]) {
      const delta = pctChange(bv, cv);
      verdicts.push({
        metric, scenarioId: r.scenarioId, candidateId: r.candidateId,
        baseline: bv, current: cv, deltaPct: delta, regressed: delta > limit,
      });
    }
  }
  return verdicts;
}

function pctChange(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100;
  return ((to - from) / from) * 100;
}

export function formatRegressions(verdicts: RegressionVerdict[]): string {
  const bad = verdicts.filter((v) => v.regressed);
  if (bad.length === 0) return "No regressions against baseline.";
  const lines = [`${bad.length} REGRESSION(S) against baseline:`];
  for (const v of bad) {
    lines.push(
      `  ${v.candidateId} / ${v.scenarioId} / ${v.metric}: ` +
        `${v.baseline.toFixed(1)} → ${v.current.toFixed(1)} (${v.deltaPct > 0 ? "+" : ""}${v.deltaPct.toFixed(1)}%)`,
    );
  }
  return lines.join("\n");
}
