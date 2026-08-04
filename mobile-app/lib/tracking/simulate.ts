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
import { Route, type LatLng } from "./route";

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
  /** Metres per second. 14 ≈ 50 km/h city driving; 1.4 ≈ walking. */
  speedMps?: number;
  /** Gap between broadcasts (ms) — mirrors the real adaptive sampling. */
  intervalMs?: number;
  /** Positional noise to add, in metres. Real urban GPS is 5-15m. */
  jitterM?: number;
  /** Simulate a signal outage between these offsets (ms from start). */
  outage?: [number, number];
  onProgress?: (fraction: number) => void;
  onDone?: () => void;
};

/**
 * Drive `path` and publish the result. Returns a handle; call `stop()` to end
 * early (and always call it on unmount, or the trip keeps broadcasting).
 */
export function simulateTrip(opts: SimulateOptions): SimulationHandle {
  const {
    bookingId, path, speedMps = 14, intervalMs = 1500, jitterM = 8, outage, onProgress, onDone,
  } = opts;

  const route = new Route(path);
  if (!route.usable) {
    onDone?.();
    return { stop: () => {} };
  }

  const channel = supabase.channel(proStreamTopic(bookingId), { config: { private: true } });
  void channel.subscribe();

  let offsetM = 0;
  let seq = 0;
  let elapsed = 0;
  let stopped = false;

  const timer = setInterval(() => {
    if (stopped) return;
    elapsed += intervalMs;
    offsetM += speedMps * (intervalMs / 1000);

    if (offsetM >= route.length) {
      stop();
      onDone?.();
      return;
    }
    onProgress?.(offsetM / route.length);

    // A dropout publishes nothing at all — which is what a tunnel looks like
    // from the receiving end, and exercises dead reckoning and the staleness UI.
    if (outage && elapsed >= outage[0] && elapsed <= outage[1]) return;

    const at = route.positionAt(offsetM);
    if (!at) return;

    const jitterDeg = jitterM / 111_320;
    const payload = {
      lat: at.point.lat + (Math.random() - 0.5) * 2 * jitterDeg,
      lng: at.point.lng + (Math.random() - 0.5) * 2 * jitterDeg,
      at: new Date().toISOString(),
      heading: at.bearing,
      speed: speedMps,
      accuracy: 6 + Math.random() * 6,
      seq: ++seq,
    };
    void channel.send({ type: "broadcast", event: "position", payload });
  }, intervalMs);

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    void supabase.removeChannel(channel);
  }

  return { stop };
}
