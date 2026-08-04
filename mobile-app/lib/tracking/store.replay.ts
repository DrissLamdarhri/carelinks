/**
 * CareLink — deterministic tests for the tracking animation store.
 *
 *   pnpm -C mobile-app test:tracking
 *
 * The scheduler and clock are injected, so the animation loop is stepped by
 * hand rather than by wall time. No React, no device, no flakiness: every
 * assertion here is exactly reproducible.
 *
 * These cover the properties that are invisible in review and expensive in
 * production — snapshot identity (an infinite React render loop if wrong),
 * suppression of sub-threshold noise, and whether the loop actually parks
 * itself when nothing is moving (battery, over a whole trip).
 */
import { STALE_AFTER_MS, TrackingStore, type Scheduler } from "./store";
import { RENDER_DELAY_MS, type Fix } from "./motion";

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) {
    console.log(`  FAIL: ${msg}`);
    failures++;
  }
}

/** A scheduler driven entirely by hand. `step()` advances time and runs a frame. */
function manualScheduler(startAt = 1_000_000) {
  let clock = startAt;
  let pending: (() => void) | null = null;
  const scheduler: Scheduler = {
    schedule: (cb) => {
      pending = cb;
      return 1;
    },
    cancel: () => {
      pending = null;
    },
    now: () => clock,
  };
  return {
    scheduler,
    get clock() {
      return clock;
    },
    set clock(v: number) {
      clock = v;
    },
    get armed() {
      return pending !== null;
    },
    /** Advance the clock and run one scheduled frame, if any. */
    step(ms: number): boolean {
      clock += ms;
      const cb = pending;
      pending = null;
      if (!cb) return false;
      cb();
      return true;
    },
  };
}

function fix(i: number, at: number): Fix {
  return {
    lat: 34.03 + i * 0.00013,
    lng: -5.0 + i * 0.00011,
    heading: 40,
    speed: 14,
    accuracy: 8,
    seq: i,
    receivedAt: at,
  };
}

// ── 1. Snapshot identity is stable between changes ──────────────────────────
// If getSnapshot() returned a fresh object each call, useSyncExternalStore
// would re-render forever. This is the most consequential contract here.
{
  const m = manualScheduler();
  const store = new TrackingStore({ scheduler: m.scheduler });
  store.subscribe(() => {});
  const t0 = m.clock;
  store.push(fix(1, t0));
  store.push(fix(2, t0 + 1500));
  m.step(RENDER_DELAY_MS + 100);

  const a = store.getSnapshot();
  const b = store.getSnapshot();
  console.log(`1. snapshot identity: stable=${a === b}`);
  ok(a !== null, "no snapshot produced after pushing fixes");
  ok(a === b, "getSnapshot() returned a new object without any change — infinite render loop");
}

// ── 2. Steady-state motion emits a smooth stream of frames ──────────────────
// Fixes must arrive AS THE CLOCK ADVANCES, the way they do in production. An
// earlier version of this test pushed all of them at t0 without moving the
// clock, so the render clock (now - 2000ms) never reached the first fix and the
// loop correctly found nothing to draw. The test was wrong, not the store.
{
  const m = manualScheduler();
  const store = new TrackingStore({ scheduler: m.scheduler });
  let notified = 0;
  store.subscribe(() => notified++);

  const start = m.clock;
  let seq = 0;
  let nextFixAt = m.clock;
  const DURATION = 12_000;
  while (m.clock - start < DURATION) {
    if (m.clock >= nextFixAt) {
      store.push(fix(++seq, m.clock));
      nextFixAt += 1500;
    }
    m.step(16); // advances the clock whether or not a frame was armed
  }

  const frames = Math.round(DURATION / 16);
  console.log(
    `2. emission: ${store.stats.emitted} emitted / ${store.stats.suppressed} suppressed ` +
      `over ~${frames} frames, ${notified} notifications`,
  );
  ok(notified > 100, `only ${notified} renders across 12s of motion — animation would look choppy`);
  ok(notified === store.stats.emitted, "notification count does not match emitted frames");
  ok(store.stats.emitted <= frames, "emitted more frames than the scheduler ran");
}

// ── 3. A stationary subject must not wake the renderer ──────────────────────
// Identical fixes = zero rendered movement. Emitting frames for that is how you
// flatten a battery while a nurse waits at a red light.
{
  const m = manualScheduler();
  const store = new TrackingStore({ scheduler: m.scheduler, idleFramesBeforeStop: 10 });
  let notified = 0;
  store.subscribe(() => notified++);
  const t0 = m.clock;
  const parked: Fix = { lat: 34.03, lng: -5.0, heading: null, speed: 0, accuracy: 8, seq: 1, receivedAt: t0 };
  store.push(parked);
  store.push({ ...parked, seq: 2, receivedAt: t0 + 1500 });
  store.push({ ...parked, seq: 3, receivedAt: t0 + 3000 });

  let frames = 0;
  while (m.armed && frames < 500) {
    m.step(16);
    frames++;
  }
  console.log(`3. parked: ${notified} notifications over ${frames} frames, loop running=${store.running}`);
  ok(notified <= 2, `stationary subject produced ${notified} renders — should be ~1`);
  ok(!store.running, "animation loop never parked itself while nothing moved");
}

// ── 4. The loop restarts when a new fix arrives ─────────────────────────────
{
  const m = manualScheduler();
  const store = new TrackingStore({ scheduler: m.scheduler, idleFramesBeforeStop: 5 });
  store.subscribe(() => {});
  const t0 = m.clock;
  store.push(fix(1, t0));
  let guard = 0;
  while (m.armed && guard++ < 200) m.step(16);
  const parkedBefore = !store.running;

  // Let real time pass before the next fix. Pushing fix(2) immediately would
  // imply ~184 m/s and be rejected as a teleport — correctly, but it would test
  // the filter rather than the wake path.
  m.clock += 1500;
  const rejected = store.push(fix(2, m.clock));
  console.log(`4. wake: parked=${parkedBefore}, rejected=${rejected}, running after push=${store.running}`);
  ok(parkedBefore, "loop did not park before the wake test");
  ok(rejected === null, `plausible fix was rejected as ${rejected}`);
  ok(store.running, "a new fix did not restart the animation loop");
}

// ── 5. Unsubscribing stops the loop; status stays available ─────────────────
{
  const m = manualScheduler();
  const store = new TrackingStore({ scheduler: m.scheduler });
  const unsub = store.subscribe(() => {});
  const t0 = m.clock;
  store.push(fix(1, t0));
  store.push(fix(2, t0 + 1500));
  m.step(RENDER_DELAY_MS + 100);
  unsub();
  console.log(`5. teardown: running=${store.running}`);
  ok(!store.running, "loop kept running with no subscribers");

  m.clock += 60_000;
  const status = store.getStatus();
  ok(status.hasData, "status lost track of having data");
  ok((status.ageMs ?? 0) >= 60_000, "status.ageMs did not advance with the clock");
  console.log(`   status after 60s idle: age=${Math.round((status.ageMs ?? 0) / 1000)}s hasData=${status.hasData}`);
}

// ── 6. Rejected fixes must not wake the loop ────────────────────────────────
{
  const m = manualScheduler();
  const store = new TrackingStore({ scheduler: m.scheduler, idleFramesBeforeStop: 5 });
  store.subscribe(() => {});
  const t0 = m.clock;
  store.push(fix(1, t0));
  let guard = 0;
  while (m.armed && guard++ < 200) m.step(16);

  const rejected = store.push({ ...fix(1, m.clock), seq: 1 }); // replayed seq
  console.log(`6. rejected fix: reason=${rejected}, running=${store.running}`);
  ok(rejected === "stale-seq", "duplicate sequence number was accepted");
  ok(!store.running, "a rejected fix woke the animation loop");
}

// ── 7. reset() clears everything ────────────────────────────────────────────
{
  const m = manualScheduler();
  const store = new TrackingStore({ scheduler: m.scheduler });
  store.subscribe(() => {});
  const t0 = m.clock;
  store.push(fix(1, t0));
  store.push(fix(2, t0 + 1500));
  m.step(RENDER_DELAY_MS + 100);
  store.reset();
  console.log(`7. reset: snapshot=${store.getSnapshot()}, latestFix=${store.latestFix}, running=${store.running}`);
  ok(store.getSnapshot() === null, "reset() left a stale snapshot behind");
  ok(store.latestFix === null, "reset() left buffered fixes behind");
  ok(!store.running, "reset() left the loop running");
  // A booking re-match reuses the store; seq must restart from scratch.
  ok(store.push(fix(1, m.clock)) === null, "reset() did not clear the sequence guard");
}

// ── 8. Staleness is reported even after the ticker parks ────────────────────
// REGRESSION: `stale` was originally read off the last snapshot. Because the
// loop parks itself once the scene settles, the snapshot freezes — so if the
// fix stream then died, staleness stayed false forever and the patient kept
// seeing a confident dot that had quietly stopped being true. Exactly the
// failure the flag exists to prevent. It is now derived from the clock.
{
  const m = manualScheduler();
  const store = new TrackingStore({ scheduler: m.scheduler, idleFramesBeforeStop: 5 });
  store.subscribe(() => {});
  store.push(fix(1, m.clock));
  let guard = 0;
  while (m.armed && guard++ < 200) m.step(16);

  const fresh = store.getStatus();
  m.clock += STALE_AFTER_MS + 1000; // stream dies while the loop is parked
  const gone = store.getStatus();

  console.log(
    `8. staleness while parked: running=${store.running} fresh=${fresh.stale} ` +
      `after ${Math.round((STALE_AFTER_MS + 1000) / 1000)}s=${gone.stale}`,
  );
  ok(!store.running, "loop should be parked for this test to mean anything");
  ok(!fresh.stale, "reported stale immediately after a good fix");
  ok(gone.stale, "did NOT report stale after the stream died with the loop parked");
}

console.log(failures === 0 ? "\nALL STORE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
