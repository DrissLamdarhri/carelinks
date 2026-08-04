/**
 * CareLink — trip simulator (development only).
 * ────────────────────────────────────────────────────────────────────────────
 * Broadcasts a synthetic journey onto a real booking's tracking channel, so the
 * PRODUCTION patient screen can be evaluated without two people driving around.
 *
 * WHY THIS IS NOT CHEATING
 *
 * It injects fixes at the transport boundary — the same private realtime channel
 * a nurse's phone publishes to, carrying the same payload shape, at the same
 * cadence. Everything downstream is the real thing: the real subscription, the
 * real filter, the real buffer, the real curved interpolation and map-matching,
 * the real marker and the real camera. The only fiction is the GPS chip.
 *
 * That makes it useful for judging FEEL — smoothness, camera behaviour, the
 * marker, arrival — which is exactly the review that cannot happen with two
 * phones sitting on a desk. It is NOT a substitute for a real outdoor test:
 * genuine multipath, tunnel re-acquisition, thermal throttling and battery
 * behaviour only show up outside.
 *
 * DEV ONLY. Publishing requires an ACTIVE tracking session and the caller to be
 * the assigned professional (migration 0052), so this cannot be used to spoof a
 * stranger's location — the server refuses it. Run it signed in as the pro.
 */
import { supabase } from "@/lib/supabase";
import { proStreamTopic } from "@/lib/db/tracking";
import { fetchRoute } from "@/lib/routing";
import { Route, type LatLng } from "./route";
import { SimulatedDriver, type DriverPersonality } from "./driver";

export type SimulationHandle = { stop(): void };

/**
 * A plausible drivable loop around a point, for when there is no real route to
 * follow — which is the normal case while testing indoors, because the pro and
 * the patient are the same place and the route is (correctly) cleared.
 *
 * Deliberately not a circle: a constant-curvature path would flatter the
 * interpolation. This wanders, with straights and corners of varying
 * sharpness, so turns actually get exercised.
 */
export function syntheticLoop(center: LatLng, radiusM = 400, points = 64): LatLng[] {
  const out: LatLng[] = [];
  const latPerM = 1 / 111_320;
  const lngPerM = 1 / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * Math.PI * 2;
    // Two harmonics make the radius breathe, producing straights and bends.
    const r = radiusM * (0.72 + 0.28 * Math.sin(t * 2) + 0.08 * Math.cos(t * 3));
    out.push({
      lat: center.lat + r * Math.cos(t) * latPerM,
      lng: center.lng + r * Math.sin(t) * lngPerM,
    });
  }
  return out;
}

export type SimulateOptions = {
  bookingId: string;
  /** The road to drive. Use the route already drawn on screen. */
  path: LatLng[];
  /** How this driver behaves — cruising speed, aggression, patience at lights. */
  personality?: DriverPersonality;
  /** Nominal gap between broadcasts (ms). Actual gaps are jittered around it. */
  intervalMs?: number;
  /** Seed, so two runs are the same experiment. */
  seed?: number;
  /** Positional noise to add, in metres. Real urban GPS is 5-15m. */
  jitterM?: number;
  /**
   * Slow down through bends, the way a vehicle actually does.
   *
   * Constant speed through a corner is one of the strongest "this is fake"
   * cues: real traffic decelerates into a turn and accelerates out. Without it
   * the marker sweeps corners at motorway pace and the eye rejects it even when
   * the geometry is perfect.
   */
  corneringSlowdown?: boolean;
  /** Simulate a signal outage between these offsets (ms from start). */
  outage?: [number, number];
  onProgress?: (fraction: number) => void;
  onDone?: () => void;
  /**
   * Take a WRONG TURN at this offset (ms), driving a genuinely different road
   * to the same destination.
   *
   * The normal simulation follows the planned route perfectly, so the entire
   * deviation path — snapping disengaging, the eased correction back to real
   * GPS, the re-route, the new road replacing the old — never executes and
   * therefore has never been observed. This makes it observable without
   * actually driving down the wrong street.
   */
  wrongTurnAtMs?: number;
  /** Required with `wrongTurnAtMs`: where the detour must still end up. */
  destination?: LatLng;
  onWrongTurn?: () => void;
};

/**
 * Drive `path` and publish the result. Returns a handle; call `stop()` to end
 * early (and always call it on unmount, or the trip keeps broadcasting).
 */
export function simulateTrip(opts: SimulateOptions): SimulationHandle {
  const {
    bookingId, path, personality = "normal", intervalMs = 1500, jitterM = 8, outage,
    seed = 7, wrongTurnAtMs, destination, onProgress, onDone, onWrongTurn,
  } = opts;

  let route = new Route(path);
  let divergd = false;
  if (!route.usable) {
    onDone?.();
    return { stop: () => {} };
  }

  const channel = supabase.channel(proStreamTopic(bookingId), { config: { private: true } });
  void channel.subscribe();

  const driver = new SimulatedDriver(route, personality, seed);
  const rnd = (() => {
    let a = (seed * 2654435761) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  let seq = 0;
  let elapsed = 0;
  let sincePublish = 0;
  let nextPublishAt = intervalMs;
  let diverged = false;
  let stopped = false;

  // Physics runs fast and evenly; GPS is published slowly and unevenly. Keeping
  // the two rates separate is what lets fixes arrive irregularly — as a real
  // handset delivers them — without the underlying motion becoming irregular
  // too. Conflating them is why the old simulator could only ever produce a
  // metronome.
  const PHYSICS_MS = 100;

  const timer = setInterval(() => {
    if (stopped) return;
    elapsed += PHYSICS_MS;
    sincePublish += PHYSICS_MS;
    driver.tick(PHYSICS_MS / 1000);

    if (driver.done) {
      stop();
      onDone?.();
      return;
    }
    onProgress?.(driver.progress);

    // ── The wrong turn ────────────────────────────────────────────────────
    // A real road to the same destination via a waypoint ~300m to the side. A
    // straight-line detour would be trivially rejected by map-matching and
    // would prove nothing; taking an actual different street is the situation
    // the deviation logic exists for.
    if (!diverged && wrongTurnAtMs != null && destination && elapsed >= wrongTurnAtMs) {
      diverged = true;
      const here = driver.sample();
      const side = (here.heading + 90) * (Math.PI / 180);
      const via = {
        lat: here.point.lat + (300 * Math.cos(side)) / 111_320,
        lng:
          here.point.lng +
          (300 * Math.sin(side)) / (111_320 * Math.cos((here.point.lat * Math.PI) / 180)),
      };
      void fetchRoute(here.point, destination, { via }).then(({ coords, fromRouter }) => {
        if (stopped || !fromRouter || coords.length < 2) return;
        driver.setRoute(new Route(coords));
        onWrongTurn?.();
      });
    }

    if (sincePublish < nextPublishAt) return;
    sincePublish = 0;
    // Real fixes do not arrive on a metronome: the OS is busy, the radio is
    // asleep, the chip is re-acquiring. Occasionally one is very late.
    nextPublishAt = intervalMs * (0.75 + rnd() * 0.7) + (rnd() < 0.08 ? intervalMs * 1.8 : 0);

    if (outage && elapsed >= outage[0] && elapsed <= outage[1]) return;

    const at = driver.sample();
    const jitterDeg = jitterM / 111_320;
    void channel.send({
      type: "broadcast",
      event: "position",
      payload: {
        lat: at.point.lat + (rnd() - 0.5) * 2 * jitterDeg,
        lng: at.point.lng + (rnd() - 0.5) * 2 * jitterDeg,
        at: new Date().toISOString(),
        // A stationary phone reports no usable course; publishing one anyway
        // would let the marker point somewhere meaningless at a red light.
        heading: at.stopped ? null : at.heading,
        speed: at.speed,
        accuracy: 5 + rnd() * 7,
        seq: ++seq,
      },
    });
  }, PHYSICS_MS);

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    void supabase.removeChannel(channel);
  }

  return { stop };
}
