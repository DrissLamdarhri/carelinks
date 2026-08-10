/**
 * CareLink — a simulated human driver.
 * ────────────────────────────────────────────────────────────────────────────
 * Produces the position stream a real phone in a real car would produce, so the
 * tracking experience can be judged on input that behaves like a person rather
 * than like a metronome.
 *
 * WHY A PHYSICS MODEL AND NOT A LERP
 *
 * The previous simulator advanced a constant distance every tick and published
 * on a perfect 1500ms interval. Nothing on Earth drives like that: it never
 * stopped, never accelerated, never wandered within its lane, and its fixes
 * arrived with a regularity no operating system delivers. Judging "does this
 * feel like a real person driving?" against that input cannot work — the honest
 * answer would always be no, and the fault would lie with the test, not the
 * pipeline. We have already been caught once by a simulator that drove a path
 * unrelated to the route; this is the same mistake wearing better clothes.
 *
 * WHAT ACTUALLY READS AS HUMAN
 *
 *  • STOPPING. The single biggest cue. A car that sits completely still at a
 *    junction for eight seconds and then pulls away is unmistakably driven by
 *    a person; one that glides for four minutes without pausing is an object on
 *    rails. Everything else here is a refinement on top of this.
 *  • Accelerating from rest rather than appearing at cruising speed.
 *  • Braking BEFORE a bend, not through it.
 *  • Sitting slightly off the centreline, and drifting within the lane.
 *  • Hesitating for a moment after a stop, the way people do.
 *  • Fixes arriving irregularly, because the OS is busy doing other things.
 *
 * Deterministic given a seed, so two runs are the same experiment.
 */
import { Route, type LatLng } from "./route";

export type DriverPersonality = "calm" | "normal" | "aggressive";

type Profile = {
  /** Preferred cruising speed, m/s. */
  cruise: number;
  /** Comfortable acceleration / braking, m/s². */
  accel: number;
  decel: number;
  /** Lateral acceleration tolerated in a bend — how hard they corner. */
  aLat: number;
  /** Distance between junction stops, metres [min, max]. */
  stopEvery: [number, number];
  /** How long they wait when stopped, ms [min, max]. */
  dwell: [number, number];
  /** Pause after the light changes before actually moving, ms [min, max]. */
  hesitate: [number, number];
  /** Lane wander amplitude, metres. */
  wander: number;
};

const PROFILES: Record<DriverPersonality, Profile> = {
  calm: {
    cruise: 8.5, accel: 1.0, decel: 1.6, aLat: 1.3,
    stopEvery: [200, 400], dwell: [5000, 11000], hesitate: [700, 1600], wander: 0.45,
  },
  normal: {
    cruise: 11.5, accel: 1.7, decel: 2.5, aLat: 2.1,
    stopEvery: [260, 520], dwell: [3000, 7000], hesitate: [350, 900], wander: 0.8,
  },
  aggressive: {
    cruise: 15.5, accel: 2.7, decel: 3.6, aLat: 3.1,
    stopEvery: [340, 700], dwell: [1200, 3200], hesitate: [80, 350], wander: 1.25,
  },
};

/** Deterministic PRNG (mulberry32) — two runs with one seed are identical. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DriverSample = {
  /** Position INCLUDING lane offset — not the road centreline. */
  point: LatLng;
  /** Direction of actual travel, degrees. */
  heading: number;
  /** Current speed, m/s. Zero while stopped. */
  speed: number;
  /** Distance travelled along the route, metres. */
  offsetM: number;
  /** True while halted at a junction. */
  stopped: boolean;
};

const DEG = Math.PI / 180;

/**
 * A driver following a route.
 *
 * Advance it with `tick(dtSeconds)` at a fixed, small step (the simulator uses
 * 10 Hz) and read `sample()` whenever a GPS fix should be emitted. Separating
 * the physics rate from the publish rate is what allows fixes to arrive
 * irregularly without the motion itself becoming irregular.
 */
export class SimulatedDriver {
  private route: Route;
  private readonly p: Profile;
  private readonly rnd: () => number;

  private offsetM = 0;
  private speed = 0;
  /** Signed metres from the centreline; positive is to the right. */
  private lateral = 0;
  private lateralTarget = 0;
  private nextStopAtM: number;
  private stopUntil = 0;
  private clockMs = 0;
  private heading = 0;

  constructor(route: Route, personality: DriverPersonality = "normal", seed = 7) {
    this.route = route;
    this.p = PROFILES[personality];
    this.rnd = seeded(seed);
    this.nextStopAtM = this.range(this.p.stopEvery);
    this.heading = route.positionAt(0)?.bearing ?? 0;
  }

  /** Swap the road mid-journey (a wrong turn) without losing vehicle state. */
  setRoute(route: Route): void {
    this.route = route;
    this.offsetM = 0;
    this.nextStopAtM = this.range(this.p.stopEvery);
  }

  /**
   * Arrived.
   *
   * NOT `offsetM >= length`. The driver brakes to a halt a few metres short of
   * the end — which is correct, since you stop AT the door rather than driving
   * through it — so that test never becomes true and the trip runs forever at
   * zero speed. Measured before this fix: a 2.1km route still "in progress"
   * after ten minutes, having actually finished in four.
   */
  get done(): boolean {
    const remaining = this.route.length - this.offsetM;
    if (remaining <= 1.5) return true;
    return this.speed === 0 && remaining < 12 && this.offsetM > 20;
  }

  get progress(): number {
    return this.route.length > 0 ? this.offsetM / this.route.length : 1;
  }

  private range([lo, hi]: [number, number]): number {
    return lo + this.rnd() * (hi - lo);
  }

  /**
   * The speed a bend allows.
   *
   * Derived from lateral acceleration: on a corner of radius R, holding v
   * requires v²/R sideways. Solving for the comfortable limit is why the car
   * slows BEFORE the turn rather than sailing through it, which is one of the
   * clearest tells between a driven vehicle and an animated one.
   */
  private cornerLimit(): number {
    const look = Math.max(18, this.speed * 2.2);
    const a = this.route.smoothBearingAt(this.offsetM, 10);
    const b = this.route.smoothBearingAt(Math.min(this.route.length, this.offsetM + look), 10);
    if (a == null || b == null) return this.p.cruise;
    const turn = Math.abs((((b - a) % 360) + 540) % 360 - 180) * DEG;
    if (turn < 0.02) return this.p.cruise;
    const radius = look / turn;
    return Math.min(this.p.cruise, Math.sqrt(this.p.aLat * radius));
  }

  tick(dt: number): void {
    this.clockMs += dt * 1000;

    // ── Halted at a junction ────────────────────────────────────────────────
    if (this.clockMs < this.stopUntil) {
      this.speed = 0;
      return;
    }

    // ── Choose a target speed ───────────────────────────────────────────────
    let target = this.cornerLimit();

    // Brake for the upcoming junction. v² = 2·a·d gives the distance needed to
    // stop; inside it, aim for zero.
    const toStop = this.nextStopAtM - this.offsetM;
    if (toStop > 0) {
      const brakingDistance = (this.speed * this.speed) / (2 * this.p.decel) + 6;
      if (toStop < brakingDistance) target = 0;
    }

    // Slow into the destination rather than arriving at cruising speed.
    const remaining = this.route.length - this.offsetM;
    if (remaining < (this.speed * this.speed) / (2 * this.p.decel) + 8) target = 0;

    // ── Longitudinal dynamics ───────────────────────────────────────────────
    const rate = target > this.speed ? this.p.accel : this.p.decel;
    const delta = target - this.speed;
    this.speed += Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);
    if (this.speed < 0.05) this.speed = 0;

    // Arrived at the junction: wait, then hesitate before pulling away. The
    // hesitation is small and it is what makes a departure look like a decision
    // rather than a state change.
    if (this.speed === 0 && toStop <= 6 && toStop > -50 && this.clockMs >= this.stopUntil) {
      this.stopUntil = this.clockMs + this.range(this.p.dwell) + this.range(this.p.hesitate);
      this.nextStopAtM = this.offsetM + this.range(this.p.stopEvery);
      return;
    }

    this.offsetM = Math.min(this.route.length, this.offsetM + this.speed * dt);

    // ── Lane position ───────────────────────────────────────────────────────
    // Nobody tracks the centreline exactly. A slow random walk, bounded to
    // roughly half a lane, keeps the vehicle believably imprecise without ever
    // looking like it has left the road. It also gives map-matching something
    // real to correct, which is the behaviour we actually want to observe.
    if (this.rnd() < dt * 0.35) {
      this.lateralTarget = (this.rnd() * 2 - 1) * this.p.wander;
    }
    this.lateral += (this.lateralTarget - this.lateral) * Math.min(1, dt * 0.8);

    const at = this.route.positionAt(this.offsetM);
    if (at) {
      // Steering follows the path actually travelled, lane offset included, so
      // heading and position never disagree.
      const prev = this.heading;
      const road = this.route.smoothBearingAt(this.offsetM, 12) ?? at.bearing;
      const blend = Math.min(1, dt * 3);
      this.heading = prev + (((road - prev) % 360 + 540) % 360 - 180) * blend;
    }
  }

  sample(): DriverSample {
    const at = this.route.positionAt(this.offsetM);
    const base = at?.point ?? { lat: 0, lng: 0 };
    // Offset perpendicular to travel.
    const side = (this.heading + 90) * DEG;
    const point = {
      lat: base.lat + (this.lateral * Math.cos(side)) / 111_320,
      lng: base.lng + (this.lateral * Math.sin(side)) / (111_320 * Math.cos(base.lat * DEG)),
    };
    return {
      point,
      heading: ((this.heading % 360) + 360) % 360,
      speed: this.speed,
      offsetM: this.offsetM,
      stopped: this.speed === 0,
    };
  }
}
