# Web App (`src/`)

Vite + React 18 + react-router 7 + Tailwind v4 + shadcn/ui (+ some MUI). Two visual contexts: an
**iPhone-preview shell** for patient/pro flows, and **real desktop admin** pages at `/admin`.

- Entry: `src/main.tsx` → `src/app/App.tsx` → `src/app/routes.tsx`.
- Uses **both** data paths (see [architecture.md](architecture.md#the-dual-data-path)) — often in the same file.

## Routing (`src/app/routes.tsx`)

```
/                         MobileShell (iPhone bezel) → <Outlet/>
  index                   Onboarding
  auth/patient            PatientAuth        auth/pro   ProLogin
  /app/*  (RequireAuth role=patient + AppLayout tab bar)
     index dashboard · request · waiting · offers · provider/:id · tracking
     rating · yoga · psychologist · chat · bookings · profile
  /register               NurseRegistration  (KYC, unguarded)
  /nurse/* (RequireAuth role=pro + NurseLayout)
     index dashboard · schedule · earnings · profile
/admin                    AdminLogin         (full desktop, no frame)
/admin/dashboard          RequireAuth role=admin + AdminPanel
/admin/prd                CarelinePRD        /design-preview  MobileDesignPreview
```

`MobileShell` is purely presentational (phone frame + `<Outlet/>`).

## Components by domain (`src/app/components/`)

**Shells/layout:** `MobileShell`, `AppLayout` (patient tabs), `NurseLayout` (pro tabs), `MobileDesignPreview`
(design-parity page), `CarelinkPRD` (internal PRD screen; export is `CarelinePRD`).

**Patient:** `Onboarding`, `PatientAuth`, `PatientDashboard`, `NurseBooking` (create request), `WaitingOffers`
(watch bids), `NurseOffers` (accept), `ProviderProfile`, `LiveTracking`, `RatingScreen`, `YogaCatalog`,
`PsychologistBooking`, `ChatScreen`, `MyBookings`, `ProfileScreen`.

**Nurse/pro:** `NurseRegistration` (KYC signup), `NurseDashboard` (home + open-bookings feed),
`NurseEarnings`, `NurseProfile` (radius/geo), `KycUploader` (upload to `pro-documents` bucket).

**Admin (desktop):** `AdminLogin`, `AdminPanel` (main dashboard), `AdminMetrics` (GMV/take-rate/disputes),
`KycModerationQueue` (approve/reject → flip `verification_status`), `ProfessionalsManager`.

**Shared widgets:** `NotificationBell` (`useUserNotifications`), `LiveBidsFeed`, `LiveBookingsFeed`,
`LiveChat`, `LiveTrackingChannel` (pro broadcasts GPS every 10s), `BookingMap` (SVG pin+radius),
`RadiusSlider`, `RatingForm`, `ReviewsList`, `PaymentSheet` (CMI/Stripe/cash), `CancellationDialog`
(<2h → 50% fee), `YogaSessionForm`, `LocaleSwitcher`, `GoogleButton`, `RequireAuth`, and `ui/` (48 shadcn
primitives) + `figma/ImageWithFallback`.

## Which data path does a component use?

- **Path A (KV Edge Function via `src/lib/api.ts`):** most patient/pro/admin screens — `AdminPanel`,
  `AdminLogin`, `NurseRegistration`, `NurseBooking`, `NurseDashboard`, `NurseEarnings`, `NurseProfile`,
  `NurseOffers`, `ProviderProfile`, `WaitingOffers`, `LiveTracking`, `MyBookings`, `PatientAuth`,
  `PatientDashboard`, `ProfileScreen`, `RatingScreen`, `ProLogin`, `NurseLayout`.
- **Path B (direct tables via `src/lib/db`):** `KycUploader`, `LiveBookingsFeed`, `LiveBidsFeed`, `LiveChat`,
  `ChatScreen`, `RatingForm`, `NotificationBell`, `BookingMap`, `YogaSessionForm`, plus admin
  moderation/metrics/payment/reviews/tracking widgets (direct `supabase`).
- **Both in one file:** `NurseBooking`, `MyBookings`, `WaitingOffers`, `NurseDashboard`, `NurseProfile`.

## Auth (web)

- `src/lib/supabase.ts` — singleton browser client (PKCE, persistSession), keys from `utils/supabase/info.ts`.
- `src/lib/auth-context.tsx` — `AuthProvider`/`useAuth`; wraps Supabase Auth, augments session with a KV
  profile (Path A). `signInWithGoogle(intendedRole)`. **Admin flag `isAdminAuthed` lives in `localStorage`
  (`carelink_admin_authed`)** — separate from the Supabase session.
- `RequireAuth.tsx` — for `role="admin"` it only checks that localStorage boolean (⚠️ client-trusted, see
  [tech-debt-and-security.md](tech-debt-and-security.md)); otherwise requires a Supabase user with matching
  `profile.role`.
- `AdminLogin.tsx` — tries real Supabase admin auth first, then falls back to the hardcoded demo creds
  (which are also **rendered on the login screen**).

## Other libs

- `src/lib/i18n.tsx` — `fr | ar (RTL) | dar`; persists to localStorage + best-effort `profiles.locale`.
- `src/lib/push.ts` — Web Push (service worker `/sw.js` + VAPID). ⚠️ `VAPID_PUBLIC_KEY` is a placeholder — non-functional.
- `src/lib/db/{dal,realtime,geo}.ts` — same DAL/Realtime/geo shape as mobile (Path B).
