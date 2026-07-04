# Option B — Real maps with MapLibre + MapTiler, themed cream/navy

**Goal:** replace the hand-drawn Fès-only stylized map with a real vector map that renders real streets
**everywhere**, while keeping CareLink's cream/navy look — and reusing the existing pin components unchanged.

This is a **turnkey plan**: exact deps, config, a brand style, component code, and a verify runbook. It's an
additive migration behind one component (`CareLinkMapView`), so booking and tracking swap over together and
the old stylized map stays as an offline/no-key fallback.

> **Why MapLibre (not Google):** MapLibre is open-source and its **vector style is fully recolorable**, so we
> can match the cream/navy palette pixel-for-pixel (Google's styling is constrained). MapTiler provides the
> vector tiles on a **free tier** (~100k tile loads/mo). No Mapbox/Google billing required to start.
>
> **The key win:** MapLibre's `MarkerView` renders **arbitrary React Native views** as markers — so the
> existing `PatientPin` / `ProPin` components render **unchanged** on the real map. We keep the exact pins and
> just gain real streets underneath.

---

## 0. Prerequisites (yours to set up — I can't do these from here)

1. **MapTiler account** → https://cloud.maptiler.com (free). Create an **API key**.
2. **EAS dev build.** MapLibre is a native module; it does **not** run in Expo Go. You'll build a dev client:
   `eas build --profile development --platform android` (add an EAS `development` profile with
   `"developmentClient": true`). After this, `expo start --dev-client` replaces Expo Go for map screens.
3. Put the key in env: `EXPO_PUBLIC_MAPTILER_KEY=...` (read it like the existing `EXPO_PUBLIC_SUPABASE_*`).

---

## 1. Dependencies

```bash
# maintained MapLibre RN binding
pnpm -C mobile-app add @maplibre/maplibre-react-native
# (routing) reuse the existing OSRM/MapTiler directions call already in tracking
```

`app.json` — add the config plugin so the native SDK links in the dev build:

```jsonc
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-location",
      "expo-web-browser",
      "expo-image-picker",
      [
        "@maplibre/maplibre-react-native"
      ]
    ]
  }
}
```

---

## 2. The cream/navy brand style

Two ways — do (A) first (fastest), keep (B) for full control.

**(A) MapTiler Cloud editor (recommended, 15 min):** In MapTiler Cloud → Maps → clone **"Streets v2"** →
open the style editor → recolor to the brand:

| Element | Color |
|---------|-------|
| Background / land | `#EDE5CC` (cream) |
| Water | `#B8D9E8` casing / `#A0C8D8` fill |
| Parks / landuse green | `#CDDEC8` |
| Motorway/primary roads | `#FFFFFF` fill, `#C8BAA0` casing |
| Secondary/local roads | `#F4EDDA` / `#EBE1CC` |
| Place labels | `#0D0870` (navy), halo `#EDE5CC` |
| District labels | `#4A4580` |

Publish → copy the **style URL** (`https://api.maptiler.com/maps/<your-style-id>/style.json?key=KEY`).

**(B) Local style JSON** (`mobile-app/assets/map/carelink-style.json`) — ship a compact recolor of MapTiler's
`v3` vector source so the look is versioned in-repo. Starter (extend layers in the MapTiler editor as needed):

```jsonc
{
  "version": 8,
  "name": "CareLink Cream",
  "sources": {
    "openmaptiles": {
      "type": "vector",
      "url": "https://api.maptiler.com/tiles/v3/tiles.json?key={{MAPTILER_KEY}}"
    }
  },
  "glyphs": "https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key={{MAPTILER_KEY}}",
  "layers": [
    { "id": "bg", "type": "background", "paint": { "background-color": "#EDE5CC" } },
    { "id": "water", "type": "fill", "source": "openmaptiles", "source-layer": "water",
      "paint": { "fill-color": "#A0C8D8" } },
    { "id": "landuse-green", "type": "fill", "source": "openmaptiles", "source-layer": "landcover",
      "filter": ["==", "class", "wood"], "paint": { "fill-color": "#CDDEC8", "fill-opacity": 0.7 } },
    { "id": "roads-casing", "type": "line", "source": "openmaptiles", "source-layer": "transportation",
      "paint": { "line-color": "#C8BAA0", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 8] } },
    { "id": "roads", "type": "line", "source": "openmaptiles", "source-layer": "transportation",
      "paint": { "line-color": "#FFFFFF", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 16, 5] } },
    { "id": "place-labels", "type": "symbol", "source": "openmaptiles", "source-layer": "place",
      "layout": { "text-field": ["get", "name"], "text-size": 12, "text-font": ["Noto Sans Medium"] },
      "paint": { "text-color": "#0D0870", "text-halo-color": "#EDE5CC", "text-halo-width": 1.6 } }
  ]
}
```

Load it by string-replacing `{{MAPTILER_KEY}}` at runtime and passing the object to `MapView` via `mapStyle`.

---

## 3. `CareLinkMapView` — one component, both screens

`mobile-app/components/map/CareLinkMapView.tsx` (new). Reuses `PatientPin`/`ProPin` inside `MarkerView`.

```tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import MapLibreGL, { MapView, Camera, MarkerView, ShapeSource, LineLayer } from "@maplibre/maplibre-react-native";
import { PatientPin, ProPin, type ProPinData } from "./Pins";

MapLibreGL.setAccessToken(null); // MapLibre needs no Mapbox token; MapTiler key lives in the style URL

const STYLE_URL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.EXPO_PUBLIC_MAPTILER_KEY}`;

export type CareLinkMapViewProps = {
  center: { lat: number; lng: number };
  patient?: { lat: number; lng: number };
  pros?: ProPinData[];
  pro?: { lat: number; lng: number };            // moving pro (tracking)
  route?: { lat: number; lng: number }[];        // road-following polyline
  progressIdx?: number;                          // split traversed/remaining
  onSelectPro?: (id: string) => void;
  selectedProId?: string | null;
  radiusKm?: number;
  followUser?: boolean;
};

const toGeoJSON = (pts: { lat: number; lng: number }[]) => ({
  type: "Feature" as const,
  geometry: { type: "LineString" as const, coordinates: pts.map((p) => [p.lng, p.lat]) },
  properties: {},
});

export function CareLinkMapView(props: CareLinkMapViewProps) {
  const { center, patient, pros = [], pro, route, progressIdx = 0, onSelectPro, selectedProId } = props;
  const traversed = route ? route.slice(0, progressIdx + 1) : null;
  const remaining = route ? route.slice(progressIdx) : null;

  return (
    <MapView style={StyleSheet.absoluteFill} styleURL={STYLE_URL} logoEnabled={false} attributionEnabled compassEnabled>
      <Camera zoomLevel={13} centerCoordinate={[center.lng, center.lat]} animationMode="flyTo" animationDuration={600} />

      {traversed && traversed.length > 1 && (
        <ShapeSource id="route-done" shape={toGeoJSON(traversed)}>
          <LineLayer id="route-done-l" style={{ lineColor: "rgba(13,8,112,0.16)", lineWidth: 6, lineCap: "round" }} />
        </ShapeSource>
      )}
      {remaining && remaining.length > 1 && (
        <ShapeSource id="route-rem" shape={toGeoJSON(remaining)}>
          <LineLayer id="route-rem-l" style={{ lineColor: "#0D0870", lineWidth: 5, lineCap: "round" }} />
        </ShapeSource>
      )}

      {patient && (
        <MarkerView coordinate={[patient.lng, patient.lat]} anchor={{ x: 0.5, y: 1 }}>
          <PatientPin />
        </MarkerView>
      )}

      {pros.map((p) => (
        <MarkerView key={p.id} coordinate={[p.lng, p.lat]} anchor={{ x: 0.5, y: 0.5 }}>
          <ProPin pro={p} isSelected={selectedProId === p.id} onSelect={(id) => onSelectPro?.(id)} />
        </MarkerView>
      ))}

      {pro && (
        <MarkerView coordinate={[pro.lng, pro.lat]} anchor={{ x: 0.5, y: 0.5 }}>
          {/* reuse the tracking ProMapPin; add heading rotation here (§5) */}
          <View />
        </MarkerView>
      )}
    </MapView>
  );
}
```

**Native camera follow / auto-fit** replaces the manual projection math:
`camera.fitBounds([minLng,minLat],[maxLng,maxLat], padding)` for tracking (fit patient+pro), or
`followUserLocation` for the booking map.

### Optional Expo-Go fallback

If you want map screens to still open in Expo Go during JS-only dev, gate the native view:

```tsx
import { NativeModules } from "react-native";
const HAS_MAPLIBRE = !!NativeModules.MLRNModule; // present only in the dev build
// render <CareLinkMapView/> when HAS_MAPLIBRE, else the existing <StaticMapLayer/>-based map.
```

Cleanest is **dev-build only** (no fallback) once you've migrated — but the gate keeps the team unblocked.

---

## 4. Wiring the screens

- **Booking (`app/patient/request.tsx`):** replace `<BookingMap .../>` with `<CareLinkMapView center={patient}
  patient={patient} pros={mapPros} radiusKm={5} followUser onSelectPro={...} />`. The `geo.findNearbyProsForMap`
  call and `mapPros` mapping stay exactly as they are today. Add a native circle for the radius via a
  `ShapeSource` + `CircleLayer` (or a `FillLayer` with a turf circle).
- **Tracking (`app/patient/tracking/[bookingId].tsx`):** replace `StaticMapLayer` + the manual `project()` pin
  placement with `<CareLinkMapView center={...} patient={patientCoord} pro={proCoord} route={routeCoords}
  progressIdx={progressIdx} />`. Keep the `LiveTrackingChannel` broadcast, the ETA logic, and the
  `progressIdx` computation — they're transport-agnostic. Delete the `project()`/`svgPro` screen-space math.

Everything else (DAL, realtime, `geo`, pins, colors, `specialtyColor`) is unchanged.

---

## 5. Deferred features — build them here, on the real map (tasks #14, #15)

These were intentionally **not** built on the stylized map (which this replaces):

- **Marker heading rotation (#14):** compute bearing `atan2` between successive `proCoord` samples; pass it to
  the pro `MarkerView` child as a rotation. On a real map with a directional puck this reads correctly (it
  didn't on the circular avatar). MapLibre also exposes `SymbolLayer` `icon-rotate` if you switch the pro to a
  symbol icon.
- **Bottom-sheet snap points (#15):** add `@gorhom/bottom-sheet` (peer of gesture-handler/reanimated, both
  already deps) with snap points `['18%','55%','92%']` for the booking pro list and the tracking status card.
  This is a real, well-tested sheet — cheaper and smoother than a hand-rolled Animated sheet, and it composes
  with the full-screen map.

Other polish that becomes native/free on MapLibre: **pin clustering** (`ShapeSource cluster`), **pitch/3D**,
**smooth camera choreography**, **user-location puck**, **offline tile packs**.

---

## 6. Verify runbook (device)

1. `eas build --profile development -p android` → install the dev client on a device.
2. `EXPO_PUBLIC_MAPTILER_KEY=... pnpm -C mobile-app start --dev-client`.
3. Open **booking**: real streets in cream/navy; your GPS centers the map; real pro pins; pinch/rotate work
   natively; radius circle around you.
4. Open **tracking** from a matched booking: real route line (traversed dimmed / remaining navy), pro marker
   moves along roads, camera fits both, arrival haptic fires.
5. Confirm labels/roads are on-brand; tweak the MapTiler style until it matches the screenshot.

---

## 7. Cost & limits

- MapTiler free tier ≈ 100k tile requests/mo + 100k geocoding — comfortable for early usage; upgrade later.
- No Google/Mapbox billing. If you outgrow MapTiler, the same MapLibre style works against **self-hosted**
  tiles (tileserver-gl) — no vendor lock-in.

---

## 8. Rollback

`CareLinkMapView` is the only new surface; the stylized `StaticMapLayer`/`BookingMap` stays in the repo. If a
build issue appears, point the screens back at `BookingMap` and ship while you debug the dev build. Nothing
about the data layer changes, so rollback is a one-import swap.
