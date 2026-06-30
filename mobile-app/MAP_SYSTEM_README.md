# CareLink — Custom Map System
## 100% Free · No API Key · iOS + Android

---

## What's included

| File | Description |
|---|---|
| `lib/map/mapEngine.ts` | Mercator projection math + road/place data |
| `components/map/CareLinkMap.tsx` | Core SVG map renderer |
| `components/BookingMap.tsx` | Drop-in booking map (replaces old one) |
| `components/TrackingMap.tsx` | Full live-tracking map with pro dot |
| `app/patient/tracking/[bookingId].tsx` | Updated tracking screen |

---

## How to install

### 1. Copy files into your `mobile-app/`

```
mobile-app/
├── lib/
│   └── map/
│       └── mapEngine.ts            ← copy here
├── components/
│   ├── map/
│   │   └── CareLinkMap.tsx         ← copy here
│   ├── BookingMap.tsx              ← REPLACE existing file
│   └── TrackingMap.tsx             ← copy here (new)
└── app/
    └── patient/
        └── tracking/
            └── [bookingId].tsx     ← REPLACE existing file
```

### 2. No new packages needed

All packages are already in your `package.json`:
- `react-native-svg` ✅ (already installed)
- `expo-location` ✅ (already installed)
- `lucide-react-native` ✅ (already installed)

### 3. Remove old map files (optional cleanup)

These are no longer needed:
```
src/components/map/MapSection.tsx
src/components/map/MapSectionNative.tsx   ← replaced by CareLinkMap
src/components/map/MapsScreenWithMapcnRn.tsx
src/components/map/mapConfig.ts
src/components/map/mapStyles.ts
components/map/MapSectionNative.tsx
```

### 4. Verify the import in BookingMap

The new `BookingMap.tsx` imports from `./map/CareLinkMap`.
Make sure `components/map/CareLinkMap.tsx` is in place.

---

## How it works

### Why no Google/Apple Maps?

Both require API keys + billing. Instead, we use:
- **`react-native-svg`** — renders the map as scalable vector graphics
- **Mercator projection math** — converts real GPS coords to SVG pixel coords
- **Hand-crafted road network** — Fès–Meknès corridor (the app's main market)
- **Nominatim** (OpenStreetMap) — free reverse geocoding (no API key)
- **`expo-location`** — device GPS, already in your project

### Booking flow (BookingMap)

1. Map renders centered on Fès (or user's current location)
2. User taps → pin drops at tapped GPS coordinate
3. Dashed circle shows the search radius
4. Address bar below updates via reverse geocode
5. "Ma position" button snaps to device GPS

### Tracking flow (TrackingMap)

1. Patient pin (navy) = patient's location
2. Pro dot (cyan) = pro's live position from Supabase Realtime
3. Dashed line = route between them
4. Map auto-centers and auto-zooms to fit both pins
5. ETA countdown + distance displayed in status pill

---

## Extending the road network

The road data is in `lib/map/mapEngine.ts` → `ROAD_NETWORK`.
Each road is an array of GPS coordinates.

To add more roads:
```ts
{
  id: "my-road",
  type: "secondary",   // highway | primary | secondary | local
  name: "Rue example",
  coords: [
    { lat: 34.040, lng: -5.01 },
    { lat: 34.038, lng: -5.02 },
  ],
},
```

You can extract road data from OpenStreetMap (free) using the Overpass API:
```
https://overpass-api.de/api/interpreter?data=[out:json];way["highway"](34.0,−5.1,34.1,−4.9);out geom;
```

---

## Zoom levels

| Zoom value | Approximate view |
|---|---|
| 2000 | City-scale (~20 km) |
| 4000 | Neighborhood (~10 km) |
| 8000 | Street-level (~5 km) |
| 16000 | Building-level (~1 km) |

Default booking zoom: `8000` (5 km radius view)
Tracking zoom: auto-calculated from distance between pro and patient

---

## Colors

All colors come from your existing `lib/colors.ts`:
- `Colors.primary` (`#0D0870`) — navy, used for pins and labels
- `Colors.accent` (`#5BB8D4`) — cyan, used for the pro dot
- `Colors.surfaceWarm` (`#EDE5CC`) — cream, used as the map land color

---

## Free forever

- `react-native-svg` — MIT license
- `expo-location` — MIT license
- Nominatim (reverse geocoding) — FOSS, free with attribution
- Road network data — hand-crafted, owned by you
