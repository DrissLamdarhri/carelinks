/**
 * CareLink — deterministic tests for turn-by-turn guidance.
 *
 *   pnpm -C mobile-app test:tracking
 *
 * Every defect this module was written to fix was invisible in code review and
 * only showed up while driving: an instruction that vanished before its own
 * junction, an instruction that froze on a junction already passed, a distance
 * measured through buildings. None of them can be caught by looking at the
 * screen for thirty seconds in a car park, so they are asserted here instead.
 *
 * The fixture is an L: 500 m due east, then 500 m due north. It is chosen
 * because the crow-flies distance from start to finish (707 m) differs sharply
 * from the road distance (1000 m), so any test that passes by accident on a
 * straight road fails here.
 */
import {
  ARRIVE_ANNOUNCE_M,
  GuidanceRoute,
  IMMINENT_M,
  NOW_M,
  PREPARE_M,
  THEN_WINDOW_M,
  arrivalClock,
  formatDistance,
  instructionText,
  phaseFor,
  type GuidanceStep,
} from "./guidance";
import { distanceM, type LatLng } from "./route";

let failures = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) {
    console.log(`  FAIL: ${msg}`);
    failures++;
  }
}
function near(a: number, b: number, tol: number, msg: string): void {
  ok(Math.abs(a - b) <= tol, `${msg} (got ${a.toFixed(1)}, want ${b.toFixed(1)} ±${tol})`);
}

// ── Fixture ──────────────────────────────────────────────────────────────────
const LAT0 = 34.037;
const LNG0 = -5.004;
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);

const CORNER: LatLng = { lat: LAT0, lng: LNG0 + 500 / M_PER_DEG_LNG };
const END: LatLng = { lat: LAT0 + 500 / M_PER_DEG_LAT, lng: CORNER.lng };

/** Points every 10 m, so the polyline is "dense" exactly like an OSRM route. */
function buildL(): LatLng[] {
  const pts: LatLng[] = [];
  for (let m = 0; m <= 500; m += 10) pts.push({ lat: LAT0, lng: LNG0 + m / M_PER_DEG_LNG });
  for (let m = 10; m <= 500; m += 10) pts.push({ lat: LAT0 + m / M_PER_DEG_LAT, lng: CORNER.lng });
  return pts;
}

const STEPS: GuidanceStep[] = [
  {
    maneuver: { type: "depart", modifier: "straight", location: [LNG0, LAT0] },
    name: "Boulevard Mohammed V",
    duration: 60, // 500 m of this step
  },
  {
    maneuver: { type: "turn", modifier: "left", location: [CORNER.lng, CORNER.lat] },
    name: "Avenue Hassan II",
    ref: "N6",
    duration: 60, // 500 m of this step
  },
  {
    maneuver: { type: "arrive", modifier: "right", location: [END.lng, END.lat] },
    name: "",
    duration: 0,
  },
];

const g = new GuidanceRoute(buildL(), STEPS);
const T = (k: string) => k; // identity: keys are asserted, not translations

console.log("guidance.replay");

// ── Construction ─────────────────────────────────────────────────────────────
ok(g.usable, "an L-shaped route with three steps is usable");
// `depart` is excluded on purpose: it is not an action, it has no junction to
// count down to, and selecting it opened the banner on "let's go · now"
// instead of "500 m · turn left".
ok(g.maneuvers.length === 2, `depart is not an instruction (got ${g.maneuvers.length})`);
ok(
  g.maneuvers.every((m) => m.dir !== "depart"),
  "no maneuver in the instruction list is a departure",
);
near(g.totalM, 1000, 2, "total road length is the L, not the diagonal");
ok(g.totalS === 120, `total routed seconds come from OSRM (got ${String(g.totalS)})`);
near(g.maneuvers[0].offsetM, 500, 2, "the turn sits at the corner");
near(g.maneuvers[1].offsetM, 1000, 2, "arrive sits at the far end");

// Offsets must be non-decreasing, or the instruction order is nonsense.
for (let i = 1; i < g.maneuvers.length; i++) {
  ok(g.maneuvers[i].offsetM >= g.maneuvers[i - 1].offsetM, `maneuver ${i} is not before ${i - 1}`);
}

// ── Distance is measured ALONG THE ROAD ──────────────────────────────────────
// The whole reason this module exists. Crow-flies start→end is 707 m.
{
  const at0 = g.at(0)!;
  near(at0.remainingM, 1000, 3, "remaining distance follows the road, not the diagonal");
  ok(
    Math.abs(distanceM({ lat: LAT0, lng: LNG0 }, END) - 707) < 5,
    "fixture sanity: the diagonal really is ~707 m, so the test can tell them apart",
  );
}

// ── THE INSTRUCTION MUST NOT VANISH BEFORE ITS OWN JUNCTION ──────────────────
// The original bug: advancing within 35 m of the maneuver replaced "turn left"
// with the instruction after it, 35 m before the left.
for (const o of [0, 100, 300, 400, 460, 480, 490, 495, 499]) {
  const at = g.at(o)!;
  ok(
    at.current.instructionKey === "nav_turn_left",
    `at ${o} m the instruction is still the left turn (got ${at.current.instructionKey})`,
  );
  near(at.distanceToManeuverM, 500 - o, 3, `at ${o} m the countdown to the turn`);
}

// ── …AND MUST ADVANCE ONCE IT IS GENUINELY PASSED ────────────────────────────
{
  const passed = g.at(520)!;
  // Assert the STEP advanced, not the wording: 480 m out the arrival maneuver
  // is correctly presented as "continue" (see the arrival section below).
  ok(passed.current.index === 1, "past the corner, the second maneuver is current");
  near(passed.distanceToManeuverM, 480, 3, "and the countdown is to the destination");
}

// A short hold keeps the instruction alive just past the junction, because a
// fix at the corner does not mean the wheels are at the corner.
ok(g.at(505)!.current.instructionKey === "nav_turn_left", "instruction held briefly past the corner");

// ── IT MUST NOT STICK, EVEN IF NO FIX LANDS NEAR THE JUNCTION ────────────────
// The second original bug: a proximity test that never fired left the banner
// frozen on a turn already taken. Jump clean over the corner in one step.
{
  const jumped = g.at(600)!;
  ok(jumped.current.index === 1, "a 600 m jump clean past the corner still advances");
}
// Skip every intermediate maneuver at once.
ok(g.at(999)!.current.instructionKey === "nav_arrive_right", "a jump to the end selects arrive");

// ── IT MUST NEVER GO BACKWARDS ───────────────────────────────────────────────
{
  let lastIdx = -1;
  let regressions = 0;
  for (let o = 0; o <= 1000; o += 7) {
    const idx = g.at(o)!.current.index;
    if (idx < lastIdx) regressions++;
    lastIdx = idx;
  }
  ok(regressions === 0, `the instruction index never rewinds (${regressions} regressions)`);
}

// Past the end it holds on arrive rather than returning nothing — the banner
// must say "you have arrived", not go blank at the door.
ok(g.at(5000)!.current.instructionKey === "nav_arrive_right", "clamps to arrive beyond the end");
ok(g.at(-50)!.current.instructionKey === "nav_turn_left", "clamps a negative offset to the start");

// ── Approach phases ──────────────────────────────────────────────────────────
ok(g.at(0)!.phase === "cruise", `500 m out is cruise`);
ok(g.at(500 - PREPARE_M + 1)!.phase === "prepare", "just inside 400 m is prepare");
ok(g.at(500 - IMMINENT_M + 1)!.phase === "imminent", "just inside 100 m is imminent");
ok(g.at(500 - NOW_M + 1)!.phase === "now", "just inside 25 m is now");
ok(phaseFor(PREPARE_M) === "cruise", "the phase boundaries are exclusive at the top");
ok(phaseFor(0) === "now", "zero distance is now");

// Phase must be monotonic on approach — it may never relax as she gets closer.
{
  const rank = { cruise: 0, prepare: 1, imminent: 2, now: 3 };
  let worst = 0;
  let relaxed = 0;
  for (let o = 0; o <= 499; o += 3) {
    const r = rank[g.at(o)!.phase];
    if (r < worst) relaxed++;
    worst = Math.max(worst, r);
  }
  ok(relaxed === 0, `the approach phase never relaxes while closing (${relaxed} relaxations)`);
}

// ── Routed ETA ───────────────────────────────────────────────────────────────
// The old screen used straightLineKm / 30 km/h. These come from OSRM instead.
near(g.at(0)!.remainingS!, 120, 1, "at the start, the full routed duration");
near(g.at(500)!.remainingS!, 60, 2, "at the corner, half of it");
near(g.at(1000)!.remainingS!, 0, 1, "at the door, none of it");
{
  let increases = 0;
  let prev = Infinity;
  for (let o = 0; o <= 1000; o += 5) {
    const s = g.at(o)!.remainingS!;
    if (s > prev + 0.001) increases++;
    prev = s;
  }
  ok(increases === 0, `remaining time never grows while driving forward (${increases})`);
}

// ── The "then" line ──────────────────────────────────────────────────────────
// Two junctions 500 m apart are not a pair to plan together.
ok(g.at(0)!.next === null, "no 'then' line when the following turn is 500 m later");
{
  // Same L, but with an extra turn 60 m after the corner.
  const near2: GuidanceStep[] = [
    STEPS[0],
    STEPS[1],
    {
      maneuver: {
        type: "turn",
        modifier: "right",
        location: [CORNER.lng, CORNER.lat + 60 / M_PER_DEG_LAT],
      },
      name: "Rue Idriss",
      duration: 30,
    },
    STEPS[2],
  ];
  const g2 = new GuidanceRoute(buildL(), near2);
  const at = g2.at(400)!;
  ok(at.next !== null, "a turn 60 m after the corner IS shown as 'then'");
  ok(at.next?.instructionKey === "nav_turn_right", "and it is the right one");
  ok(
    THEN_WINDOW_M >= 60 && THEN_WINDOW_M < 500,
    "the 'then' window separates the two fixtures meaningfully",
  );
}

// ── Roundabout exits ─────────────────────────────────────────────────────────
{
  const rab = (exit: number | undefined): string => {
    const gr = new GuidanceRoute(buildL(), [
      STEPS[0],
      { maneuver: { type: "roundabout", location: [CORNER.lng, CORNER.lat], exit }, name: "" },
      STEPS[2],
    ]);
    return gr.at(0)!.current.instructionKey;
  };
  ok(rab(3) === "nav_rab_exit_3", "the third exit gets its own natural-language string");
  ok(rab(1) === "nav_rab_exit_1", "so does the first");
  ok(rab(6) === "nav_rab_exit_6", "up to the sixth");
  // Beyond the named range, fall back to the numeric form rather than dropping
  // the number — a driver counting exits needs it.
  ok(rab(9) === "nav_rab_exit_n", "a 9th exit falls back to the numeric form");
  ok(rab(undefined) === "nav_roundabout", "an unknown exit says only what we know");

  const m9 = new GuidanceRoute(buildL(), [
    STEPS[0],
    { maneuver: { type: "roundabout", location: [CORNER.lng, CORNER.lat], exit: 9 }, name: "" },
    STEPS[2],
  ]).at(0)!.current;
  ok(
    instructionText(m9, (k) => (k === "nav_rab_exit_n" ? "exit %s" : k)) === "exit 9",
    "the numeric fallback substitutes the exit number",
  );
}

// ── Road labels ──────────────────────────────────────────────────────────────
ok(g.maneuvers[0].road === "N6 · Avenue Hassan II", "ref and name are shown together");
ok(g.maneuvers[1].road === null, "an unnamed road yields no label rather than an empty line");
{
  const named = new GuidanceRoute(buildL(), [
    STEPS[0],
    { ...STEPS[1], ref: undefined },
    STEPS[2],
  ]);
  ok(named.maneuvers[0].road === "Avenue Hassan II", "a name without a ref stands alone");
}

// ── Degraded input ───────────────────────────────────────────────────────────
ok(!new GuidanceRoute(buildL(), []).usable, "a route with no steps is not usable");
ok(new GuidanceRoute([], STEPS).at(0) === null, "an empty geometry guides nothing");
{
  // The straight-line fallback `fetchRoute` returns on failure: two points, no
  // steps. It must degrade, never produce confident instructions.
  const flat = new GuidanceRoute([{ lat: LAT0, lng: LNG0 }, END], []);
  ok(!flat.usable, "the two-point routing fallback is not usable for guidance");
}
{
  // A router that supplies no durations must yield no ETA rather than a zero.
  const noDur = new GuidanceRoute(
    buildL(),
    STEPS.map((st) => ({ ...st, duration: undefined })),
  );
  ok(noDur.totalS === null, "no durations means no total");
  ok(noDur.at(0)!.remainingS === null, "and no remaining time, rather than 0 min");
}

// ── "You have arrived" must not be said from a kilometre away ────────────────
// Recorded from a real OSRM route in Fès: the last turn was 1.6 km from the
// door, so the arrive maneuver became current there and the banner announced
// arrival for the whole final stretch.
{
  const far = g.at(520)!; // 480 m still to drive
  ok(far.current.instructionKey === "nav_continue", "far from the door, the instruction is 'continue'");
  ok(far.current.dir === "straight", "and the glyph is a straight arrow, not a flag");
  ok(
    far.current.road === "N6 · Avenue Hassan II",
    `and it names the road under the wheels (got ${String(far.current.road)})`,
  );
  near(far.distanceToManeuverM, 480, 3, "while the countdown still runs to the destination");

  const close = g.at(1000 - ARRIVE_ANNOUNCE_M + 20)!;
  ok(close.current.instructionKey === "nav_arrive_right", "inside 300 m it becomes a real arrival");
  ok(close.current.dir === "arrive", "and the glyph becomes the flag");

  // The boundary must not flap: crossing it once must be the only change.
  let flips = 0;
  let prev = "";
  for (let o = 520; o <= 1000; o += 5) {
    const k = g.at(o)!.current.instructionKey;
    if (prev && k !== prev) flips++;
    prev = k;
  }
  ok(flips === 1, `the arrival wording changes exactly once on approach (got ${flips})`);
}

// ── OSRM's redundant "exit roundabout" step is collapsed ─────────────────────
{
  const withExitStep = (entryExit: number | undefined): string[] => {
    const gr = new GuidanceRoute(buildL(), [
      STEPS[0],
      {
        maneuver: { type: "roundabout", location: [CORNER.lng, CORNER.lat], exit: entryExit },
        name: "Rue du Rond-Point",
      },
      {
        maneuver: {
          type: "exit roundabout",
          location: [CORNER.lng, CORNER.lat + 25 / M_PER_DEG_LAT],
        },
        name: "Rue de Sortie",
      },
      STEPS[2],
    ]);
    return gr.maneuvers.map((m) => m.instructionKey);
  };

  const collapsed = withExitStep(2);
  ok(
    !collapsed.includes("nav_roundabout_leave"),
    `"leave the roundabout" is dropped when the exit was already numbered (${collapsed.join(", ")})`,
  );
  ok(collapsed.includes("nav_rab_exit_2"), "the numbered entry survives");

  // When the router gave no exit number, that instruction is the only guidance
  // there is and must NOT be collapsed away.
  const kept = withExitStep(undefined);
  ok(
    kept.includes("nav_roundabout_leave"),
    `"leave the roundabout" survives an unnumbered entry (${kept.join(", ")})`,
  );
}

// ── Distance formatting ──────────────────────────────────────────────────────
{
  const tf = (k: string) => (k === "unit_km" ? "km" : k === "unit_m" ? "m" : k === "decimal_sep" ? "," : k);
  ok(formatDistance(0, tf) === "0 m", "zero");
  ok(formatDistance(7, tf) === "10 m", "single metres round to 10");
  ok(formatDistance(84, tf) === "80 m", "under 100 m rounds to 10");
  ok(formatDistance(237, tf) === "250 m", "over 100 m rounds to 50");
  ok(formatDistance(1240, tf) === "1,2 km", "kilometres use the locale decimal separator");
  ok(formatDistance(12400, tf) === "12 km", "above 10 km, no false precision");
  ok(formatDistance(-5, tf) === "0 m", "a negative distance never renders as negative");

  // Quantisation is the point: the figure must hold still long enough to read.
  const seen = new Set<string>();
  for (let m = 100; m <= 400; m++) seen.add(formatDistance(m, tf));
  ok(seen.size <= 8, `100-400 m collapses to a few readable values (got ${seen.size})`);
}

// ── Arrival clock ────────────────────────────────────────────────────────────
{
  const base = new Date(2026, 7, 9, 14, 20, 0);
  ok(arrivalClock(12 * 60, base) === "14:32", "twelve minutes out");
  ok(arrivalClock(0, base) === "14:20", "no time left is now");
  ok(arrivalClock(45 * 60, base) === "15:05", "crossing the hour");
  ok(arrivalClock(3 * 60, new Date(2026, 7, 9, 9, 5, 0)) === "09:08", "single digits are padded");
}

console.log(failures === 0 ? "  all guidance assertions passed" : `  ${failures} FAILURES`);
if (failures > 0) process.exit(1);
