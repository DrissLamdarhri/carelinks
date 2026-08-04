/**
 * CareLink — the animation store that drives the tracking marker.
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * The previous smoothing hook (`useGlidingPosition`) called `setState` on every
 * animation frame from inside the tracking SCREEN. React therefore re-rendered
 * the map, the bottom sheet, the provider card, the ETA and the action row —
 * sixty times a second — in order to move one dot a fraction of a pixel. On the
 * mid-range Android that dominates this market that is the single largest
 * source of the "flickering / shaking / blinking" the product owner reported.
 *
 * The fix is not "animate faster". It is to take the animation loop OUT of the
 * React tree. This store owns a `MotionTrack`, ticks it on its own clock, and
 * notifies only the components that explicitly subscribe. A 60 Hz update to one
 * 30-line leaf component is nothing; a 60 Hz update to a screen is jank.
 *
 * DESIGN NOTES
 *
 *  • `getSnapshot()` returns a CACHED object and only replaces it when the
 *    rendered value actually changed. React's `useSyncExternalStore` compares
 *    snapshots by identity — returning a fresh object every call is an infinite
 *    render loop, and it is the classic way to get this wrong.
 *
 *  • Sub-threshold changes are not emitted at all. A parked phone whose GPS
 *    wobbles by 20 cm must not wake the renderer.
 *
 *  • The ticker STOPS when the scene has settled, and restarts on the next
 *    fix. Continuous tracking on a nurse's phone runs for the whole trip;
 *    spinning an animation loop while nothing moves is pure battery burn.
 *
 *  • Motion and STATUS are deliberately separate. `ageMs` changes every
 *    millisecond, so folding staleness into the animated snapshot would force a
 *    re-render every frame forever, defeating the entire purpose. Status is
 *    pulled on demand by slow UI (see `getStatus`).
 *
 *  • Clock and scheduler are injectable so the whole thing is deterministic
 *    under test — see `store.replay.ts`.
 */
import {
  DEAD_RECKON_MS,
  MotionTrack,
  RENDER_DELAY_MS,
  shortestAngleDelta,
  type Fix,
  type LatLng,
  type MotionSample,
  type RejectReason,
} from "./motion";

/**
 * Past this age the pipeline has nothing real left to interpolate: the render
 * clock has consumed the buffer and the dead-reckoning window has expired.
 */
export const STALE_AFTER_MS = RENDER_DELAY_MS + DEAD_RECKON_MS;

export type Scheduler = {
  /** Schedule `cb` for the next frame. Returns a cancellation handle. */
  schedule(cb: () => void): unknown;
  cancel(handle: unknown): void;
  /** Current time in ms. */
  now(): number;
};

const defaultScheduler: Scheduler = {
  schedule: (cb) =>
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(() => cb())
      : setTimeout(cb, 16),
  cancel: (h) => {
    if (typeof cancelAnimationFrame === "function" && typeof h === "number") cancelAnimationFrame(h);
    else clearTimeout(h as ReturnType<typeof setTimeout>);
  },
  now: () => Date.now(),
};

export type TrackingStoreOptions = {
  /** Minimum gap between emitted frames (ms). 0 = every scheduler tick. */
  frameIntervalMs?: number;
  /** Ignore rendered movement smaller than this (metres). */
  minMoveM?: number;
  /** Ignore rendered rotation smaller than this (degrees). */
  minTurnDeg?: number;
  /** Frames with no change before the ticker parks itself. */
  idleFramesBeforeStop?: number;
  scheduler?: Scheduler;
};

export type TrackingStatus = {
  /** True once the pipeline has stopped receiving usable fixes. */
  stale: boolean;
  /** Age of the newest accepted fix in ms, or null before the first one. */
  ageMs: number | null;
  /** True once at least one fix has been accepted. */
  hasData: boolean;
};

/** Cheap equirectangular metre distance — exact enough for a change threshold. */
function approxMetres(a: MotionSample, b: MotionSample): number {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

export class TrackingStore {
  private readonly track = new MotionTrack();
  private readonly listeners = new Set<() => void>();
  private readonly scheduler: Scheduler;
  private readonly frameIntervalMs: number;
  private readonly minMoveM: number;
  private readonly minTurnDeg: number;
  private readonly idleFramesBeforeStop: number;

  private snapshot: MotionSample | null = null;
  private handle: unknown = null;
  private lastFrameAt = 0;
  private idleFrames = 0;

  /** Frames emitted / suppressed — surfaced by the benchmark harness. */
  readonly stats = { emitted: 0, suppressed: 0, ticks: 0 };

  constructor(opts: TrackingStoreOptions = {}) {
    this.scheduler = opts.scheduler ?? defaultScheduler;
    this.frameIntervalMs = opts.frameIntervalMs ?? 0;
    this.minMoveM = opts.minMoveM ?? 0.05;
    this.minTurnDeg = opts.minTurnDeg ?? 0.25;
    this.idleFramesBeforeStop = opts.idleFramesBeforeStop ?? 30;
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  /** Offer a fix from the realtime stream. Returns why it was dropped, or null. */
  push(fix: Fix): RejectReason | null {
    const rejected = this.track.push(fix);
    // A new fix means there is something to animate toward again, even if the
    // ticker had parked itself.
    if (!rejected) this.wake();
    return rejected;
  }

  /** The newest RAW fix. Business logic (ETA, distance, arrival) reads this —
   *  never the smoothed snapshot, or the numbers oscillate. */
  get latestFix(): Fix | null {
    return this.track.latest;
  }

  /**
   * Attach (or clear) the road being followed. With a route the marker is
   * map-matched and interpolated ALONG the street rather than through open
   * space, so it cannot drift across buildings.
   */
  setRoute(points: LatLng[] | null): void {
    this.track.setRoute(points);
  }

  /** True while positions are being map-matched to a trusted road. */
  get onRoute(): boolean {
    return this.track.onRoute;
  }

  /** The road as it must be DRAWN — the exact curve the marker travels. */
  get renderRoute(): LatLng[] | null {
    return this.track.renderRoute;
  }

  /** Lateral distance of the newest fix from the route; null when unmatched. */
  get routeDeviationM(): number | null {
    return this.track.routeDeviationM;
  }

  /** True once several consecutive fixes agree the road was left — see
   *  MotionTrack.isOffRoute for why one fix is not enough. */
  isOffRoute(thresholdM: number, samples = 3): boolean {
    return this.track.isOffRoute(thresholdM, samples);
  }

  /** Filter rejections by reason. Surfaced for the benchmark harness and for
   *  diagnostics: a spike in `inaccurate` is a bad GPS environment, a spike in
   *  `stale-seq` is a misbehaving transport. */
  rejectionCounts(): Readonly<Record<RejectReason, number>> {
    return this.track.rejected;
  }

  // ── React-compatible external store ───────────────────────────────────────
  /** Subscribe to animated motion updates. Returns an unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.wake();
    return () => {
      this.listeners.delete(listener);
      // Nobody is watching — stop burning frames immediately.
      if (this.listeners.size === 0) this.stop();
    };
  };

  /** MUST return a stable reference between changes (useSyncExternalStore). */
  getSnapshot = (): MotionSample | null => this.snapshot;

  /**
   * Low-frequency status. Deliberately NOT part of the animated snapshot:
   * `ageMs` changes continuously, so including it would force a re-render every
   * single frame for the lifetime of the trip. Poll this from slow UI (~1 Hz).
   */
  getStatus = (): TrackingStatus => {
    const latest = this.track.latest;
    const ageMs = latest ? this.scheduler.now() - latest.receivedAt : null;
    // Derived from the CLOCK, never from the last snapshot. Self-review caught
    // this: the ticker parks itself once the scene settles, which freezes the
    // snapshot — so reading `snapshot.stale` meant that if the fix stream died
    // after the marker came to rest, staleness would read false forever and the
    // patient would be shown a confident dot that had quietly stopped being
    // true. That is precisely the failure this flag exists to prevent.
    return {
      stale: ageMs != null && ageMs > STALE_AFTER_MS,
      ageMs,
      hasData: this.track.hasData,
    };
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  /** Clear all state — call when the tracked subject changes (new booking). */
  reset(): void {
    this.stop();
    this.track.reset();
    this.snapshot = null;
    this.idleFrames = 0;
    this.lastFrameAt = 0;
  }

  /** Stop the ticker and drop subscribers. Call on unmount. */
  destroy(): void {
    this.stop();
    this.listeners.clear();
  }

  /** True while the animation loop is running — asserted by the tests. */
  get running(): boolean {
    return this.handle !== null;
  }

  // ── Internals ─────────────────────────────────────────────────────────────
  private wake(): void {
    if (this.handle !== null) return;
    if (this.listeners.size === 0) return; // nothing to drive
    if (!this.track.hasData) return; // nothing to draw yet
    this.idleFrames = 0;
    this.handle = this.scheduler.schedule(this.tick);
  }

  private stop(): void {
    if (this.handle === null) return;
    this.scheduler.cancel(this.handle);
    this.handle = null;
  }

  private tick = (): void => {
    this.handle = null;
    this.stats.ticks++;

    const now = this.scheduler.now();
    if (this.frameIntervalMs > 0 && now - this.lastFrameAt < this.frameIntervalMs) {
      // Too soon for another frame; re-arm without doing any work.
      this.handle = this.scheduler.schedule(this.tick);
      return;
    }
    this.lastFrameAt = now;

    const next = this.track.sampleAt(now);
    if (!next) {
      this.stop();
      return;
    }

    if (this.changedEnough(next)) {
      this.snapshot = next;
      this.idleFrames = 0;
      this.stats.emitted++;
      this.listeners.forEach((l) => {
        try {
          l();
        } catch {
          /* one broken subscriber must never stop the animation loop */
        }
      });
    } else {
      this.idleFrames++;
      this.stats.suppressed++;
    }

    // The scene has settled: park the loop until the next fix arrives. Without
    // this, a nurse waiting at a red light burns frames for the whole stop.
    if (this.idleFrames >= this.idleFramesBeforeStop) return;
    this.handle = this.scheduler.schedule(this.tick);
  };

  private changedEnough(next: MotionSample): boolean {
    const prev = this.snapshot;
    if (!prev) return true;
    if (prev.stale !== next.stale || prev.moving !== next.moving) return true;
    // Shortest path, so 359deg -> 1deg reads as 2deg of turn rather than 358.
    if (Math.abs(shortestAngleDelta(prev.bearing, next.bearing)) >= this.minTurnDeg) return true;
    return approxMetres(prev, next) >= this.minMoveM;
  }
}
