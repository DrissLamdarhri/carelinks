# Maps, i18n, Design System & Subscriptions

## Map system (mobile) — 100% custom SVG, no API key

The map is a hand-built SVG renderer using `react-native-svg` + `expo-location`. **No Google/Apple Maps SDK,
no tile provider, no API key, no billing** (`mobile-app/MAP_SYSTEM_README.md` — "100% Free · No API Key").

### Active/canonical stack: `mobile-app/components/map/`
- **`engine.ts`** — pure-math projection (Mercator `project`/`unproject`, `haversineKm`, `radiusToPixels`).
  Contains a **hand-crafted road network / greens / water / bilingual labels hard-coded for the Fès–Meknès
  corridor** (`MAP_CENTER ≈ 34.037, -5.004`). Exports `specialtyColor()`.
- **`CareLinkMap.tsx`** — SVG renderer, two modes: `booking` (tap-to-drop pin + dashed radius ring) and
  `tracking` (patient pin + live cyan pro dot + dashed route line). Brand palette inlined (cream land
  `#EDE5CC`, navy pins `#0D0870`, cyan pro dot `#5BB8D4`).
- Also: `CareLinkMapCanvas`, `MapCanvas`, `Pins` (`PatientPin`/`ProPin`), `ProPin`, `StaticMapLayer`,
  `MapSectionNative`.
- **Two projection engines exist:** `components/map/engine.ts` and `lib/map/mapEngine.ts` (`CareLinkMap`
  imports the latter). Consolidate when touching map math.

### Pins / tracking
- **Booking:** center on device GPS or Fès; tap → pin at unprojected coord; dashed circle = search radius
  (default 5 km); reverse-geocode via **Nominatim/OpenStreetMap** (free, no key).
- **Tracking:** navy patient pin vs. cyan pro dot; live pro position from Realtime broadcast
  `tracking:{bookingId}` (see [backend-realtime-push.md](backend-realtime-push.md)); auto-fit both.
- Active screen `app/patient/tracking/[bookingId].tsx` renders an inline `MapBackground` SVG; the top of the
  file is a commented-out prior version (real code from ~line 500).

### Legacy/dead stack: `mobile-app/src/components/map/` (README says delete)
Different, older aesthetic (dark navy `#0a1628` + cyan, animated sonar rings) and a **never-finished
`react-native-maps` + MapTiler tile approach**. `mapConfig.ts` is the **only** place referencing tile
providers / an API key (`MAPTILER_KEY` placeholder) — unused by the active custom-SVG system. Only reached by
a commented-out import. Do not build on it.

## Internationalization

- **Mobile (`mobile-app/lib/i18n.tsx`):** React Context. **Locales: `fr | ar | dar`** — French, Arabic,
  Darija (Moroccan Arabic in Latin script, e.g. "Mer7ba"). **No English.** `fr` is default + fallback.
  Strings are inline `DICT` objects (~45 keys/locale), not external files. Persists to AsyncStorage
  (`carelink_locale`) + writes `profiles.language`.
- **RTL:** `ar` triggers `I18nManager.forceRTL(true)` (needs app restart via expo-updates); others LTR.
- **Web (`src/lib/i18n.tsx`):** same locales, persists to localStorage + sets `document.dir`/`lang`.

## Design system / brand

**Current brand:** navy **`#0D0870`** (primary) + cyan/teal accent (`#5BB8D4`) + cream (`#EDE5CC`). Fonts:
**DM Sans** (body/UI) + **DM Serif Display** (headings).

- **Mobile `lib/colors.ts`** — `primary #0D0870`, `primaryLight #1A1585`, `accent #5BB8D4`; status colors;
  `Gradients` incl. per-service (nurse navy, psy purple, yoga cyan, kine green); `KineColors`; `DEFAULT_AVATAR`.
- **Mobile `lib/service-theme.ts`** — `getServiceTheme(key)` + `isKineService()`; theming is essentially
  **nurse/default (navy) vs. kiné (green)**, with psy/yoga via gradients.
- **Web tokens `src/styles/theme.css`** — NurseGo navy/cream/teal at top, then a shadcn/Tailwind-v4 oklch
  token layer. Note the shadcn `--primary` (`#030213`) differs from the brand `--color-primary` (`#0D0870`).
  Fonts imported in `src/styles/fonts.css`.

⚠️ **Three palettes coexist** across artifacts (design debt):
1. Original **teal** (`src/imports/pasted_text/carelink-design-system.md`) — the old Figma brief.
2. The **navy/cream/teal rebrand** (`nursego-color-tokens.css`, `theme.css`, mobile `colors.ts`) — **current**.
3. Legacy **dark-cyan** map theme (`src/components/map`) — dead.

When adding UI, follow palette #2 (navy/cream/teal, DM Sans/DM Serif).

## Subscriptions & payments

### Subscriptions (feature-flag paywall)
- `mobile-app/lib/hooks/useSubscription.ts` — `SubscriptionProvider` queries `subscriptions` table
  (`maybeSingle`, tolerates a missing table) on mount / user change / app-foreground, and subscribes to
  realtime `private-user-{userId}` (`subscription.updated` / `.rollback`). Exposes `hasFeature(feature)` over
  a `Set` of `subscription.features`.
- `mobile-app/components/SubscriptionGate.tsx` — renders `children` only if the required `feature` is present,
  else `fallback` (default `null`). **Per-feature-flag, not per-tier.**
- ⚠️ **`SubscriptionProvider` is never mounted** in the app tree, so gating is currently inert (always
  default/inactive). And there is **no `subscriptions` table DDL** in `supabase/` — see
  [database.md § Schema gaps](database.md#schema-gaps-referenced-in-code-but-not-fully-in-checked-in-sql).

### Payments (per-booking escrow — separate from subscriptions)
`supabase/payments.sql`: **provider-agnostic** (`cmi` for Morocco, `stripe`, `cash`). Flow: authorize on bid
accept → **capture on booking `completed`** → refund on `cancelled`, via `capture_on_complete()` trigger.
**15% platform commission** (`calc_commission()`). Web `PaymentSheet` targets a `payments-authorize` idea but
in demo just inserts an `authorized` row.
