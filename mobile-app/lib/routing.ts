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

export type RouteStep = {
  maneuver: { type?: string; modifier?: string; location: [number, number] };
  name: string;
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

/**
 * Fetch a driving route. Never throws and never returns null: on any failure
 * it falls back to a straight line between the two REAL endpoints, which is an
 * honest "we don't know the roads" visual. It must never invent a path.
 */
export async function fetchRoute(
  origin: LatLng,
  destination: LatLng,
  opts: { steps?: boolean; signal?: AbortSignal } = {},
): Promise<RouteResult> {
  const fallback: RouteResult = {
    coords: [origin, destination],
    steps: [],
    distanceM: null,
    durationS: null,
    fromRouter: false,
  };

  const pair = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
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

    const steps: RouteStep[] = opts.steps
      ? (route?.legs?.[0]?.steps ?? []).filter(
          (st: RouteStep) => Array.isArray(st?.maneuver?.location) && st.maneuver.location.length >= 2,
        )
      : [];

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
