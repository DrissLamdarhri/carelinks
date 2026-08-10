/**
 * CareLink — benchmark measurement primitives.
 *
 * Deliberately free of React Native imports so the maths is unit-testable under
 * plain node (see `bench.replay.ts`). Percentile and dropped-frame arithmetic
 * is exactly the kind of thing that is easy to get subtly wrong and then quote
 * with confidence for years.
 *
 * HONESTY ABOUT WHAT THESE NUMBERS ARE
 *   Frame timings are observed from the JS thread via requestAnimationFrame.
 *   They measure when JS was given a frame, which is the right signal for
 *   comparing two JS-driven renderers, but they are NOT the compositor's record
 *   of presented frames. A renderer that offloads work to the native/UI thread
 *   can show excellent JS frame times while the user still sees jank — which is
 *   precisely why the report pairs these with marker/camera update counts and
 *   requires an out-of-band `adb` capture for the final call.
 */
import type { FrameMetrics, MemoryMetrics, StallMetrics } from "./types";

/** One 60Hz frame budget. */
export const FRAME_BUDGET_MS = 1000 / 60;

/** Percentile of an UNSORTED sample, using nearest-rank. Returns 0 if empty. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/**
 * Records the interval between consecutive animation frames.
 *
 * The first frame is skipped: its interval includes scheduling latency from
 * before measurement began and would pollute the worst-case figures.
 */
export class FrameCollector {
  private intervals: number[] = [];
  private last: number | null = null;
  private startedAt: number | null = null;
  private endedAt: number | null = null;

  start(now: number): void {
    this.intervals = [];
    this.last = null;
    this.startedAt = now;
    this.endedAt = null;
  }

  /** Call once per animation frame. */
  frame(now: number): void {
    if (this.last !== null) this.intervals.push(now - this.last);
    this.last = now;
  }

  stop(now: number): void {
    this.endedAt = now;
  }

  get sampleCount(): number {
    return this.intervals.length;
  }

  result(): FrameMetrics {
    const durationMs =
      this.startedAt !== null && this.endedAt !== null ? this.endedAt - this.startedAt : 0;
    const frames = this.intervals.length;
    if (frames === 0) {
      return {
        frames: 0, durationMs, fpsAverage: 0,
        p50Ms: 0, p95Ms: 0, p99Ms: 0, worstMs: 0,
        over16_7: 0, over33_4: 0, droppedEstimate: 0,
      };
    }

    let over16 = 0;
    let over33 = 0;
    let dropped = 0;
    let worst = 0;
    for (const d of this.intervals) {
      if (d > FRAME_BUDGET_MS * 1.5) over16++;
      if (d > FRAME_BUDGET_MS * 2.5) over33++;
      if (d > worst) worst = d;
      // How many whole frame budgets did this interval overrun by? An interval
      // of ~33ms means one frame was missed, ~50ms means two.
      const missed = Math.round(d / FRAME_BUDGET_MS) - 1;
      if (missed > 0) dropped += missed;
    }

    return {
      frames,
      durationMs,
      fpsAverage: durationMs > 0 ? (frames / durationMs) * 1000 : 0,
      p50Ms: percentile(this.intervals, 50),
      p95Ms: percentile(this.intervals, 95),
      p99Ms: percentile(this.intervals, 99),
      worstMs: worst,
      over16_7: over16,
      over33_4: over33,
      droppedEstimate: dropped,
    };
  }
}

/**
 * Detects JS-thread blockage by scheduling a fixed-interval timer and measuring
 * how late it actually fires. rAF gaps alone cannot distinguish "the renderer
 * asked for fewer frames" from "the JS thread was busy"; this can.
 */
export class StallProbe {
  private lateness: number[] = [];
  private handle: ReturnType<typeof setInterval> | null = null;
  private expected = 0;
  private readonly intervalMs: number;
  private readonly now: () => number;

  constructor(intervalMs = 50, now: () => number = () => Date.now()) {
    this.intervalMs = intervalMs;
    this.now = now;
  }

  start(): void {
    this.lateness = [];
    this.expected = this.now() + this.intervalMs;
    this.handle = setInterval(() => {
      const t = this.now();
      this.lateness.push(Math.max(0, t - this.expected));
      this.expected = t + this.intervalMs;
    }, this.intervalMs);
  }

  stop(): void {
    if (this.handle !== null) clearInterval(this.handle);
    this.handle = null;
  }

  /** Feed a lateness sample directly — used by the headless tests. */
  record(latenessMs: number): void {
    this.lateness.push(latenessMs);
  }

  result(): StallMetrics {
    const n = this.lateness.length;
    if (n === 0) return { samples: 0, worstMs: 0, over100: 0, meanMs: 0 };
    let worst = 0;
    let over = 0;
    let sum = 0;
    for (const l of this.lateness) {
      if (l > worst) worst = l;
      if (l > 100) over++;
      sum += l;
    }
    return { samples: n, worstMs: worst, over100: over, meanMs: sum / n };
  }
}

type HeapCapable = { memory?: { usedJSHeapSize?: number } };

/**
 * Samples the JS heap where the runtime exposes it. Hermes generally does not,
 * in which case `available` is false and every figure is null — the report then
 * says "not available on this runtime" rather than printing a fabricated zero.
 */
export class MemorySampler {
  private start: number | null = null;
  private peak: number | null = null;
  private end: number | null = null;
  private readonly read: () => number | null;

  constructor(read?: () => number | null) {
    this.read =
      read ??
      (() => {
        const perf = (globalThis as unknown as { performance?: HeapCapable }).performance;
        const used = perf?.memory?.usedJSHeapSize;
        return typeof used === "number" ? used : null;
      });
  }

  begin(): void {
    this.start = this.read();
    this.peak = this.start;
    this.end = null;
  }

  sample(): void {
    const v = this.read();
    if (v === null) return;
    if (this.peak === null || v > this.peak) this.peak = v;
  }

  finish(): void {
    this.end = this.read();
    this.sample();
  }

  result(): MemoryMetrics {
    return {
      startBytes: this.start,
      endBytes: this.end,
      peakBytes: this.peak,
      available: this.start !== null,
    };
  }
}
