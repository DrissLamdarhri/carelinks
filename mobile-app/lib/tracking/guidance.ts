/**
 * CareLink — turn-by-turn guidance.
 * ────────────────────────────────────────────────────────────────────────────
 * Turns an OSRM step list plus "how far along the road am I" into the single
 * question a professional actually has at a junction: WHAT DO I DO, and HOW FAR
 * UNTIL I DO IT.
 *
 * Pure, like `route.ts` and `camera.ts`: no React, no MapLibre, no I/O, no i18n
 * import. Localisation enters only as a `t` function passed by the caller, the
 * same way `careTypeLabel` does it. That keeps the whole thing replayable
 * headlessly — see `guidance.replay.ts` — which matters because every defect
 * this module exists to fix was invisible in code review and only showed up
 * while driving.
 *
 * TWO DECISIONS CARRY THE WHOLE DESIGN
 *
 * 1. DISTANCE IS MEASURED ALONG THE ROAD, NEVER AS THE CROW FLIES.
 *    The previous banner used `haversine(me, maneuver.location)`. Approaching a
 *    turn around a block that reads "80 m" when 200 m of tarmac remain, and it
 *    is wrong in the dangerous direction — it tells you to turn early.
 *
 * 2. THE STEP ADVANCES ON ROUTE OFFSET, NEVER ON PROXIMITY.
 *    The previous banner advanced when within 35 m of the CURRENT maneuver's
 *    own location. Since `steps[i].maneuver.location` *is* the junction, that
 *    replaced "turn left" with the instruction after it 35 m before the left —
 *    discarding the instruction exactly when it was needed. And if no fix ever
 *    landed inside that 35 m circle (fixes arrive ~21 m apart at 50 km/h, and
 *    dropouts are routine) the index never advanced at all and the banner froze
 *    on a turn already taken.
 *
 *    Offsets solve both. `Route.match` searches forward only, so the offset is
 *    monotonic by construction: the instruction cannot go backwards on a noisy
 *    fix, cannot stick, and skipping two maneuvers at once resolves correctly
 *    because selection is a search rather than an increment.
 */

import { Route, type LatLng } from "./route";

/**
 * The subset of an OSRM step this module needs.
 *
 * Declared structurally rather than imported from `lib/routing.ts` so that this
 * file has no dependency outside `./route` — it is compiled standalone by
 * `pnpm test:tracking`, which has no path aliases. `RouteStep[]` satisfies it.
 */
export type GuidanceStep = {
  maneuver: {
    type?: string;
    modifier?: string;
    location: [number, number];
    exit?: number;
  };
  name: string;
  ref?: string;
  duration?: number;
};

/** Normalised maneuver direction — chooses the icon and nothing else. */
export type ManeuverDir =
  | "depart"
  | "straight"
  | "left"
  | "slight-left"
  | "sharp-left"
  | "right"
  | "slight-right"
  | "sharp-right"
  | "uturn"
  | "roundabout"
  | "merge"
  | "fork-left"
  | "fork-right"
  | "ramp"
  | "arrive";

export type Maneuver = {
  /** Position in the step list. */
  index: number;
  /** Distance along the route to this maneuver, in metres from the start. */
  offsetM: number;
  dir: ManeuverDir;
  /** i18n key for the instruction verb. */
  instructionKey: string;
  /** Roundabout exit number, 1-based, when the router supplied one. */
  exit: number | null;
  /** Street to show beneath the verb — the road taken ONTO. May be null. */
  road: string | null;
  /**
   * The road being travelled to REACH this maneuver.
   *
   * Needed because "you have arrived" is the wrong thing to say two kilometres
   * out. Far from the destination the banner says "continue" instead, and the
   * road it names has to be the one under the wheels — which is the previous
   * step's, not this one's.
   */
  fromRoad: string | null;
};

export type NavPhase = "cruise" | "prepare" | "imminent" | "now";

export type Guidance = {
  /** The maneuver being driven toward. */
  current: Maneuver;
  /** The one after it — only set when close enough to be worth showing. */
  next: Maneuver | null;
  /** Road distance still to drive before `current`, in metres. */
  distanceToManeuverM: number;
  phase: NavPhase;
  /** Road distance to the destination, in metres. */
  remainingM: number;
  /** Routed seconds to the destination, or null when the router gave none. */
  remainingS: number | null;
  /** True once the last real maneuver is the one being driven toward. */
  arriving: boolean;
};

// ── Thresholds ───────────────────────────────────────────────────────────────
// Exported so the banner's styling and the tests read the same numbers rather
// than each carrying their own copy.

/** Below this, the maneuver is happening now. */
export const NOW_M = 25;
/** Below this, commit to the turn: accent colour, tighter camera later. */
export const IMMINENT_M = 100;
/** Below this, start preparing — show the "then" line, expand the banner. */
export const PREPARE_M = 400;
/**
 * Only show the "then" maneuver when it follows this closely.
 *
 * The value of a "then" line is handling two junctions too close together to
 * react to separately. A maneuver 800 m later is not that; showing it is noise
 * competing with the instruction that matters.
 */
export const THEN_WINDOW_M = 150;
/**
 * Keep an instruction on screen this far PAST its junction.
 *
 * A fix that map-matches to the corner does not mean the wheels are at the
 * corner — the offset carries the pipeline's own render delay and the GPS's
 * own error, so dropping the instruction the instant `offset == maneuver`
 * takes "turn left" off the screen while she is still short of the left.
 *
 * The sign matters and is easy to get backwards. An earlier draft of this
 * module looked AHEAD by 10 m instead of holding past by 8, which advanced the
 * banner ten metres BEFORE every junction — a milder version of the exact
 * defect this file exists to remove.
 */
const HOLD_PAST_M = 8;

/**
 * Distance at which arrival stops being a heading and becomes an instruction.
 *
 * Without this the banner announced "Vous êtes arrivé — destination à gauche"
 * the moment the last turn was passed, which on a real Fès route was 1.6 km
 * from the door — visible in the recorded drive that prompted this. Further out
 * than this the honest instruction is "continue on the road you are on", with
 * the distance counting down to the destination exactly as before.
 */
export const ARRIVE_ANNOUNCE_M = 300;

// ── OSRM maneuver → direction + instruction key ──────────────────────────────

const MODIFIER_DIR: Record<string, ManeuverDir> = {
  left: "left",
  "slight left": "slight-left",
  "sharp left": "sharp-left",
  right: "right",
  "slight right": "slight-right",
  "sharp right": "sharp-right",
  uturn: "uturn",
  straight: "straight",
};

const TURN_KEY: Record<ManeuverDir, string> = {
  depart: "nav_start",
  straight: "nav_straight",
  left: "nav_turn_left",
  "slight-left": "nav_slight_left",
  "sharp-left": "nav_sharp_left",
  right: "nav_turn_right",
  "slight-right": "nav_slight_right",
  "sharp-right": "nav_sharp_right",
  uturn: "nav_uturn",
  roundabout: "nav_roundabout",
  merge: "nav_merge",
  "fork-left": "nav_fork_left",
  "fork-right": "nav_fork_right",
  ramp: "nav_off_ramp",
  arrive: "you_arrived",
};

/** Highest roundabout exit with its own natural-language string. */
const MAX_NAMED_EXIT = 6;

function classify(
  type: string | undefined,
  modifier: string | undefined,
  exit: number | null,
): { dir: ManeuverDir; instructionKey: string } {
  const mod = modifier ?? "";
  const dirFromMod = MODIFIER_DIR[mod] ?? "straight";

  switch (type) {
    case "depart":
      return { dir: "depart", instructionKey: "nav_start" };

    case "arrive":
      // OSRM's modifier on `arrive` means "the destination is on your left /
      // right" — genuinely useful at the door, and free.
      if (mod.includes("left")) return { dir: "arrive", instructionKey: "nav_arrive_left" };
      if (mod.includes("right")) return { dir: "arrive", instructionKey: "nav_arrive_right" };
      return { dir: "arrive", instructionKey: "you_arrived" };

    case "roundabout":
    case "rotary":
    case "roundabout turn":
      if (exit != null && exit >= 1 && exit <= MAX_NAMED_EXIT) {
        return { dir: "roundabout", instructionKey: `nav_rab_exit_${exit}` };
      }
      // Exit number unknown or implausibly high — say what we know rather than
      // inventing a number the driver would then count against.
      return { dir: "roundabout", instructionKey: exit != null ? "nav_rab_exit_n" : "nav_roundabout" };

    case "exit roundabout":
    case "exit rotary":
      return { dir: "roundabout", instructionKey: "nav_roundabout_leave" };

    case "merge":
      return { dir: "merge", instructionKey: "nav_merge" };

    case "on ramp":
      return { dir: "ramp", instructionKey: "nav_on_ramp" };

    case "off ramp":
      return { dir: "ramp", instructionKey: "nav_off_ramp" };

    case "fork":
      if (mod.includes("left")) return { dir: "fork-left", instructionKey: "nav_fork_left" };
      if (mod.includes("right")) return { dir: "fork-right", instructionKey: "nav_fork_right" };
      return { dir: "straight", instructionKey: "nav_straight" };

    case "end of road":
      return { dir: dirFromMod, instructionKey: TURN_KEY[dirFromMod] };

    case "new name":
    case "continue":
    case "notification":
    case "use lane":
      // A road that changes name under you is not a maneuver you perform. Only
      // dignify it with a turn instruction if the router says it bends.
      if (dirFromMod !== "straight") return { dir: dirFromMod, instructionKey: TURN_KEY[dirFromMod] };
      return { dir: "straight", instructionKey: "nav_continue" };

    case "turn":
    default:
      return { dir: dirFromMod, instructionKey: TURN_KEY[dirFromMod] };
  }
}

/** "N6 · Avenue Hassan II", "Avenue Hassan II", "N6", or null. */
function roadLabel(name: string, ref: string | undefined): string | null {
  const n = name.trim();
  const r = (ref ?? "").trim();
  if (n && r && n !== r) return `${r} · ${n}`;
  return n || r || null;
}

/**
 * A route with its maneuvers resolved to distances along it.
 *
 * Built once per fetched route and then queried every frame, so construction
 * does the expensive work (matching each maneuver onto the polyline) and `at()`
 * is a binary search plus arithmetic.
 */
export class GuidanceRoute {
  readonly route: Route;
  readonly maneuvers: Maneuver[];
  /** Total drawn road length in metres. */
  readonly totalM: number;
  /** Total routed seconds, or null when the router supplied no durations. */
  readonly totalS: number | null;
  /**
   * Offset/elapsed-time pairs used ONLY to interpolate the ETA.
   *
   * Kept separate from `maneuvers` because the two lists differ: `depart` is
   * excluded from the instruction list but its duration still has to count
   * toward the journey, and the pair (0 m, 0 s) has to exist so that a position
   * before the first instruction interpolates instead of extrapolating
   * backwards off the end of the table.
   */
  private readonly timeOffsets: number[];
  private readonly timeCum: number[];

  constructor(coords: LatLng[], steps: GuidanceStep[]) {
    this.route = new Route(coords);
    this.totalM = this.route.length;

    const maneuvers: Maneuver[] = [];
    const timeOffsets: number[] = [0];
    const timeCum: number[] = [0];
    let elapsed = 0;
    let anyDuration = false;
    // Forward-only cursor. Roads double back at hairpins and roundabouts, and a
    // global nearest-point search would happily place a later maneuver BEFORE
    // an earlier one, which would make the instruction order nonsense.
    let cursorM = 0;
    /** Road under the wheels while approaching the step being processed. */
    let prevRoad: string | null = null;
    /** True when the last emitted instruction already named a roundabout exit. */
    let exitAlreadyAnnounced = false;

    for (const st of steps) {
      const [lng, lat] = st.maneuver.location;
      const m = this.route.match({ lat, lng }, cursorM);
      // A maneuver that cannot be placed on the geometry we are drawing is not
      // actionable — skipping it is strictly better than guessing an offset and
      // counting down to the wrong junction.
      if (!m) continue;
      cursorM = m.offsetM;

      if (m.offsetM > timeOffsets[timeOffsets.length - 1]) {
        timeOffsets.push(m.offsetM);
        timeCum.push(elapsed);
      }

      const type = st.maneuver.type;
      const road = roadLabel(st.name, st.ref);
      const exit = typeof st.maneuver.exit === "number" ? st.maneuver.exit : null;

      // OSRM emits a roundabout as TWO steps: the entry (which carries the exit
      // number) and a separate "exit roundabout". Rendering both gave the nurse
      // "take the 2nd exit" followed 25 m later by "leave the roundabout" — the
      // second says nothing the first did not, and it arrives while she is
      // mid-island counting exits. Collapse it, but only when the entry
      // actually named an exit; when it did not, "leave the roundabout" is the
      // only guidance there is and must survive.
      const redundantExit =
        (type === "exit roundabout" || type === "exit rotary") && exitAlreadyAnnounced;

      // `depart` is not something you DO — it has no junction to count down to,
      // and selecting it left the banner opening on "let's go · now" instead of
      // "500 m · turn left". Its duration still counts toward the ETA above;
      // only its instruction is dropped.
      if (type !== "depart" && !redundantExit) {
        const { dir, instructionKey } = classify(type, st.maneuver.modifier, exit);
        maneuvers.push({
          index: maneuvers.length,
          offsetM: m.offsetM,
          dir,
          instructionKey,
          exit,
          road,
          fromRoad: prevRoad,
        });
        exitAlreadyAnnounced =
          (type === "roundabout" || type === "rotary" || type === "roundabout turn") && exit != null;
      }

      prevRoad = road ?? prevRoad;

      if (typeof st.duration === "number" && Number.isFinite(st.duration)) {
        elapsed += Math.max(0, st.duration);
        anyDuration = true;
      }
    }

    this.maneuvers = maneuvers;
    this.timeOffsets = timeOffsets;
    this.timeCum = timeCum;
    this.totalS = anyDuration ? elapsed : null;
  }

  /** False when there is nothing to guide with — draw the degraded banner. */
  get usable(): boolean {
    return this.route.usable && this.maneuvers.length > 0;
  }

  /**
   * Guidance at a distance along the route.
   *
   * `offsetM` must come from the SAME coordinate array this was built from —
   * in practice `TrackingStore.routeOffsetM`, which is map-matched against the
   * identical points. Two `Route` instances over one array are deterministic,
   * so the offsets agree by construction rather than by coincidence.
   */
  at(offsetM: number): Guidance | null {
    if (!this.usable) return null;
    const o = Math.max(0, Math.min(this.totalM, offsetM));

    // The maneuver being driven toward: the first one not yet behind us.
    // `depart` sits at offset 0 and drops out as soon as we have moved past the
    // hold window, without needing a special case.
    let idx = -1;
    for (let i = 0; i < this.maneuvers.length; i++) {
      if (this.maneuvers[i].offsetM + HOLD_PAST_M > o) {
        idx = i;
        break;
      }
    }
    // Past the final maneuver — hold on it rather than returning nothing, so
    // the banner reads "you have arrived" instead of going blank at the door.
    if (idx === -1) idx = this.maneuvers.length - 1;

    const raw = this.maneuvers[idx];
    const distanceToManeuverM = Math.max(0, raw.offsetM - o);

    // "You have arrived" is a statement about NOW. Said with 1.6 km still to
    // drive — which is exactly what the last turn of a real Fès route produced
    // — it is simply false, and it removes the only instruction the nurse had.
    // Far out, the truthful instruction is to stay on the current road; the
    // countdown to the door is unchanged either way.
    const current: Maneuver =
      raw.dir === "arrive" && distanceToManeuverM > ARRIVE_ANNOUNCE_M
        ? { ...raw, dir: "straight", instructionKey: "nav_continue", road: raw.fromRoad }
        : raw;

    const following = this.maneuvers[idx + 1] ?? null;
    const next =
      following && following.offsetM - raw.offsetM <= THEN_WINDOW_M ? following : null;

    return {
      current,
      next,
      distanceToManeuverM,
      phase: phaseFor(distanceToManeuverM),
      remainingM: Math.max(0, this.totalM - o),
      remainingS: this.remainingSecondsAt(o),
      arriving: idx === this.maneuvers.length - 1,
    };
  }

  /**
   * Routed seconds left, interpolated inside the current step.
   *
   * This is what replaces `straightLineKm / 30 km/h`. OSRM's durations already
   * encode road class and turn costs, so a motorway kilometre and a medina
   * kilometre stop counting the same — which is the whole reason the old ETA
   * was untrustworthy in the one city this app ships in.
   */
  private remainingSecondsAt(o: number): number | null {
    if (this.totalS == null) return null;
    const xs = this.timeOffsets;
    const ys = this.timeCum;
    const last = xs.length - 1;

    // Beyond the final maneuver there is no routed time left. Any metres still
    // showing are the short leg appended to reach the actual door.
    if (last === 0 || o >= xs[last]) return 0;

    let i = 0;
    while (i < last - 1 && xs[i + 1] <= o) i++;

    const span = xs[i + 1] - xs[i];
    const f = span > 0 ? Math.max(0, Math.min(1, (o - xs[i]) / span)) : 0;
    const elapsed = ys[i] + (ys[i + 1] - ys[i]) * f;
    return Math.max(0, this.totalS - elapsed);
  }
}

/** Which approach state a distance-to-maneuver falls in. */
export function phaseFor(distanceM: number): NavPhase {
  if (distanceM < NOW_M) return "now";
  if (distanceM < IMMINENT_M) return "imminent";
  if (distanceM < PREPARE_M) return "prepare";
  return "cruise";
}

// ── Formatting ───────────────────────────────────────────────────────────────

/**
 * Distance as a driver should read it — QUANTISED, and coarser the further away
 * it is.
 *
 * A figure ticking through every metre reads as jitter and is unusable at
 * speed; the eye needs a number that holds still long enough to be read. The
 * steps below are the ones navigation products converge on: 50 m granularity
 * through the approach, 10 m in the final stretch where it is worth being
 * precise, and kilometres once the exact figure stops mattering.
 */
export function formatDistance(metres: number, t: (k: string) => string): string {
  const m = Math.max(0, metres);
  if (m >= 1000) {
    const km = m / 1000;
    // One decimal below 10 km, none above — "12,4 km" is false precision.
    const text = km >= 10 ? String(Math.round(km)) : km.toFixed(1).replace(".", t("decimal_sep"));
    return `${text} ${t("unit_km")}`;
  }
  const step = m >= 100 ? 50 : 10;
  return `${Math.round(m / step) * step} ${t("unit_m")}`;
}

/** The instruction verb, localised. Street name is rendered separately. */
export function instructionText(m: Maneuver, t: (k: string) => string): string {
  const text = t(m.instructionKey);
  // Only the numeric fallback carries a placeholder; every other exit has its
  // own natural-language string, because Arabic ordinals are gendered and
  // cannot be produced by substituting a digit.
  if (m.instructionKey === "nav_rab_exit_n" && m.exit != null) {
    return text.replace("%s", String(m.exit));
  }
  return text;
}

/**
 * Clock time of arrival, e.g. "14:32".
 *
 * A professional planning a day reads an arrival time far faster than a
 * duration — "am I making my 15:00?" is answered directly instead of by mental
 * arithmetic. Both are shown; this is the one that gets the glance.
 */
export function arrivalClock(remainingS: number, now: Date = new Date()): string {
  const at = new Date(now.getTime() + remainingS * 1000);
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Duration in whole minutes, floored at 1 — "0 min" is never informative. */
export function minutesFrom(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}
