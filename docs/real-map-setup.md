# Real map — react-native-maps (the chosen path)

CareLink uses **`react-native-maps`** for real maps: **Apple Maps on iOS, Google Maps on Android**.

> ⚠️ **Correction (verified on-device):** `react-native-maps` is a **native module and is NOT in Expo Go**
> (SDK 54 / New Architecture) — importing it there crashes with `RNMapsAirModule could not be found`. So the
> real map needs a **dev build**. To keep the app fully usable in Expo Go, `CareLinkMapView` is
> **capability-gated**: it renders the real map when the native module is present (dev/bare build), and
> **automatically falls back to the stylized SVG map** in Expo Go. No code change to switch — just build.

This supersedes the MapLibre plan in [map-option-b-maplibre.md](map-option-b-maplibre.md) — keep that only if
you later need pixel-perfect custom cartography. `react-native-maps` is simpler and is what's wired now.

## What's installed / wired

- Dependency: `react-native-maps@1.27.2` (added via `expo install`, reconciled into the pnpm lockfile).
- `components/map/CareLinkMapView.tsx` — the real-map component. Reuses the existing branded pins
  (`PatientPin` / `ProPin`) as custom `<Marker>` children, the route as `<Polyline>` (traversed dimmed /
  remaining solid), and the search radius as `<Circle>`. Re-centers on GPS via `animateToRegion`.
- `components/map/mapStyle.ts` — Google Maps **cream/navy** style array (Android). iOS uses Apple Maps
  (no JSON styling — standard Apple look).
- **Booking screen** (`app/patient/request.tsx`) **and tracking screen**
  (`app/patient/tracking/[bookingId].tsx`) are both switched to `CareLinkMapView`. Tracking passes the moving
  `pro`, the OSRM `route`, and `progressIdx` (traversed dimmed / remaining solid), and frames the whole route
  via `fitCoords`. The old stylized `BookingMap` + `StaticMapLayer`/`Pins`/`engine` are kept in the repo for
  instant rollback (one import swap per screen).

## How the gate works

`components/map/CareLinkMapView.tsx` detects the native module (`RNMapsAirModule` / `AIRMapModule`). If
present, it lazily `require()`s `CareLinkMapNative.tsx` (the only file that imports `react-native-maps`) and
renders the real map. If absent (Expo Go), it renders the stylized `StaticMapLayer` + pins fallback. Because
the `react-native-maps` import is never evaluated in Expo Go, it can't crash there.

- **Expo Go:** stylized fallback map (works today, no build, no key). Good enough to test the whole app.
- **Dev build (`eas build --profile development`):** real map, automatically.

## Cost — is it free?

- **Dev (Expo Go):** 100% free — stylized fallback, no account/key. Real map needs a dev build.
- **iOS production:** 100% free (Apple Maps).
- **Android production:** the native map **display is $0** (Google doesn't bill mobile map display), but Google
  **requires a billing account (card on file)** to issue the Android key. Routing stays on **free OSRM**, so we
  never call Google's paid Directions API. Net: no charges for what CareLink uses; an account must exist.

## Setup for Android production (only when you build the store binary)

1. Google Cloud → new project → enable **Maps SDK for Android**.
2. Create an **API key**, restrict it to Android (your package `ma.carelink.app` + SHA-1 from EAS credentials).
3. Add the config plugin in `app.json` (or migrate to `app.config.js` to read it from env):
   ```jsonc
   {
     "expo": {
       "plugins": [
         "expo-router", "expo-font", "expo-location", "expo-web-browser", "expo-image-picker",
         ["react-native-maps", { "androidGoogleMapsApiKey": "YOUR_ANDROID_KEY" }]
       ]
     }
   }
   ```
4. Rebuild (`eas build`). iOS needs nothing.

## Verify

**In Expo Go** (`pnpm -C mobile-app start`): the booking/tracking screens render the **stylized fallback map**
(cream SVG + branded pins). The whole app is usable — auth, booking flow, tracking, etc.

**Real map** (dev build): `eas build --profile development -p android` (or iOS), install the dev client, then
`pnpm -C mobile-app start --dev-client`. Open a booking → **real streets** (Apple/Google), GPS dot, cream tint
on Android, radius circle, real pros. Tracking shows the pro moving along the real route.

> The cream `customMapStyle` only applies to **Google (Android)**; iOS shows the standard Apple map with your
> branded pins on top.

## Known limitations / follow-ups

- **Pin animations freeze inside markers.** react-native-maps snapshots a custom marker view to a bitmap, so
  the pins' pulse loops don't animate in-map (they render, then freeze). We keep `tracksViewChanges` on
  briefly at mount so the custom view paints. If you want motion, use a simpler marker or a flat `image`.
- **Routing:** keeps the existing OSRM call for road-following routes (free). Don't switch to Google Directions.
- **Cream tint** is a starter in `mapStyle.ts` — refine colors against a device until it matches the brand.

## Rollback

Booking: change the import in `app/patient/request.tsx` back to `BookingMap` (still in the repo) and restore
the old props. Nothing else depends on `CareLinkMapView`.
