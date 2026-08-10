/**
 * CareLink — replay harness for the motion pipeline.
 *
 *   pnpm -C mobile-app test:tracking
 *
 * There is no test runner in this repo, and motion quality is exactly the kind
 * of thing that cannot be reviewed by reading a diff or eyeballed reliably on a
 * device: a marker that occasionally steps backwards, or spins the long way
 * round a corner, looks "a bit off" and gets shipped. These are the properties
 * that must hold, asserted against synthetic traces of the situations that
 * actually break tracking — jitter, garbage fixes, tunnels, and the 0°/360°
 * boundary.
 *
 * Pure logic, no React Native, so it runs under plain node.
 */
import { MotionTrack, Route, bearingDeg, distanceM, shortestAngleDelta, RENDER_DELAY_MS, type Fix } from "./motion";

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) {
    console.log(`  FAIL: ${msg}`);
    failures++;
  }
}

/** A steady north-east drive at ~14 m/s (50 km/h), one fix every 1.5 s. */
function trace(n: number, opts: { jitterM?: number; dropFrom?: number; dropCount?: number } = {}): Fix[] {
  const { jitterM = 0, dropFrom = null, dropCount = 0 } = opts as {
    jitterM?: number; dropFrom: number | null; dropCount?: number;
  };
  const out: Fix[] = [];
  let lat = 34.03, lng = -5.0, t = 1_000_000, seq = 0;
  for (let i = 0; i < n; i++) {
    t += 1500;
    lat += 0.00013;
    lng += 0.00011;
    if (dropFrom != null && i >= dropFrom && i < dropFrom + (dropCount ?? 0)) continue;
    const j = (jitterM ?? 0) / 111000;
    out.push({
      lat: lat + (Math.random() - 0.5) * j,
      lng: lng + (Math.random() - 0.5) * j,
      heading: 40, speed: 14, accuracy: 8, seq: ++seq, receivedAt: t,
    });
  }
  return out;
}

// ── 1. Continuous forward motion under realistic GPS jitter ─────────────────
// The original bug: noise made the marker visibly reverse while walking.
{
  const tr = new MotionTrack();
  const fixes = trace(30, { jitterM: 15 });
  for (const f of fixes) tr.push(f);

  let prev: { lat: number; lng: number } | null = null;
  let backward = 0, maxStep = 0;
  for (let now = fixes[0].receivedAt; now <= fixes[fixes.length - 1].receivedAt + 1000; now += 33) {
    const s = tr.sampleAt(now);
    if (!s) continue;
    if (prev) {
      const d = distanceM(prev, s);
      maxStep = Math.max(maxStep, d);
      if (d > 0.01 && Math.abs(shortestAngleDelta(40, bearingDeg(prev, s))) > 120) backward++;
    }
    prev = { lat: s.lat, lng: s.lng };
  }
  console.log(`1. continuity: max per-frame step ${maxStep.toFixed(2)}m, backward frames ${backward}`);
  ok(backward === 0, "marker moved backwards despite only 15m of GPS jitter");
  ok(maxStep < 3, "per-frame jump too large — teleporting rather than gliding");
}

// ── 2. The filter rejects what it must ──────────────────────────────────────
{
  const tr = new MotionTrack();
  const base = trace(5)[0];
  tr.push(base);
  const inaccurate = tr.push({ ...base, seq: 2, accuracy: 300, receivedAt: base.receivedAt + 1500 });
  const teleport = tr.push({ ...base, seq: 3, lat: base.lat + 1, receivedAt: base.receivedAt + 1600 });
  const staleSeq = tr.push({ ...base, seq: 1, receivedAt: base.receivedAt + 1700 });
  console.log(`2. filter: ${inaccurate} / ${teleport} / ${staleSeq}`);
  ok(inaccurate === "inaccurate", "a 300m-accuracy fix was accepted");
  ok(teleport === "teleport", "a ~111km jump was accepted");
  ok(staleSeq === "stale-seq", "an out-of-order packet was accepted");
}

// ── 3. Tunnel: dead-reckon briefly, then admit we've lost them ──────────────
{
  const tr = new MotionTrack();
  for (const f of trace(20, { dropFrom: 10, dropCount: 10 })) tr.push(f);
  const last = tr.latest!;
  const shortly = tr.sampleAt(last.receivedAt + RENDER_DELAY_MS + 2000)!;
  const later = tr.sampleAt(last.receivedAt + RENDER_DELAY_MS + 12000)!;
  const moved = distanceM({ lat: last.lat, lng: last.lng }, shortly);
  console.log(`3. tunnel: +2s moved ${moved.toFixed(1)}m stale=${shortly.stale} | +12s stale=${later.stale}`);
  ok(moved > 5 && !shortly.stale, "froze instantly instead of dead-reckoning through a short outage");
  ok(later.stale, "never reported stale — the UI would keep lying about a lost signal");
}

// ── 4. Rotation: shortest path, rate-limited ────────────────────────────────
{
  const tr = new MotionTrack();
  const t0 = 1_000_000;
  tr.push({ lat: 34.03, lng: -5.0, heading: 350, speed: 14, accuracy: 8, seq: 1, receivedAt: t0 });
  tr.push({ lat: 34.0301, lng: -5.0, heading: 10, speed: 14, accuracy: 8, seq: 2, receivedAt: t0 + 1500 });

  let prev = tr.sampleAt(t0 + RENDER_DELAY_MS)!;
  let maxRate = 0, wrongWay = 0;
  for (let now = t0 + RENDER_DELAY_MS + 33; now <= t0 + RENDER_DELAY_MS + 3000; now += 33) {
    const s = tr.sampleAt(now)!;
    const d = shortestAngleDelta(prev.bearing, s.bearing);
    maxRate = Math.max(maxRate, Math.abs(d) / 0.033);
    if (d < -1) wrongWay++; // 350° → 10° must be +20°, never −340°
    prev = s;
  }
  console.log(`4. rotation: max ${maxRate.toFixed(0)} deg/s, wrong-direction frames ${wrongWay}`);
  ok(wrongWay === 0, "rotated the long way round across the 0/360 boundary");
  ok(maxRate <= 181, "rotation exceeded the rate limit — snapping, not sweeping");
}

// ── 5. SMOOTHNESS: the path must be a curve, not a polygon ──────────────────
// The quality target, derived from a real complaint ("it felt hesitant compared
// with Google Maps"). Before curved interpolation this pipeline measured a p99
// of 2.400 deg and a MAX of 4.42 deg per frame: dead-straight chords punctuated
// by one visible jerk at every GPS fix. The thresholds below are the acceptance
// criteria for that fix and exist to stop it regressing silently.
{
  const TURN_P99_MAX = 0.5;
  const TURN_ABS_MAX = 1.0;

  /** A gently curving drive: 3 deg/s, 14 m/s, fixes every 1.5s. */
  function curvingRun(): { fixes: Fix[]; path: { lat: number; lng: number }[] } {
    let lat = 34.03, lng = -5.0, brg = 45, t = 1_000_000, seq = 0;
    const fixes: Fix[] = [];
    const path: { lat: number; lng: number }[] = [];
    for (let i = 0; i < 40; i++) {
      brg = (brg + 4.5) % 360;
      const step = 21;
      lat += (step * Math.cos((brg * Math.PI) / 180)) / 111320;
      lng += (step * Math.sin((brg * Math.PI) / 180)) / (111320 * Math.cos((lat * Math.PI) / 180));
      t += 1500;
      path.push({ lat, lng });
      fixes.push({ lat, lng, heading: brg, speed: 14, accuracy: 8, seq: ++seq, receivedAt: t });
    }
    return { fixes, path };
  }

  /**
   * A dense route as OSRM actually returns one: vertices sampled along the TRUE
   * curve of the road.
   *
   * Not produced by densifying the coarse path. Linear densification puts
   * vertices every few metres but concentrates every degree of turning at the
   * original coarse vertices — a finely-sampled POLYGON, which is not what a
   * router emits and which no real road resembles. Testing against it would
   * have argued for smoothing dense routes, and smoothing a real route rounds
   * its genuine junction corners and drags the drawn line off the carriageway.
   */
  function densePath(stepM: number) {
    const out: { lat: number; lng: number }[] = [];
    let lat = 34.03, lng = -5.0, brg = 45;
    const perStep = (4.5 * stepM) / 21; // same arc as curvingRun, finer sampling
    const steps = Math.round((40 * 21) / stepM);
    for (let i = 0; i < steps; i++) {
      brg = (brg + perStep) % 360;
      lat += (stepM * Math.cos((brg * Math.PI) / 180)) / 111320;
      lng += (stepM * Math.sin((brg * Math.PI) / 180)) / (111320 * Math.cos((lat * Math.PI) / 180));
      out.push({ lat, lng });
    }
    return out;
  }

  function smoothness(label: string, route: { lat: number; lng: number }[] | null) {
    const { fixes } = curvingRun();
    const tr = new MotionTrack();
    if (route) tr.setRoute(route);
    for (const f of fixes) tr.push(f);

    let prev: { lat: number; lng: number } | null = null;
    let prevPrev: { lat: number; lng: number } | null = null;
    const turns: number[] = [];
    const speeds: number[] = [];
    const offsets: number[] = [];
    const drawn = route ? new Route(route) : null;
    for (let now = fixes[0].receivedAt + RENDER_DELAY_MS + 100;
         now <= fixes[fixes.length - 1].receivedAt - 100; now += 16.67) {
      const s = tr.sampleAt(now);
      if (!s) continue;
      if (prev) {
        const d = distanceM(prev, s);
        speeds.push(d / 0.01667);
        if (prevPrev && distanceM(prevPrev, prev) > 0.01 && d > 0.01) {
          turns.push(Math.abs(shortestAngleDelta(bearingDeg(prevPrev, prev), bearingDeg(prev, s))));
        }
        prevPrev = prev;
      }
      if (drawn) {
        const m = drawn.match(s, 0);
        if (m) offsets.push(m.deviationM);
      }
      prev = { lat: s.lat, lng: s.lng };
    }
    const sorted = [...turns].sort((a, b) => a - b);
    const p99 = sorted[Math.min(sorted.length - 1, Math.ceil(0.99 * sorted.length) - 1)];
    const max = Math.max(...turns);
    const spread = Math.max(...speeds) - Math.min(...speeds);
    const offMax = offsets.length ? Math.max(...offsets) : 0;
    console.log(
      `   ${label.padEnd(30)} p99=${p99.toFixed(3)} max=${max.toFixed(3)} ` +
        `spreadMps=${spread.toFixed(2)} offRouteMax=${route ? offMax.toFixed(2) + "m" : "n/a"}`,
    );

    // A two-point straight line is not a road: the trust gate refuses it and the
    // marker correctly follows free space instead. Asserting it sits on that
    // line would demand the exact bug the gate exists to prevent.
    if (route && tr.onRoute) {
      // THE PROPERTY THAT ACTUALLY MATTERS once a road is attached: the marker
      // must sit ON the line that is drawn. Turn-angle smoothness is the wrong
      // test here — a real dense route genuinely turns ~1 degree per vertex, and
      // demanding less than that forced a spline that ROUNDED real junction
      // corners and dragged the drawn line off the carriageway. The user saw
      // exactly that and called it worse. The marker inheriting the road's own
      // geometry is correct; leaving the road never is.
      ok(offMax < 0.5, `${label}: marker strayed ${offMax.toFixed(2)}m from the drawn route`);
    } else if (!route) {
      ok(p99 < TURN_P99_MAX, `${label}: p99 turn ${p99.toFixed(3)} deg exceeds ${TURN_P99_MAX} — path is polygonal`);
      ok(max < TURN_ABS_MAX, `${label}: max turn ${max.toFixed(3)} deg exceeds ${TURN_ABS_MAX} — visible kink`);
    }
    // Constant speed was already achieved and must not be traded away.
    ok(spread < 1.0, `${label}: speed spread ${spread.toFixed(2)} m/s — motion is surging`);
  }

  console.log("5. smoothness (target p99<0.5deg, max<1.0deg; was 2.400/4.42)");
  const { path } = curvingRun();
  smoothness("no route (spline only)", null);
  smoothness("dense route (~5m, OSRM-like)", densePath(5));
  smoothness("coarse route (21m segments)", path);
  // A two-point straight-line fallback is NOT a road. Snapping to it made the
  // marker jump 7m in a frame (424 m/s) until the route-trust gate was added.
  smoothness("2-point straight-line route", [path[0], path[path.length - 1]]);
}

// ── 6. The rendered offset describes the RENDERED instant ───────────────────
// The seam between "already travelled" and "still to drive", and the countdown
// to the next turn, are both drawn from `sample.routeOffsetM`. If that reported
// the newest RAW fix instead, everything drawn would sit a full render delay
// ahead of the avatar. Measured on a live trip at ~78 km/h the dimmed segment
// ran ~40 m PAST the marker, into road it had not reached.
{
  console.log("6. render offset is in step with the drawn marker");
  const fixes = trace(24);
  const path = fixes.map((f) => ({ lat: f.lat, lng: f.lng }));
  const tr = new MotionTrack();
  tr.setRoute(path);
  for (const f of fixes) tr.push(f);
  const rt = new Route(path);

  let worstGapM = 0;
  let ahead = 0;
  let samples = 0;
  let monotonic = true;
  let prevOffset = -Infinity;
  const start = fixes[0].receivedAt + RENDER_DELAY_MS + 100;
  const end = fixes[fixes.length - 1].receivedAt - 100;
  for (let now = start; now <= end; now += 100) {
    const s = tr.sampleAt(now);
    if (!s || s.routeOffsetM == null) continue;
    samples++;
    if (s.routeOffsetM < prevOffset - 0.01) monotonic = false;
    prevOffset = s.routeOffsetM;

    // Where the reported offset lands on the road, versus where the marker is
    // actually drawn. These are the two things that must not disagree.
    const at = rt.positionAt(s.routeOffsetM);
    if (!at) continue;
    const gap = distanceM(at.point, s);
    worstGapM = Math.max(worstGapM, gap);

    // And it must not be the RAW offset, which describes ~2 s into the future.
    const raw = tr.routeOffsetM;
    if (raw != null && s.routeOffsetM > raw + 1) ahead++;
  }

  ok(samples > 50, `enough matched frames to judge (got ${samples})`);
  ok(
    worstGapM < 1.0,
    `the offset the seam is drawn at tracks the marker (worst gap ${worstGapM.toFixed(2)} m)`,
  );
  ok(ahead === 0, `the rendered offset never runs ahead of the newest fix (${ahead} frames)`);
  ok(monotonic, "the rendered offset never steps backwards");

  // The raw offset must remain available and AHEAD — re-routing decisions want
  // the freshest possible truth, not the delayed render state.
  const rawFinal = tr.routeOffsetM;
  const renderFinal = tr.sampleAt(end)?.routeOffsetM ?? null;
  ok(rawFinal != null && renderFinal != null, "both offsets are exposed");
  if (rawFinal != null && renderFinal != null) {
    ok(rawFinal >= renderFinal - 0.01, "the raw offset is at or ahead of the rendered one");
  }
}

// ── 7. An unmatched fix is not evidence of leaving the road ─────────────────
// This one caused a live re-route storm: unmatched fixes counted as off-route,
// each re-route reset the match history, and the next fixes were unmatched
// again. The 25-recompute budget was gone in minutes.
{
  console.log("7. off-route needs positive evidence, not missing evidence");
  const fixes = trace(12);
  const path = fixes.map((f) => ({ lat: f.lat, lng: f.lng }));

  // (a) A driver perfectly on the road is never off-route.
  const onRoad = new MotionTrack();
  onRoad.setRoute(path);
  for (const f of fixes) onRoad.push(f);
  ok(!onRoad.isOffRoute(45, 3), "a driver following the road is not off-route");

  // (b) A single wild outlier among good fixes — one multipath bounce off a
  //     tall building must never discard a perfectly good road.
  const blip = new MotionTrack();
  blip.setRoute(path);
  for (const f of fixes) blip.push(f);
  const lastFix = fixes[fixes.length - 1];
  blip.push({
    lat: lastFix.lat + 0.0009, lng: lastFix.lng,
    heading: 40, speed: 14, accuracy: 8,
    seq: 900, receivedAt: lastFix.receivedAt + 1500,
  });
  ok(!blip.isOffRoute(45, 3), "one outlier among good fixes is not off-route");

  // (c) THE RE-ROUTE STORM. A new road starts where the driver is now, so
  //     every fix already buffered sits behind its start and measures far
  //     "off" it. Judging a fresh route by the history of the old one made
  //     each re-route trigger the next; the live budget of 25 was spent in
  //     minutes and the professional was left with a stale road and a retry
  //     button. A new route must start with no verdict.
  const longFixes = trace(220);
  const longPath = longFixes.map((f) => ({ lat: f.lat, lng: f.lng }));
  const rerouted = new MotionTrack();
  rerouted.setRoute(longPath);
  for (let i = 0; i < 12; i++) rerouted.push(longFixes[i]);

  // Re-route: a fresh road anchored at the driver's current position.
  const freshRoute = longFixes.slice(11).map((f) => ({ lat: f.lat, lng: f.lng }));
  rerouted.setRoute(freshRoute);
  ok(
    !rerouted.isOffRoute(45, 3),
    "a freshly attached route is not instantly judged abandoned by old fixes",
  );
  // And it still cannot fire until enough NEW fixes have accumulated.
  rerouted.push({
    lat: longFixes[12].lat, lng: longFixes[12].lng,
    heading: 40, speed: 14, accuracy: 8,
    seq: 950, receivedAt: longFixes[12].receivedAt,
  });
  ok(!rerouted.isOffRoute(45, 3), "one fix after a re-route is not enough to re-route again");

  // (d) A real, measured, sustained departure still triggers — ~90 m sideways,
  //     past the 25 m snap limit but very much measured.
  const departed = new MotionTrack();
  departed.setRoute(longPath);
  for (let i = 0; i < 20; i++) departed.push(longFixes[i]);
  let s2 = 800;
  let offCount = 0;
  for (let i = 20; i < 26; i++) {
    departed.push({
      lat: longFixes[i].lat + 0.0008, // ~89 m north of the road
      lng: longFixes[i].lng,
      heading: 40, speed: 14, accuracy: 8,
      seq: ++s2,
      receivedAt: longFixes[i].receivedAt,
    });
    if (departed.isOffRoute(45, 3)) offCount++;
  }
  ok(offCount > 0, "a sustained measured deviation still reports off-route");
}

// ── 8. THE FIELD FAILURE: two sequence-number domains ───────────────────────
// Reproduces exactly what froze the professional's marker for a whole real
// trip. The screen fed this gate from two sources that number their fixes on
// different scales: the pre-departure foreground watch used `Date.now()`
// (~1.79e12), and the post-departure background service restarts its own
// counter at 1. From the instant of departure every real fix was `1 <= 1.79e12`
// and was discarded — permanently, because nothing on the real path cleared
// `lastSeq`. `setNurse` kept updating, so the route and camera still moved and
// the dropped stream looked like a rendering bug.
{
  console.log("8. mixed sequence domains must not be able to freeze the pipeline");
  const fixes = trace(10);

  // (a) The gate itself is correct and must stay strict — this is what protects
  //     the PATIENT, whose fixes arrive over realtime with no ordering.
  const strict = new MotionTrack();
  strict.push({ ...fixes[0], seq: 1_786_000_000_000 });
  let rejectedSmall = 0;
  for (let i = 1; i < 5; i++) {
    if (strict.push({ ...fixes[i], seq: i }) === "stale-seq") rejectedSmall++;
  }
  ok(rejectedSmall === 4, `a huge seq followed by 1,2,3 IS rejected by design (${rejectedSmall}/4)`);
  ok(
    strict.rejected["stale-seq"] === 4,
    "and the rejections are counted, so a live run can prove it",
  );

  // (b) THE FIX, part one: one counter for every source. Renumbering at the
  //     single point of entry makes the collision unreachable.
  const renumbered = new MotionTrack();
  let localSeq = 0;
  let accepted = 0;
  // Pre-departure samples, then post-departure ones that restart at 1 — the
  // exact sequence that failed in the field.
  const incoming = [
    { fix: fixes[0], senderSeq: 1_786_000_000_000 },
    { fix: fixes[1], senderSeq: 1_786_000_001_500 },
    { fix: fixes[2], senderSeq: 1 },
    { fix: fixes[3], senderSeq: 2 },
    { fix: fixes[4], senderSeq: 3 },
    { fix: fixes[5], senderSeq: 4 },
  ];
  for (const { fix } of incoming) {
    if (renumbered.push({ ...fix, seq: ++localSeq }) === null) accepted++;
  }
  ok(accepted === incoming.length, `every fix is accepted when renumbered locally (${accepted}/6)`);
  ok(
    renumbered.rejected["stale-seq"] === 0,
    "stale-seq stays at zero — the value the next drive must show",
  );
  ok(renumbered.latest?.seq === 6, "and the newest fix is the newest one pushed");

  // (c) THE FIX, part two: resetting at the source handover also clears
  //     `lastSeq`, so even a caller that forgot to renumber recovers.
  const handover = new MotionTrack();
  handover.push({ ...fixes[0], seq: 1_786_000_000_000 });
  handover.reset();
  let afterReset = 0;
  for (let i = 1; i < 5; i++) {
    if (handover.push({ ...fixes[i], seq: i }) === null) afterReset++;
  }
  ok(afterReset === 4, `reset() at the handover lets a restarted counter through (${afterReset}/4)`);

  // (d) And the pipeline actually MOVES afterwards — the property the field
  //     test was checking by eye. A frozen buffer renders a frozen marker.
  const moved = new MotionTrack();
  let sq = 0;
  for (const f of trace(12)) moved.push({ ...f, seq: ++sq });
  const t0 = moved.latest!.receivedAt - 6000;
  const a = moved.sampleAt(t0);
  const b = moved.sampleAt(t0 + 3000);
  ok(!!a && !!b && distanceM(a, b) > 5, "the rendered position advances once fixes are accepted");
}

console.log(failures === 0 ? "\nALL MOTION CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
