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
import { MotionTrack, bearingDeg, distanceM, shortestAngleDelta, RENDER_DELAY_MS, type Fix } from "./motion";

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

  /** Resample a path so vertices sit ~every `stepM` metres, as OSRM returns. */
  function densify(pts: { lat: number; lng: number }[], stepM: number) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const n = Math.max(1, Math.round(distanceM(pts[i], pts[i + 1]) / stepM));
      for (let k = 1; k <= n; k++)
        out.push({
          lat: pts[i].lat + ((pts[i + 1].lat - pts[i].lat) * k) / n,
          lng: pts[i].lng + ((pts[i + 1].lng - pts[i].lng) * k) / n,
        });
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
      prev = { lat: s.lat, lng: s.lng };
    }
    const sorted = [...turns].sort((a, b) => a - b);
    const p99 = sorted[Math.min(sorted.length - 1, Math.ceil(0.99 * sorted.length) - 1)];
    const max = Math.max(...turns);
    const spread = Math.max(...speeds) - Math.min(...speeds);
    console.log(`   ${label.padEnd(30)} p99=${p99.toFixed(3)} max=${max.toFixed(3)} spreadMps=${spread.toFixed(2)}`);
    ok(p99 < TURN_P99_MAX, `${label}: p99 turn ${p99.toFixed(3)} deg exceeds ${TURN_P99_MAX} — path is polygonal`);
    ok(max < TURN_ABS_MAX, `${label}: max turn ${max.toFixed(3)} deg exceeds ${TURN_ABS_MAX} — visible kink`);
    // Constant speed was already achieved and must not be traded away for curvature.
    ok(spread < 1.0, `${label}: speed spread ${spread.toFixed(2)} m/s — motion is surging`);
  }

  console.log("5. smoothness (target p99<0.5deg, max<1.0deg; was 2.400/4.42)");
  const { path } = curvingRun();
  smoothness("no route (spline only)", null);
  smoothness("dense route (~5m, OSRM-like)", densify(path, 5));
  smoothness("coarse route (21m segments)", path);
  // A two-point straight-line fallback is NOT a road. Snapping to it made the
  // marker jump 7m in a frame (424 m/s) until the route-trust gate was added.
  smoothness("2-point straight-line route", [path[0], path[path.length - 1]]);
}

console.log(failures === 0 ? "\nALL MOTION CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
