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
  MIN_ZOOM,
  RESUME_AFTER_MS,
  initialCameraState,
  nextCameraCommand,
  viewportSpanM,
  withRecenterRequest,
  withUserGesture,
  zoomForSpeed,
  type CameraInputs,
} from "./camera";

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

console.log(failures === 0 ? "\nALL CAMERA CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
