# Map rebuild plan — real Uber/InDrive feel on MapLibre + MapTiler (free)

**Goal:** a real, native, Uber/InDrive-grade map — smooth vector pan/zoom, gliding + rotating driver marker,
camera choreography, snap bottom sheet, center-pin pickup, clustering — themed cream/navy, on a **100% free,
no-card** stack.

**Engine decision:** **MapLibre React Native + MapTiler** (open-source Mapbox fork; free tiles, no account/card).
Same API as Mapbox, so this is a drop-in path to Mapbox later if ever wanted. **`mapcn-rn`** (which runs on
MapLibre) is used as an optional component starter, cherry-picked — not a hard dependency.

**Non-negotiable prerequisite:** a **dev build** (Expo Go cannot run any real map). Android, via EAS — free,
no Mac, no card.

---

## Phase 0 — Foundations (dev build + key)

0.1 **Expo account** (free) + `npm i -g eas-cli` + `eas login`.
0.2 Add a **`development` profile** to `eas.json`:
```jsonc
{ "build": { "development": { "developmentClient": true, "distribution": "internal",
  "android": { "buildType": "apk" } } } }
```
0.3 `eas build --profile development -p android` → install the `.apk` on the test phone (~15 min).
0.4 **MapTiler** free account → create a key → set `EXPO_PUBLIC_MAPTILER_KEY` (and stop relying on the
    Supabase-style hardcoded fallback — put it in the environment / `app.config`).
0.5 From now on dev with `npx expo start --dev-client` (not Expo Go). JS edits still hot-reload.

**Exit check:** the current app runs in the dev client (the react-native-maps map may still be showing — we
replace it next).

---

## Phase 1 — Engine swap to MapLibre (behind the existing `CareLinkMapView`)

The map already lives behind ONE component with a stable props API (`center`, `patient`, `pros`, `pro`,
`route`, `progressIdx`, `onSelectPro`, `onMapPress`, `radiusKm`, `fitCoords`). Screens don't change.

1.1 Install `@maplibre/maplibre-react-native` — **via pnpm** (`add to mobile-app/package.json` →
    `CI=true pnpm install --no-frozen-lockfile` from root). **Do NOT `npx expo install`/npm** (breaks the pnpm
    tree — see the pnpm memory).
1.2 Add the MapLibre **config plugin** to `app.json`.
1.3 Author the **cream/navy MapLibre style JSON** (`assets/map/carelink-style.json`) over MapTiler `v3` vector
    tiles — background cream, water, parks, roads (white/tan), navy labels. Reuse the palette from
    `components/map/mapStyle.ts`.
1.4 Rewrite `components/map/CareLinkMapNative.tsx` to MapLibre:
    - `MapView` (styleURL/style), `Camera` (centerCoordinate / bounds).
    - Pins: `MarkerView` reusing `PatientPin`/`ProPin` **or** a `ShapeSource` + `SymbolLayer` (better perf,
      enables rotation/clustering — preferred for the driver + clusters).
    - Route: `ShapeSource` + two `LineLayer`s (traversed dim / remaining navy) + a casing layer.
    - Radius: `ShapeSource` (turf circle) + `FillLayer`.
1.5 Keep the **capability gate** (`HAS_NATIVE_MAPS`) + the **SVG fallback** so Expo Go still opens the app.
1.6 Keep `react-native-maps` around until MapLibre is verified, then remove it.

**Exit check:** real cream/navy streets render in the dev client on both booking + tracking; pins/route show.

---

## Phase 2 — The "feels real" core (P0) — biggest impact

2.1 **Gliding driver marker.** Animate the pro's coordinate between GPS updates (interpolate over the update
    interval) instead of snapping; render via `SymbolLayer` with `icon-rotate` bound to **heading**
    (bearing from successive coords). *This is the single biggest Uber-feel win.*
2.2 **Camera choreography.** `camera.fitBounds(pickup, driver, padding)` on match; **follow the driver** during
    tracking; animate with easing. Padding accounts for the bottom sheet (2.3).
2.3 **Bottom sheet with snap points.** `@gorhom/bottom-sheet` (gesture-handler + reanimated already installed;
    root now has `GestureHandlerRootView`). Snap peek/half/full; feed its height into camera padding so pins/
    route never hide behind it.
2.4 **Center-pin pickup (booking).** Fixed pin in screen center + drag the map; on `onRegionDidChange` →
    reverse-geocode → address field. Replaces tap-to-drop. (InDrive/Uber pattern.)

**Exit check:** driver glides + rotates along the road; camera follows; sheet drags with snaps; pickup by
dragging the map.

---

## Phase 3 — Expected affordances (P1)

3.1 **User-location puck** with heading (MapLibre `UserLocation` / native location component).
3.2 **Recenter / my-location FAB**, zoom buttons, compass.
3.3 **Clustering** for pros at low zoom (`ShapeSource` `cluster` + count badges).
3.4 **Route polish:** dark casing under the line, rounded caps/joins, optional animated draw-in; keep
    traversed portion dimmed as the driver advances.
3.5 **Tap pin → sheet sync:** selecting a pro expands the sheet to that pro's card and vice-versa.

---

## Phase 4 — Top polish (P2)

4.1 Style tuning on device until the cream/navy looks intentional (+ optional night style).
4.2 Live **ETA + distance chips** on the route (OSRM/MapTiler directions — keep routing free).
4.3 **Haptics** on pin select / pickup drag-end / arrival (partly done).
4.4 Load **skeleton/shimmer** while map + route resolve.
4.5 Optional: 3D pitch near pickup; **offline tile pack** (MapLibre) for poor connectivity.

---

## Phase 5 — Cleanup + verify

5.1 Remove `react-native-maps` and the stylized-only leftovers once MapLibre is confirmed (keep the SVG
    fallback for Expo-Go dev ergonomics, or drop it if the team always uses the dev client).
5.2 `type-check` green; verify the full booking → bidding → tracking flow on the dev client.
5.3 Update `docs/real-map-setup.md` to MapLibre; note the Mapbox drop-in alternative.

---

## Risks & notes

- **pnpm, not npm** — adding native deps via npm/`npx expo install` broke the type tree before. Use pnpm.
- **Dev build required to verify** — I can't run native maps from here; each phase is verified by you on the
  dev client (fast once built).
- **MapTiler free limits** — generous for MVP; monitor tile usage.
- **`mapcn-rn`** — cherry-pick its `Map`/`Marker`/`Route`/`Cluster` components in Phases 1/3 if they save time;
  it's copy-paste (we own the code), so no runtime lock-in.
- **Mapbox upgrade path** — same API family; if you later want the last 10% of polish, swapping MapLibre→Mapbox
  is mechanical (add account + token).

## Effort shape (rough)

Phase 0: ~½ day (mostly waiting on the build). Phase 1: 1–2 days. Phase 2: 2–3 days (the feel). Phase 3: 1–2
days. Phase 4: ongoing polish. No hard deadline — quality-first per your call.
