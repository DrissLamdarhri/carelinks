# Routing (road paths for live tracking)

Every road route the app draws goes through **one** function:
`mobile-app/lib/routing.ts` → `fetchRoute(origin, destination, { steps })`.

Nothing else may call a routing API directly. It returns a straight line
between the two real endpoints on any failure, and never throws — a wrong road
path is worse than an obviously-approximate one.

## Current state: the public demo server ⚠️

The default endpoint is `https://router.project-osrm.org` — OSRM's **public
demo instance**. It is fine for development and **not acceptable for launch**:

- no SLA, no uptime guarantee, no support;
- an undocumented, aggressive rate limit (429s under load);
- its usage policy does not cover commercial traffic.

Each in-flight trip re-routes when the pro moves >60 m from the last route
origin, throttled to one request per 10 s per side. Two sides × N concurrent
trips hits the limit quickly, and when it does the map silently degrades to
straight lines.

`usingDemoRoutingServer` is exported from `lib/routing.ts` if you want to gate
a launch checklist or a dev-only banner on it.

## Switching providers

Set one env var. No code changes:

```bash
EXPO_PUBLIC_ROUTING_URL=https://routing.carelink.ma
```

The endpoint must speak the OSRM v1 HTTP shape:

```
GET {BASE}/route/v1/driving/{lng},{lat};{lng},{lat}?overview=full&geometries=geojson[&steps=true]
```

returning `routes[0].geometry.coordinates` (GeoJSON `[lng, lat]` pairs),
optionally `routes[0].legs[0].steps[]` with `maneuver.location`,
`maneuver.type`, `maneuver.modifier`, and `name`.

## Recommended: self-hosted OSRM

Morocco's OSM extract is small, the container is stateless, and there is no
per-request cost — which matters because tracking re-routes continuously.

```bash
mkdir -p osrm && cd osrm

# 1. Morocco extract (~150-250 MB)
wget https://download.geofabrik.de/africa/morocco-latest.osm.pbf

# 2. Pre-process (car profile). One-off, ~5-15 min, needs a few GB of RAM.
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/morocco-latest.osm.pbf
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/morocco-latest.osrm
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/morocco-latest.osrm

# 3. Serve
docker run -d --restart unless-stopped -p 5000:5000 -v "${PWD}:/data" \
  --name osrm ghcr.io/project-osrm/osrm-backend \
  osrm-routed --algorithm mld /data/morocco-latest.osrm
```

Then put TLS in front of it (Caddy/nginx) and point
`EXPO_PUBLIC_ROUTING_URL` at the public hostname.

Notes:

- **Do not expose port 5000 directly.** `osrm-routed` has no auth and no rate
  limiting; put it behind a reverse proxy with both.
- **Refresh the extract** monthly-ish and re-run steps 2–3; roads change.
- Sizing: a single small VM (2 vCPU / 4 GB) handles Morocco comfortably for
  early traffic. Memory is dominated by the graph, not by concurrency.
- Coverage: OSM is good in Moroccan cities, patchy rurally. A commercial API
  will not be dramatically better there — the underlying data is often the same
  or worse for Morocco.

## Commercial alternatives

If you'd rather not run infrastructure: Mapbox Directions, HERE, and Google
Routes all work, but none return OSRM's exact response shape — you'd add a
small adapter inside `fetchRoute` rather than changing call sites. Budget for
per-request pricing against the continuous re-routing pattern above; it is the
main reason self-hosting is the default recommendation here.
