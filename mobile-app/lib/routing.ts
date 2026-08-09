/**
 * CareLink — road routing.
 * ────────────────────────────────────────────────────────────────────────────
 * Every route the app draws comes through here.
 *
 * PRODUCTION WARNING: the default endpoint is `router.project-osrm.org`, which
 * is OSRM's public DEMO server. It has no SLA, no uptime guarantee, an
 * undocumented rate limit, and its usage policy does not cover commercial
 * traffic. With N trips in flight — each re-routing as the pro moves — it will
 * start returning 429s or simply hang, and the map goes back to drawing stale
 * lines. Before launch, set:
 *
 *     EXPO_PUBLIC_ROUTING_URL=https://routing.carelink.ma
 *
 * pointing at a self-hosted OSRM (one container + a Morocco OSM extract; see
 * docs/routing.md) or a commercial Directions API with an OSRM-shaped response.
 */
import type { LatLng } from "@/components/map/engine";

const DEFAULT_BASE = "https://router.project-osrm.org";

const BASE_URL = (process.env.EXPO_PUBLIC_ROUTING_URL || DEFAULT_BASE).replace(/\/$/, "");

/** True when we're still pointed at the shared demo server (not for launch). */
export const usingDemoRoutingServer = BASE_URL === DEFAULT_BASE;

const TIMEOUT_MS = 5000;

/**
 * One OSRM maneuver.
 *
 * `steps[i].maneuver` describes the maneuver at the START of step i, and
 * `steps[i].distance` is the length of the road AFTER it, up to the next one.
 * Getting that relationship backwards is the classic way to build a turn
 * banner that announces the wrong junction, so it is spelled out here rather
 * than left to the reader.
 *
 * Everything below is returned by OSRM whenever `steps=true` is requested. It
 * used to be parsed and dropped on the floor, which is why the professional's
 * banner could not say "3rd exit", "in 250 m", or "N6".
 */
export type RouteStep = {
  maneuver: {
    type?: string;
    modifier?: string;
    location: [number, number];
    /** Roundabout/rotary exit number, 1-based. Only present on those types. */
    exit?: number;
    /** Compass bearing (deg) of travel before and after the maneuver. */
    bearing_before?: number;
    bearing_after?: number;
  };
  /** Street name. Empty string on unnamed roads — very common in Morocco. */
  name: string;
  /** Road reference as signposted: "N6", "R503". Often absent in cities. */
  ref?: string;
  /** Length of this step in metres — the road distance to the NEXT maneuver. */
  distance?: number;
  /** Routed duration of this step in seconds. */
  duration?: number;
};

export type RouteResult = {
  /** Road geometry, origin → destination. At minimum a 2-point straight line. */
  coords: LatLng[];
  /** Turn-by-turn steps (only when `steps: true` was requested). */
  steps: RouteStep[];
  /** Metres / seconds as reported by the router, when available. */
  distanceM: number | null;
  durationS: number | null;
  /** False when routing failed and `coords` is the straight-line fallback. */
  fromRouter: boolean;
};

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

/**
 * Flatten every leg's steps into one list.
 *
 * Only leg 0 was read before. That is correct for a plain origin→destination
 * request, but `fetchRoute` also accepts a `via` waypoint — and with one, OSRM
 * splits the journey into two legs. Reading only the first silently truncated
 * the instructions halfway. Concatenating costs nothing and removes a trap for
 * whoever next passes `via`.
 */
function parseSteps(legs: unknown): RouteStep[] {
  if (!Array.isArray(legs)) return [];
  const out: RouteStep[] = [];
  for (const leg of legs) {
    const raw = (leg as { steps?: unknown })?.steps;
    if (!Array.isArray(raw)) continue;
    for (const st of raw) {
      const m = (st as { maneuver?: Record<string, unknown> })?.maneuver;
      const loc = m?.location;
      if (!Array.isArray(loc) || loc.length < 2) continue;
      if (typeof loc[0] !== "number" || typeof loc[1] !== "number") continue;
      const s = st as Record<string, unknown>;
      out.push({
        maneuver: {
          type: str(m?.type),
          modifier: str(m?.modifier),
          location: [loc[0], loc[1]],
          exit: num(m?.exit),
          bearing_before: num(m?.bearing_before),
          bearing_after: num(m?.bearing_after),
        },
        name: str(s.name) ?? "",
        ref: str(s.ref),
        distance: num(s.distance),
        duration: num(s.duration),
      });
    }
  }
  return out;
}

/**
 * Fetch a driving route. Never throws and never returns null: on any failure
 * it falls back to a straight line between the two REAL endpoints, which is an
 * honest "we don't know the roads" visual. It must never invent a path.
 */
export async function fetchRoute(
  origin: LatLng,
  destination: LatLng,
  opts: {
    steps?: boolean;
    signal?: AbortSignal;
    /**
     * Intermediate waypoint. Used to force a route down a DIFFERENT street than
     * the direct one — which is how the simulator produces a realistic wrong
     * turn on real roads rather than an invented straight-line detour.
     */
    via?: LatLng;
  } = {},
): Promise<RouteResult> {
  const fallback: RouteResult = {
    coords: [origin, destination],
    steps: [],
    distanceM: null,
    durationS: null,
    fromRouter: false,
  };

  const waypoints = opts.via
    ? [origin, opts.via, destination]
    : [origin, destination];
  const pair = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const query = `overview=full&geometries=geojson${opts.steps ? "&steps=true" : ""}`;
  const url = `${BASE_URL}/route/v1/driving/${pair}?${query}`;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return fallback;
    const body = await res.json();
    const route = body?.routes?.[0];
    const raw: unknown = route?.geometry?.coordinates;
    if (!Array.isArray(raw) || raw.length < 2) return fallback;

    const coords: LatLng[] = raw
      .filter((c): c is number[] => Array.isArray(c) && c.length >= 2)
      .map((c) => ({ lat: c[1], lng: c[0] }));
    if (coords.length < 2) return fallback;

    // Normalised rather than passed through raw: the guidance engine reads
    // these on every frame and must not have to defend against a router that
    // omits a field or hands back a string where a number is expected.
    const steps: RouteStep[] = opts.steps ? parseSteps(route?.legs) : [];

    return {
      coords,
      steps,
      distanceM: typeof route?.distance === "number" ? route.distance : null,
      durationS: typeof route?.duration === "number" ? route.duration : null,
      fromRouter: true,
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
