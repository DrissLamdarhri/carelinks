# Map realism analysis — getting to Uber / InDrive feel

## 0. The core truth

**A map that "feels real" requires a native map engine, which requires a dev build.** There is **no**
real-map option that runs in Expo Go — not react-native-maps, not MapLibre, not mapcn-rn, not expo-maps. What
renders in Expo Go today is the **stylized SVG fallback**, which is a drawing, not a map, and will never feel
like Uber/InDrive. **First action: make a dev build and look at the real map before judging.** A large share of
"doesn't feel real" is simply that the fallback is being evaluated.

## 1. mapcn-rn evaluation

- **What it is:** a shadcn-style, copy-paste **UI component kit** ("beautiful map components") built **on top of
  MapLibre / Mapbox React Native**. Styled with NativeWind (which this app already uses). ~46 GitHub stars.
- **It is not a map engine** — it renders through MapLibre/Mapbox underneath.
- **Requirements:** dev build (native module) **and** a MapTiler/Mapbox token on **both** iOS and Android
  (unlike react-native-maps, which uses free Apple Maps on iOS with no key).
- **Verdict:** viable and pretty, but choosing it = choosing the **MapLibre/Mapbox** path — a *bigger* change
  than finishing the react-native-maps map already wired, and it adds a mandatory iOS key. Worth **borrowing
  interaction patterns from** (it's open source), not necessarily adopting wholesale.

## 2. Engine options

| Engine | Real streets | Expo Go | Keys | Custom cream style | Maturity | Notes |
|--------|-------------|---------|------|--------------------|----------|-------|
| **react-native-maps** (wired now) | ✅ | ❌ dev build | Android Google key ($0 display); **iOS free** | Android only (JSON style) | ⭐⭐⭐ mature | Apple Maps iOS free. Marker animation is the weak spot (see §4). |
| **MapLibre + mapcn-rn** | ✅ | ❌ dev build | MapTiler/Mapbox token **both platforms** | ✅ full vector recolor | ⭐⭐ (mapcn young) | Best styling + ready components; heavier setup. |
| **expo-maps** (Expo first-party) | ✅ | ❌ dev build | Google/Apple | limited | ⭐ alpha, iOS 18+ | Not production-ready yet. |

**Feel like Uber/InDrive is 80% the polish layer** (animated markers, camera, bottom sheet, route, clustering)
— achievable on **any** of these. The engine choice is secondary to building that layer.

## 3. Why the current map doesn't feel real

### The Expo Go fallback (SVG) — inherent
- Fake, fixed geography (drawn streets); no real tiles.
- No true pan/zoom momentum, rotation, or pitch; feels static.
- Custom View pins, not native markers.
- → **Unfixable by design.** It's a placeholder so the app runs without a dev build.

### The react-native-maps version (dev build) — real but unpolished vs Uber
1. **Markers are static bitmaps.** react-native-maps snapshots custom marker views, so pins don't pulse/animate
   and the moving pro pin **jumps** instead of gliding.
2. **No heading rotation** — the pro marker doesn't rotate to face travel direction.
3. **No smooth marker interpolation** — position updates snap; Uber uses animated coordinate tweening.
4. **Route is a plain polyline** — no rounded joins tuning, no "traveled = grey / ahead = dark" polish beyond
   the basic split, no route casing/outline.
5. **No bottom sheet** with snap points that reshapes map padding (Uber's signature interaction).
6. **No clustering** — many pros at low zoom overlap into an unreadable pile.
7. **No camera choreography** — no smooth follow-the-driver, no fit-with-padding for the sheet, no zoom-to-fit
   pickup+driver.
8. **No user-location puck** with heading (the blue arrow).
9. **Pickup UX is tap-to-drop**, not the Uber/InDrive **fixed center pin + drag the map underneath**.
10. **No recenter / my-location FAB**, no compass, no zoom controls.
11. **No map padding awareness** — pins/route hide behind the bottom sheet.
12. **Cream style is a rough starter** — needs real tuning on device to look intentional.

## 4. Improvement roadmap to Uber/InDrive parity

Grouped by impact. All build on a **dev build** (prerequisite).

### 🔴 P0 — the "feels real" core
- **Smooth animated driver marker:** use `MarkerView`/`Marker.Animated` + `AnimatedRegion.timing` (or a
  reanimated coordinate) so the pro **glides** between GPS updates; **rotate to heading** (`bearing` from
  successive coords). This single change is the biggest "feels like Uber" win.
- **Camera choreography:** `animateCamera`/`fitToCoordinates` with **edge padding for the bottom sheet**;
  follow-the-driver during tracking; zoom-to-fit pickup+driver on match.
- **Bottom sheet with snap points:** `@gorhom/bottom-sheet` (peer deps already installed) with
  peek/half/full, and feed its height into map `edgePadding` so nothing hides behind it.
- **Center-pin pickup:** fixed pin in the screen center + drag the map; read `onRegionChangeComplete` →
  reverse-geocode → address. (Replace tap-to-drop.)

### 🟠 P1 — expected map affordances
- **User-location puck** with heading (`showsUserLocation` + follow mode).
- **Recenter / my-location FAB**, zoom buttons, compass.
- **Marker clustering** (`react-native-map-clustering` for RNMaps, or MapLibre cluster layers).
- **Route polish:** casing (dark outline under the line), rounded caps/joins, animated "draw" on load, keep
  traveled portion dimmed as the driver advances.
- **Selected-pro callout / bottom card** synced with the map (tap pin → sheet expands to that pro).

### 🟡 P2 — top-tier polish
- **Map style tuning** (cream/navy) on device until it looks intentional; optional **night style**.
- **ETA + distance chips** on the route; live ETA from the routing API.
- **Haptics** on pin select / pickup drag end / arrival (already partly done).
- **Pitch/3D** buildings near pickup (optional, very Uber).
- **Skeleton / shimmer** while the map + route load.
- **Offline tile cache** (MapLibre) for poor-connectivity areas.

## 5. Recommendation

1. **Do a dev build now and evaluate the real react-native-maps map.** iOS is the fastest (no key):
   `eas build --profile development -p ios`. This tells us how much is "fallback" vs real gaps.
2. **Stay on react-native-maps** (already wired, mature, free on iOS) and **build the P0 polish layer** —
   animated/rotating driver marker, camera choreography, `@gorhom/bottom-sheet`, center-pin pickup. That's what
   actually delivers the Uber/InDrive feel, on the engine we already have.
3. **Borrow from mapcn-rn** as a design reference (it's open source) rather than adopting MapLibre — unless you
   specifically want pixel-perfect vector cream styling everywhere, in which case switch the engine to
   MapLibre and use mapcn-rn components (accepting a token on both platforms).
4. Only revisit **expo-maps** later, once it leaves alpha.

**Bottom line:** the feel comes from the **polish layer (P0)**, not the map vendor. Ship a dev build, then
invest in animated markers + camera + bottom sheet on react-native-maps.
