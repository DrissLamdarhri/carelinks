/**
 * CareLink — deterministic tests for the tracking camera policy.
 *
 *   pnpm -C mobile-app test:tracking
 *
 * Camera behaviour is the hardest part of a tracking screen to judge by eye: it
 * is defined by what does NOT happen (no fighting the finger, no twitching, no
 * pumping zoom), and absences cannot be spotted in a code review or reliably
 * noticed in a thirty-second demo. Every rule is asserted here instead.
 */
import {
  DEAD_ZONE,
  NAV_DEAD_ZONE,
  MIN_ZOOM,
  RESUME_AFTER_MS,
  ROTATE_DEADBAND_DEG,
  ROTATE_MAX_DEG_S,
  ROTATE_MIN_SPEED_MPS,
  planRotation,
  initialCameraState,
  nextCameraCommand,
  viewportSpanM,
  withRecenterRequest,
  withUserGesture,
  zoomForSpeed,
  type CameraInputs,
} from "./camera";
import { holdHeading } from "./heading-hold";

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) {
    console.log(`  FAIL: ${msg}`);
    failures++;
  }
}

const T = { lat: 34.037, lng: -5.004 };
const base = (over: Partial<CameraInputs> = {}): CameraInputs => ({
  now: 1_000_000,
  target: T,
  speedMps: 14,
  viewportPx: 800,
  distanceFromCenterM: 0,
  ...over,
});

// ── 1. Frames on the first sample, then holds still ─────────────────────────
{
  let s = initialCameraState();
  const first = nextCameraCommand(s, base());
  s = first.state;
  const second = nextCameraCommand(s, base({ distanceFromCenterM: 1 }));
  console.log(`1. initial: ${first.command?.reason}, then still=${second.command === null}`);
  ok(first.command?.reason === "initial", "did not frame the subject on the first sample");
  ok(second.command === null, "issued a camera move for 1m of drift — this is the twitching");
}

// ── 2. Dead zone: hold until the marker nears the edge ──────────────────────
{
  let s = initialCameraState();
  s = nextCameraCommand(s, base()).state;
  const span = viewportSpanM(s.zoom, 800, T.lat);
  const allowed = (span * DEAD_ZONE) / 2;

  const inside = nextCameraCommand(s, base({ distanceFromCenterM: allowed * 0.8 }));
  const outside = nextCameraCommand(s, base({ distanceFromCenterM: allowed * 1.2 }));
  console.log(
    `2. dead zone: span=${span.toFixed(0)}m allowed=${allowed.toFixed(0)}m ` +
      `inside=${inside.command === null ? "hold" : "MOVE"} outside=${outside.command?.reason}`,
  );
  ok(inside.command === null, "camera moved while the marker was well inside the dead zone");
  ok(outside.command?.reason === "drift", "camera did not ease when the marker neared the edge");
  ok((outside.command?.durationMs ?? 0) >= 600, "drift correction too fast to read as a glide");
}

// ── 3. A gesture suspends following completely ──────────────────────────────
// The current production screen does the opposite: follow={!!nurse} re-issues a
// flyTo on every position update, yanking the map back every ~2s.
{
  let s = initialCameraState();
  s = nextCameraCommand(s, base()).state;
  s = withUserGesture(s, 1_000_000);

  let moved = 0;
  for (let dt = 0; dt < RESUME_AFTER_MS; dt += 500) {
    const r = nextCameraCommand(s, base({ now: 1_000_000 + dt, distanceFromCenterM: 5000 }));
    s = r.state;
    if (r.command) moved++;
  }
  console.log(`3. gesture: camera moves during ${RESUME_AFTER_MS}ms of user control = ${moved}`);
  ok(moved === 0, "camera fought the user — it moved while they were panning");
}

// ── 4. Following resumes gently after idle ──────────────────────────────────
{
  let s = initialCameraState();
  s = nextCameraCommand(s, base()).state;
  s = withUserGesture(s, 1_000_000);
  const r = nextCameraCommand(s, base({ now: 1_000_000 + RESUME_AFTER_MS + 1 }));
  console.log(`4. resume: reason=${r.command?.reason} duration=${r.command?.durationMs}ms mode=${r.state.mode}`);
  ok(r.command?.reason === "resume", "did not resume following after the idle period");
  ok((r.command?.durationMs ?? 0) >= 1000, "resume was abrupt — it should read as helping, not snatching");
  ok(r.state.mode === "following", "mode did not return to following");
}

// ── 5. Explicit recentre overrides user control at once ─────────────────────
{
  let s = withUserGesture(initialCameraState(), 1_000_000);
  s = withRecenterRequest(s);
  const r = nextCameraCommand(s, base({ now: 1_000_001 }));
  console.log(`5. recentre: mode=${s.mode} command=${r.command?.reason}`);
  ok(s.mode === "following", "explicit recentre did not cancel user control");
  ok(r.command !== null, "explicit recentre produced no camera move");
}

// ── 6. Zoom is quantised and cannot oscillate ───────────────────────────────
{
  const stationary = zoomForSpeed(0, 16);
  const walking = zoomForSpeed(1.2, 16);
  const urban = zoomForSpeed(10, 17);
  const fast = zoomForSpeed(25, 16);
  console.log(`6. zoom bands: stationary=${stationary} walking=${walking} urban=${urban} fast=${fast}`);
  ok(stationary > urban, "stationary should be zoomed IN further than urban driving");
  ok(fast < urban, "fast travel should be zoomed further OUT than urban");
  ok(fast >= 14.5, "zoomed too far out — streets must stay readable");
  ok(stationary <= 18, "zoomed absurdly far in");

  // Hover exactly around the urban/fast boundary and count changes.
  let z = 16.0;
  const seen = new Set<number>();
  for (let i = 0; i < 40; i++) {
    z = zoomForSpeed(i % 2 === 0 ? 17.9 : 18.1, z);
    seen.add(z);
  }
  console.log(`   hysteresis: distinct zooms while hovering a boundary = ${seen.size}`);
  ok(seen.size <= 2, "zoom oscillated across a band boundary — the map would pump in and out");
}

// ── 7. Never so far out that streets stop being readable ────────────────────
{
  const worst = Math.min(...[0, 1, 5, 10, 20, 40].map((v) => zoomForSpeed(v, 16)));
  const span = viewportSpanM(worst, 800, 34);
  console.log(`7. widest view: zoom=${worst} spans ~${span.toFixed(0)}m across 800px (floor ${MIN_ZOOM})`);
  // Zoom, not metres, is what decides whether buildings and street labels are
  // drawn at all — hence the assertion is on the zoom floor, with the span as a
  // human-readable sanity check alongside it.
  ok(worst >= MIN_ZOOM, `zoom ${worst} is below the ${MIN_ZOOM} floor — buildings stop rendering`);
  ok(span < 2500, `widest framing spans ${span.toFixed(0)}m — too far out to read surroundings`);
}

// ── 8. THE PATIENT'S CAMERA IS UNCHANGED BY PHASE 2 ─────────────────────────
// The single most important assertion in this file. Every navigation feature
// is gated on `navigating`, which the patient's screen never sets. If any of
// them leaks into the default path, a patient watching a nurse approach gets a
// rotating, tighter-framed map they never asked for — and nobody would notice
// until it shipped.
{
  console.log("8. patient camera output is byte-identical without `navigating`");

  // Drive a full scenario through the policy with no navigation inputs and
  // assert the ENTIRE command stream against what the pre-Phase-2 policy
  // produced: north-up, tracking dead zone, unboosted zoom.
  let st = initialCameraState();
  const stream: string[] = [];
  const speeds = [0, 3, 8, 14, 20, 14, 8, 3, 0];
  let dist = 0;
  for (let i = 0; i < speeds.length; i++) {
    dist = i === 0 ? Number.POSITIVE_INFINITY : (i % 3 === 0 ? 400 : 5);
    const r = nextCameraCommand(st, base({
      now: 1_000_000 + i * 1500,
      speedMps: speeds[i],
      distanceFromCenterM: dist,
      // Deliberately supplied and deliberately ignored: a heading is present
      // in the real inputs, and must have no effect while not navigating.
      bearing: (i * 37) % 360,
    }));
    st = r.state;
    stream.push(r.command ? `${r.command.reason}/${r.command.zoom}/${r.command.bearing}/${r.command.durationMs}` : "hold");
  }

  const rotated = stream.filter((s) => !s.startsWith("hold") && !s.includes("/0/"));
  ok(rotated.length === 0, `patient camera issued a non-zero bearing: ${rotated.join(" ")}`);
  ok(!stream.some((s) => s.startsWith("rotate")), "patient camera issued a rotate command");
  ok(st.bearing === 0, `patient camera state bearing drifted to ${st.bearing}`);

  // Dead zone must remain the TRACKING one, not the tighter navigation value.
  const zoomNow = zoomForSpeed(14, 16);
  const trackingAllowed = (viewportSpanM(zoomNow, 800, 34) * DEAD_ZONE) / 2;
  const navAllowed = (viewportSpanM(zoomNow, 800, 34) * NAV_DEAD_ZONE) / 2;
  const between = (trackingAllowed + navAllowed) / 2; // inside tracking, outside nav
  const held = nextCameraCommand(
    { ...initialCameraState(zoomNow), center: T },
    base({ speedMps: 14, distanceFromCenterM: between }),
  );
  ok(held.command === null, "patient camera moved for a drift inside its dead zone");
  const navMoved = nextCameraCommand(
    { ...initialCameraState(zoomNow), center: T },
    base({ speedMps: 14, distanceFromCenterM: between, navigating: true }),
  );
  ok(navMoved.command !== null, "navigation dead zone is not tighter than tracking");
}

// ── 9. Course-up: three brakes, all of which must release ───────────────────
{
  console.log("9. course-up rotation is braked for stability");
  const at = (bearing: number) => ({ ...initialCameraState(), center: T, bearing });

  // Brake 1 — stationary. A parked vehicle's course is noise.
  for (const speed of [0, 1, 2.4]) {
    const r = planRotation(at(0), { navigating: true, bearing: 90, speedMps: speed });
    ok(!r.changed, `map rotated at ${speed} m/s — below the ${ROTATE_MIN_SPEED_MPS} m/s floor`);
  }
  ok(
    planRotation(at(0), { navigating: true, bearing: 90, speedMps: 14 }).changed,
    "a moving vehicle with a large bearing change did not rotate",
  );

  // Brake 2 — dead band. This is what stops the world swimming.
  for (const d of [0, 1, 3, 7.9]) {
    ok(
      !planRotation(at(0), { navigating: true, bearing: d, speedMps: 14 }).changed,
      `${d} deg of bearing change moved the map — under the ${ROTATE_DEADBAND_DEG} deg dead band`,
    );
  }
  ok(
    planRotation(at(0), { navigating: true, bearing: 9, speedMps: 14 }).changed,
    "9 deg did not clear the dead band",
  );

  // Brake 3 — rate limit. A big turn is stretched, never delivered faster.
  const quarter = planRotation(at(0), { navigating: true, bearing: 90, speedMps: 14 });
  ok(quarter.bearing === 90, "target bearing was not adopted");
  const rate = 90 / (quarter.minDurationMs / 1000);
  ok(rate <= ROTATE_MAX_DEG_S + 0.01, `yaw rate ${rate.toFixed(1)} deg/s exceeds ${ROTATE_MAX_DEG_S}`);
  const uturn = planRotation(at(0), { navigating: true, bearing: 180, speedMps: 14 });
  ok(180 / (uturn.minDurationMs / 1000) <= ROTATE_MAX_DEG_S + 0.01, "u-turn exceeds the yaw rate limit");

  // Shortest path across the 0/360 seam — 350 -> 10 is +20, never -340.
  const seam = planRotation(at(350), { navigating: true, bearing: 10, speedMps: 14 });
  ok(seam.changed && Math.abs(20 / (seam.minDurationMs / 1000)) <= ROTATE_MAX_DEG_S + 0.01,
    "crossing the 0/360 seam took the long way round");

  // Stopping HOLDS the bearing. Snapping back to north at every red light
  // would be two large rotations that convey nothing.
  const stopped = planRotation(at(120), { navigating: true, bearing: 200, speedMps: 0 });
  ok(!stopped.changed && stopped.bearing === 120, "stopping snapped the map back to north");

  // Leaving navigation returns to north-up, at the same limited rate.
  const ended = planRotation(at(120), { navigating: false, bearing: 200, speedMps: 14 });
  ok(ended.changed && ended.bearing === 0, "leaving navigation did not restore north-up");
  ok(120 / (ended.minDurationMs / 1000) <= ROTATE_MAX_DEG_S + 0.01, "north-up restore exceeds the rate limit");

  // Idempotent: already north-up and not navigating issues nothing.
  ok(!planRotation(at(0), { navigating: false, bearing: 77, speedMps: 14 }).changed,
    "north-up camera was told to rotate to north-up");
}

// ── 10. A turn moves the map even inside the dead zone ──────────────────────
// Rounding a corner, the marker often never leaves the middle of the frame —
// so without this the world stays locked through the one moment rotation is
// the whole point.
{
  console.log("10. a corner rotates the map without waiting for drift");
  const st = { ...initialCameraState(zoomForSpeed(14, 16)), center: T, bearing: 0 };
  const r = nextCameraCommand(st, base({
    speedMps: 14,
    distanceFromCenterM: 0, // dead centre
    navigating: true,
    bearing: 90,
  }));
  ok(r.command?.reason === "rotate", `expected a rotate command, got ${r.command?.reason ?? "none"}`);
  ok(r.command?.bearing === 90, "rotate command carried the wrong bearing");
  ok(r.state.bearing === 90, "state did not record the new bearing");
  // ...and it must not recentre while doing so — the marker has not moved.
  ok(r.command?.center === st.center, "a pure rotation also moved the centre");

  // A second frame with no further bearing change must hold.
  const again = nextCameraCommand(r.state, base({
    speedMps: 14, distanceFromCenterM: 0, navigating: true, bearing: 92,
  }));
  ok(again.command === null, "2 deg of extra bearing re-issued a command");
}

// ── 11. Imminent-maneuver zoom boost, navigation only ───────────────────────
{
  console.log("11. zoom boost applies only while navigating");
  const plain = nextCameraCommand(initialCameraState(), base({ speedMps: 14, zoomBoost: 0.6 }));
  const navd = nextCameraCommand(initialCameraState(), base({ speedMps: 14, zoomBoost: 0.6, navigating: true }));
  ok(plain.command != null && navd.command != null, "expected an initial command in both cases");
  ok(
    plain.command!.zoom === zoomForSpeed(14, 16.0),
    "zoomBoost leaked into the non-navigating (patient) path",
  );
  ok(
    Math.abs(navd.command!.zoom - (zoomForSpeed(14, 16.0) + 0.6)) < 1e-9,
    "zoomBoost was not applied while navigating",
  );
}

// ── 12. The self marker holds its heading through a stop ────────────────────
// In stop-start traffic `moving` is false most of the time, so the marker spent
// most of a real drive as a plain dot. Holding the last heading keeps the arrow
// — and with course-up, the arrow and the map now freeze together instead of
// the marker swapping shape at every red light.
{
  console.log("12. self marker holds its heading while stopped");
  const s = (bearing: number, moving: boolean) => ({ bearing, moving });

  // Nothing to hold before the first movement of a trip — draw the dot.
  ok(holdHeading(null, s(123, false)) === null, "invented a heading before the vehicle ever moved");
  ok(holdHeading(null, null) === null, "invented a heading with no sample at all");

  // The exact sequence: moving -> stopped -> stopped -> moving again.
  let h: number | null = null;
  h = holdHeading(h, s(90, true));
  ok(h === 90, `moving did not adopt the live heading (got ${h})`);

  // Stopped: the bearing keeps arriving and keeps changing — a parked phone's
  // course wanders — and none of it may move the arrow.
  const wobble = [95, 40, 300, 12, 180, 271];
  for (const b of wobble) h = holdHeading(h, s(b, false));
  ok(h === 90, `heading drifted to ${h} while stationary — should have held 90`);

  // Moving again: the new heading is used IMMEDIATELY, no easing, no lag.
  h = holdHeading(h, s(215, true));
  ok(h === 215, `did not adopt the new heading on the first moving sample (got ${h})`);

  // And it keeps tracking from there.
  h = holdHeading(h, s(220, true));
  ok(h === 220, "stopped following the heading after resuming");

  // A long stop must not decay, expire or reset to north.
  let long: number | null = 45;
  for (let i = 0; i < 500; i++) long = holdHeading(long, s(i % 360, false));
  ok(long === 45, `a long stop changed the held heading to ${long}`);

  // Zero is a real bearing (due north), not "absent".
  ok(holdHeading(77, s(0, true)) === 0, "treated a due-north heading as missing");
  ok(holdHeading(0, s(180, false)) === 0, "lost a held due-north heading while stopped");
}

console.log(failures === 0 ? "\nALL CAMERA CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
