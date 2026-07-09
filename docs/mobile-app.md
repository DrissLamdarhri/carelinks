# Mobile App (`mobile-app/`)

Expo SDK 54 · Expo Router 6 · React 19 · RN 0.81 · NativeWind. **The primary product.** 100% Path B
(direct Postgres tables via the DAL). Self-contained — does **not** import the `shared/` package.

- Entry: `expo-router/entry` → `app/_layout.tsx`.
- Path alias: `@/*` → `mobile-app/` root (`tsconfig.json`).
- Deep-link scheme: `ma.carelink.app`.

## Bootstrapping (`app/_layout.tsx`)

Wraps the tree in `AuthProvider` + `I18nProvider` + `SafeAreaProvider`, loads DM Sans / DM Serif fonts,
calls `configureNotifications()`, and mounts `DeepLinkHandler` which routes incoming OAuth deep links to
`/auth/callback`. Declares four Stack groups: `auth`, `patient`, `pro`, `admin`.

`app/index.tsx` is the **role gate** (see [architecture.md § Auth](architecture.md#auth--roles)): routes to
`/auth`, `/patient`, `/pro` (via forced MFA), or `/admin`.

## Routes

### `auth/` (Stack)
`index` (role picker) · `patient-login` · `pro-login` · `registration` (patient signup) ·
`pro-registration` (largest form, ~1100 lines) · `callback` (OAuth code exchange) · `mfa-setup` (TOTP
enroll) · `mfa-challenge` (AAL2 step-up) · `mfa-settings`.

### `patient/` (Tabs — visible: home, explorer, bookings, chat, profile)
- `index` — home / service categories.
- `yoga` — **the "Explorer" tab** (yoga browse + booking) — note the filename ≠ tab meaning.
- `psychologist` — psychologist browse + booking.
- `request` — **core booking-creation form** (~800 lines): upserts patient, `db.bookings.create({status:open})`, sets geo.
- `bookings` — "Mes RDV", realtime list (`usePatientBookings`), cancellation dialog.
- `messages` — chat/conversation list built from bookings + counterpart profiles.
- `notifications` — thin wrapper over `<NotificationPreferences>`.
- `profile` / `profile-infos` — view / edit profile (+ `db.patients.upsert`).
- `patient-policy` — consent/policy acceptance.
- `addresses` — address CRUD + default (`db.addresses.*`).
- **Dynamic:** `offers/[bookingId]` (bids list + accept/reject) · `waiting/[bookingId]` (live pending bids) ·
  `chat/[bookingId]` (`<LiveChat>`) · `rating/[bookingId]` (`<RatingForm>`) · `payment/[bookingId]` ·
  `provider/[id]` (public pro profile) · `tracking/[bookingId]` (**live tracking**, real code from ~line 500;
  top half is commented-out legacy).

### `pro/` (Tabs — visible: home, schedule, earnings, profile)
- `index` — dashboard + online/offline toggle → quick actions to `/pro/bids`, `/pro/kyc`.
- `schedule` — "Calendrier" (`db.bookings.listForPro`).
- `earnings` — computed from `db.bookings.listForPro`.
- `profile` / `profile-infos` — view / edit pro profile + set geo location.
- `bids` — **bidding hub**: specialty selector → `<LiveBookingsFeed>`.
- `documents` / `kyc` — upload verification docs (`db.proDocuments.*`, storage upload).
- `notifications` — `<NotificationPreferences>` wrapper.

### `admin/` (Stack)
- `index` — admin login (**hardcoded creds** `admin@carelink.ma` / `<redacted>`).
- `dashboard` — KPI dashboard (some values hardcoded, some from supabase).
- `metrics` — analytics via direct supabase.
- `kyc` — **pro approval/moderation** (professionals + pro_documents + profiles, realtime `professionals:kyc`).
- `bookings` — booking moderation (exists, auto-registered though not declared in `_layout`).

## Core flows → DAL calls

| Flow | Screens | DAL / mechanism |
|------|---------|-----------------|
| Create booking | `patient/request` | `db.patients.upsert` → `db.bookings.create` → `geo.setBookingLocation`; also `notifyAdminNewBooking` |
| Bidding (patient) | `waiting/[id]`, `offers/[id]` | `useBookingBids` (Realtime `bids:booking:{id}`); accept → `db.bids.accept` + `db.bookings.acceptBid` |
| Bidding (pro) | `pro/bids` → `LiveBookingsFeed` | `useOpenBookingsBySpecialty`; submit → `db.bids.create` |
| Tracking | `patient/tracking/[id]` | `db.bookings.get`/`profiles.get`/`pros.get` + `<LiveTrackingChannel mode="watch">` broadcast + `MapCanvas` |
| Chat | `chat/[id]` → `<LiveChat>` | Realtime `messages:live:{id}`, insert into `messages` |
| Rating | `rating/[id]` → `<RatingForm>` | ⚠️ writes `ratings` **directly via supabase**, bypassing the DAL |
| Pro KYC | `pro/kyc`, `pro/documents` | `db.pros.get/upsert`, `db.proDocuments.*`, storage upload |
| Admin approve | `admin/kyc` | direct supabase reads + `professionals.verification_status` update |

## `lib/` modules

- **`db/dal.ts`** — the typed DAL: `db.{profiles, patients, pros, proDocuments, bookings, bids, messages,
  addresses, notificationSettings}`. All calls go straight to Supabase tables via an `unwrap()` helper.
  **Prefer this over raw `supabase.from()`.**
- **`db/realtime.ts`** — `useBookingBids`, `usePatientBookings`, `useOpenBookingsBySpecialty` (+
  `useBookingMessages`). Subscribe on `useFocusEffect`; short-circuit for demo IDs.
- **`db/geo.ts`** — geo RPC wrappers + nearby pros. **`db/storage.ts`** — avatar/doc upload.
- **`db/types.ts`** — all DB types + `toDbSpecialty`.
- **`supabase.ts`** — singleton client; AsyncStorage auth, PKCE. **Hardcoded URL + anon-key fallback.**
- **`auth-context.tsx`** — `AuthProvider`/`useAuth`: session, profile, Google/Apple/email sign-in, signup
  (creates profiles+patients/professionals), and all MFA orchestration.
- **`auth-redirect.ts`** — OAuth redirect URI builder.
- **`i18n.tsx`** — `fr | ar | dar` provider (see [maps-i18n-design.md](maps-i18n-design.md)).
- **`push-native.ts`** — Expo push token registration + foreground handler.
- **`toast.ts`** — `showToast()` (Android Toast / iOS Alert).
- **`colors.ts`, `service-theme.ts`** — brand palette + per-specialty theming.
- **`mock-data.ts`** — `MOROCCAN_CITIES`, onboarding slides.
- **`demo-booking.ts`** — demo-mode helpers (`isDemoBookingId`, prefix `demo-`); realtime hooks skip Supabase
  for these IDs.
- **`admin/booking-notifications.ts` + `use-booking-notifications.ts`** — admin log writes + broadcast +
  read/query APIs over `admin_booking_logs`.
- **`hooks/`** — `useMfa` (TOTP/SMS/AAL, `mfaStorage`), `useSubscription` (**provider never mounted**),
  `useImageUpload`, `useDocumentPicker`, `useCameraPicker`, `useAppleAuth`.
- **`map/mapEngine.ts`** — custom SVG projection engine (one of two; see maps doc).

## State & data fetching

- **Global state = React Context only** (`AuthProvider`, `I18nProvider`). `zustand` is in `package.json` but
  **never imported** — dead dependency. `SubscriptionProvider` exists but is never mounted, so
  `SubscriptionGate`/`useSubscription` always return the inactive default.
- **Fetching** = direct `await db.*` calls in `useEffect`/`useFocusEffect`, plus the three Realtime hooks and
  ad-hoc component channels (`LiveChat`, `LiveTrackingChannel`, `admin/kyc`).

## Dead / duplicated code

See [tech-debt-and-security.md](tech-debt-and-security.md#dead--duplicated-code). Short list:
`app/pro/index6.tsx`, `profile6.tsx`, `tracking/[bookingId]C.tsx`, `*_layoutBefore.tsx`, nested
`mobile-app/mobile-app/`, `mobile-app/src/`, `BookingMapC*.tsx`, `adjustedInterfaces/` (design mockups).
