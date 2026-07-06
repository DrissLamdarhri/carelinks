# Map System — Audit, Unification Plan & Roadmap

Scope: the mobile map surfaces. Written 2026-07-03 ahead of the release. Read alongside
[maps-i18n-design.md](maps-i18n-design.md).

> **Update (2026-07-03, later):** Went **real maps** with **`react-native-maps`** (simpler than MapLibre —
> works in Expo Go, no key for dev/iOS). Booking screen is wired to the new `CareLinkMapView`; see
> [real-map-setup.md](real-map-setup.md). Tracking migration is the next step. Original status below.
>
> **Status (2026-07-03):** Decision taken — **Option A now, Option B later**. Shipped in this pass:
> tracking screen unified onto the cream `StaticMapLayer` design; `BookingMap` now centers on the patient's
> real GPS and plots **real** nearby pros (`geo.findNearbyProsForMap` over `v_pros_public`) with an empty
> state instead of fake people; hardcoded "Karim Benali" removed for real bookings; all dead map files
> deleted (`CareLinkMap`, `CareLinkMapCanvas`, `MapCanvas`, `ProPin`, `MapSectionNative`, `TrackingMap`,
> `BookingMapC/C2`, `[bookingId]C.tsx`, `lib/map/mapEngine.ts`, the whole `mobile-app/src/` legacy tree).
> Type-check green. **Still open:** items marked ⏳ below, and flipping `demoMode=false` in `request.tsx`
> once real approved pros with locations are seeded.

## 1. Inventory — what actually renders a map

| # | Surface | Screen | Component | Current look | Status |
|---|---------|--------|-----------|--------------|--------|
| 1 | **Booking** | `app/patient/request.tsx` | `components/BookingMap.tsx` → `map/StaticMapLayer` + `map/Pins` + `map/engine` | Cream/navy (the target design) | **Keep — this is the reference** |
| 2 | **Live tracking** | `app/patient/tracking/[bookingId].tsx` | inline `MapBackground` (green `#D4E8C2`) + `VousPin` + `ProMapPin` | Green, different pins | **Convert to #1's design** |
| — | Tracking (legacy) | `app/patient/tracking/[bookingId]C.tsx` | `components/TrackingMap.tsx` | — | Dead — delete |
| — | Map variants | `components/BookingMapC.tsx`, `BookingMapC2.tsx`, `map/CareLinkMapCanvas.tsx`, `map/MapCanvas.tsx` | — | Dead — delete |
| — | Legacy stack | `mobile-app/src/components/map/*` | — | Dead (react-native-maps/MapTiler, never wired) — delete |

**The reusable design system** (keep + build on):
- `components/map/engine.ts` — projection math + hardcoded Fès roads/greens/water/labels + `specialtyColor()`.
- `components/map/StaticMapLayer.tsx` — the cream SVG backdrop (roads, parks, water, bilingual labels, vignette). Rendered once, panned via native transform (fast).
- `components/map/Pins.tsx` — `PatientPin` (navy teardrop), `ProPin` (colored initials bubble + name/distance label).

## 2. The blocking truth: this is a hand-drawn fake map of central Fès only

`engine.ts` hardcodes the road network, place labels (Fès, Narjiss, Agdal, Atlas…), parks and water as
fixed lat/lng for a ~3 km patch of **Fès**, centered on `MAP_CENTER = 34.037, -5.004`. Consequences:

- A patient in **Casablanca, Rabat, Marrakech, Tanger** sees **Fès streets** under their pin. The geography is fictional everywhere except central Fès.
- The booking map's pros are **hardcoded demo people** — `DEMO_PROS` (Fatima Zahra, Karim Mansour, Samira Rifai) in `BookingMap.tsx`. `request.tsx` never passes real nearby pros, so **every user sees the same 3 fake nurses** at fake positions.
- The tracking screen's pro defaults to **"Karim Benali"** and animates along a demo route when live data is absent.

This is fine for a demo/pitch. It is **not** shippable as a real product feature: it misrepresents location,
which for a home-care app touching addresses and ETAs is a trust/accuracy problem, not just cosmetics.

**→ This forces a decision (see §5) before "top notch like big apps" means anything.**

## 3. Unification plan (make tracking match the booking design)

Low-risk, ~1 day. Introduce one shared view and point both screens at it.

1. **Create `components/map/CareLinkMapView.tsx`** — wraps `StaticMapLayer` + a pins/route layer + standard
   overlay slots (search bar, GPS, ETA pill). Props: `mode: "booking" | "tracking"`, `center`, `patient`,
   `pros[]` or `pro` (moving), `route?`, `radiusKm?`, overlay render-props.
2. **Refactor `request.tsx` / `BookingMap`** to render `CareLinkMapView mode="booking"`.
3. **Refactor `tracking/[bookingId].tsx`** to render `CareLinkMapView mode="tracking"` — delete the inline
   `MapBackground` (green) + `VousPin`; reuse `StaticMapLayer` (cream) + `PatientPin`. Keep the animated pro
   pin + route line + ETA logic.
4. **Delete dead code:** `[bookingId]C.tsx`, `TrackingMap.tsx`, `BookingMapC.tsx`, `BookingMapC2.tsx`,
   `map/CareLinkMapCanvas.tsx`, `map/MapCanvas.tsx`, `mobile-app/src/components/map/`, and the commented-out
   top half of `tracking/[bookingId].tsx`.
5. **Single source of truth for pins/colors:** everything goes through `Pins.tsx` + `specialtyColor()`.

Result: both maps identical cream/navy look, one codebase, no green outlier.

## 4. Issues / improvements / enhancements

### 🔴 P0 — must fix before release (correctness / trust)

1. ✅ **Real nearby pros, not `DEMO_PROS`.** `geo.findNearbyProsForMap(lat,lng,{specialty})` reads
   `v_pros_public`, sorts by haversine distance, and feeds `BookingMap`. Empty → empty-state pill. `DEMO_PROS`
   now gated behind the `demo` prop (still on while `demoMode=true`).
2. ✅ **Map follows the user's real location.** `BookingMap` projects pins around the patient's GPS
   (`initialLat/Lng`), so the patient pin is always centered and pros plot at true relative distance.
3. 🟡 **Pins at real coordinates.** Patient + booking pro pins now use real coords; tracking pro pin uses the
   real `LiveTrackingChannel` broadcast. ⏳ Pro pins depend on `v_pros_public` exposing `location` — verify
   seeded data.
4. ✅ **Removed hardcoded identity** ("Karim Benali") for real bookings (demo keeps it). ⏳ Add a proper
   skeleton while the live pro profile loads.
5. ✅ **Location permission UX.** Pre-permission rationale alert before requesting; denied/blocked shows an
   Alert with an "Ouvrir les réglages" CTA (`Linking.openSettings`); empty state + GPS error message in.
   ⏳ A dedicated full-screen rationale (vs. Alert) is a nice-to-have.

### 🟠 P1 — strongly recommended (feels unfinished without these)

6. ✅ **Pinch-to-zoom.** `PinchGestureHandler` scales the shared map+pins layer (GPU-only, clamped
   0.7–2.6×); pan defers to pinch on two fingers. ⏳ Uses the deprecated classic RNGH API — migrate to
   `Gesture.Pinch()` + Reanimated when the map is next touched. ⏳ True zoom *levels* (re-projection for
   sharper detail) still deferred — this is visual scale only.
7. ✅ **Reverse-geocode the dropped pin into the address field.** `geo.reverseGeocodeAddress` fills
   "Entrez votre adresse" on GPS use and on `onChange`.
8. **Recenter/"my location" always visible + working.** The GPS button currently just springs pan to center;
   make it re-fetch GPS and re-center on the user.
9. **Distance/ETA from real data.** Distances shown on pins (`0.8km`, `1.4km`) come from demo fields; compute
   with `haversineKm(user, pro)`.
10. **Empty / error / offline states.** No-pros, GPS-off, no-network, and reverse-geocode-failed all need
    designed states.
11. **Marker collision / clustering.** When many pros overlap, labels stack unreadably (visible even with 3).
    Add simple declutter or clustering at low zoom.
12. **Accessibility.** Pins/buttons need `accessibilityLabel`/`accessibilityRole`; SVG text isn't read by
    screen readers.
13. **RTL correctness.** In Arabic, overlay chrome (search bar, ETA pill, back button) must mirror; verify pin
    labels don't break.

### 🟡 P2 — "top notch like big apps" polish

14. ✅ **Live route polyline that follows roads**, with the **traversed portion dimmed** and the remaining
    portion solid navy as the pro advances (Uber-style); straight dashed line kept only as a no-route fallback.
15. **Smooth pro-marker interpolation + heading rotation** (marker rotates to direction of travel).
16. **Camera choreography:** auto-fit patient+pro bounds, then follow the pro; animated padding for the bottom
    sheet.
17. **Bottom-sheet gestures:** snap points (peek / half / full), drag handle, momentum — replace the static
    sheet.
18. **Pin polish:** selected-state elevation, subtle pulse on the user pin, price/rating bubbles, avatar
    photos with initials fallback (`AvatarWithDefault` already exists).
19. **Map theming per service** (nurse navy / kiné green / psy purple / yoga cyan) to match `service-theme.ts`.
20. ✅ **Haptics** on pin select / GPS locate / "arrived" (`lib/haptics.ts`, built-in Vibration — Android
    taps + arrival buzz on both). ⏳ Upgrade to `expo-haptics` for true iOS impact feedback.
21. **Dark mode** map palette.
22. **Performance:** memoize projected pin positions per zoom, cap re-renders, verify 60fps on a low-end
    Android (the app targets Morocco — mid/low-end devices dominate).

## 5. The strategic decision — stylized map vs real map SDK

"Top notch like big apps" (Uber/InDrive/Careem) means **real streets everywhere**. The current engine can't do
that — it's a drawing of Fès. Two viable directions:

- **Option A — Keep the stylized custom map (fast path, ~a few days, ships next week).**
  Keep the beloved cream/navy look and the SVG engine, but make it *honest*: replace the hardcoded Fès
  streets with a **generic, location-agnostic stylized backdrop** (abstract streets/parks that don't claim to
  be a specific place), center on the user's real GPS, and plot **real** pro/patient pins by relative offset.
  Pros: no API key, works in Expo Go, on-brand, cheap, low risk. Cons: not real cartography — no actual street
  names/buildings; acceptable as a stylized "radar" of who's nearby, not turn-by-turn.

- **Option B — Real map SDK, themed to this look (proper path, ~2–4 weeks).**
  Adopt `react-native-maps` (Google) or **MapLibre + MapTiler** with a **custom cream/navy style JSON** so real
  streets render in the brand aesthetic. Real geography everywhere, real routing, clustering, etc. Cons:
  requires API keys + billing, an EAS **dev build** (breaks Expo Go), style tuning, and more time than a
  one-week window comfortably allows.

**Recommendation for a next-week release:** ship **Option A** now (honest stylized map + real pins + real
location + P0/P1 fixes), and schedule **Option B** as a fast-follow. This keeps the design the user loves,
removes the "fake Fès + fake nurses" credibility problem, and fits the timeline.

> **Option B is now spec'd end-to-end** in [map-option-b-maplibre.md](map-option-b-maplibre.md) — a turnkey
> MapLibre + MapTiler migration (deps, app.json plugin, cream/navy style, `CareLinkMapView` code that reuses
> the existing pins via `MarkerView`, routing, and a device verify runbook). It's a one-import swap per screen
> with a fallback, executable once a MapTiler key + EAS dev build exist. The deferred marker-heading (#15) and
> bottom-sheet snap points (#17) are specified there, to be built on the real-map surface rather than twice.
