# Architecture

## Monorepo

pnpm workspace (`pnpm-workspace.yaml` → `.`, `shared`, `mobile-app`).

```
carelinks/
├─ src/                    Web app (Vite + React 18 + react-router 7). iPhone-preview
│                          patient/pro flows + real desktop admin at /admin.
├─ mobile-app/             Mobile app (Expo SDK 54, Expo Router, React 19, RN 0.81, NativeWind).
│                          The primary product. Self-contained — does NOT import shared/.
├─ supabase/              *.sql schema/RLS/triggers + Edge Functions (Deno/Hono).
├─ shared/                Legacy shared lib (auth/i18n/supabase/realtime/DAL) — used by web/legacy,
│                          NOT by mobile-app.
├─ utils/supabase/info.ts Web Supabase projectId + anon key.
└─ *.md / *.sql (root)    ~30 historical implementation notes & one-off SQL fixes (see below).
```

**Supabase project ref:** `wjhzrovmktekfcjohhrw`. Edge Function base: `.../functions/v1/make-server-aa5d1aa6`.

> The ~30 markdown files at the repo root (`ADMIN_*`, `PROFESSIONAL_*`, `DOCUMENT_UPLOAD_*`, `*_FIX*.md`,
> etc.) are point-in-time implementation notes from prior work. They are historical, sometimes stale, and
> **superseded by these `docs/`**. Treat them as changelog, not spec.

## The dual data path

This is the defining feature of the codebase. The two apps reach the backend through two mechanisms with
**different, unsynchronized data models**.

### Path A — KV Edge Function (web / demo backend)

```
src/lib/api.ts  ──HTTP──▶  supabase/functions/server/index.tsx  (Hono, Deno)
                            └─ reads/writes JSONB blobs in table kv_store_aa5d1aa6
                               keys: user:*, pro:*, request:*, offer:*, booking:*, admin:stats, ...
```

- Domain terms: **request** (patient) and **offer** (pro bid).
- Auth: Supabase session token in `Authorization: Bearer`, else anon key. Admin routes gated by
  `X-Admin-Key: carelink-admin-2024` (hardcoded) **or** a real admin profile.
- This is what Figma Make generated. It duplicates the whole domain in a KV store.

### Path B — Direct Postgres tables (mobile / production)

```
mobile-app/lib/db/dal.ts  ──▶  supabase-js  ──▶  relational tables (RLS-enforced)
src/lib/db/dal.ts               profiles, patients, professionals, bookings, bids, ratings,
                                yoga_sessions, messages, notifications, addresses, ...
+ lib/db/realtime.ts            Supabase Realtime (postgres_changes) for live bids/bookings/messages
+ lib/db/geo.ts                 PostGIS RPCs (set_pro_location, set_booking_location, find_pros_within)
```

- Domain terms: **booking** (patient) and **bid** (pro).
- This is the intended production model: typed DAL, RLS, triggers, PostGIS, Realtime.

### Consequences

- **No sync between A and B.** A patient request created via Path A (KV) will not appear in Path B queries
  and vice-versa (aside from best-effort dual-writes the Edge Function attempts — see
  [backend-realtime-push.md](backend-realtime-push.md)).
- Several web components import **both** paths in one file (`NurseBooking`, `MyBookings`, `WaitingOffers`,
  `NurseDashboard`, `NurseProfile`).
- **Rule of thumb:** the mobile app is 100% Path B. New work should target Path B (relational + DAL +
  Realtime). Path A should be considered legacy/demo.

There is even a **third partial duplication**: two messaging models — the `messages` table (schema.sql, used
everywhere) vs. a `conversations`/`conversation_messages` model (`supabase/profile-messaging.sql`, largely unused).

## Marketplace flow (Path B — the real one)

```
Patient                              Professional                      Admin
───────                              ────────────                      ─────
create booking (status=open) ──┐     KYC: upload docs + MFA
  request.tsx / db.bookings.create   pro/kyc.tsx                       approve pro
                               │                                       admin/kyc.tsx
   open booking fans out ──────┴───▶  sees open bookings by specialty
   (Realtime: bookings:specialty)     LiveBookingsFeed
                                      submit bid ──┐ db.bids.create
   watch bids (Realtime) ◀────────────────────────┘
   waiting/[bookingId], offers/[bookingId]
   accept bid:
     db.bids.accept()  (1 accepted, rest rejected)
     db.bookings.acceptBid() → status=matched, professional_id set, final_price
                               │
   live tracking ◀── Realtime broadcast tracking:{bookingId} ──▶ pro streams GPS every 10s
   chat  ◀── Realtime messages:booking:{id} ──▶
   status → in_progress → completed
   rate pro → ratings table → trigger recalcs professionals.rating_avg
```

Payment runs alongside as a per-booking escrow (`supabase/payments.sql`): authorize on accept → capture on
`completed` → refund on `cancelled`, 15% platform commission. Providers: `cmi | stripe | cash`.

## Auth & roles

- **Provider:** Supabase Auth (email/password, Google OAuth, Apple OAuth). PKCE flow. Sessions persisted in
  `AsyncStorage` (mobile) / `localStorage` (web).
- **Roles:** DB enum is `patient | professional | admin`; app code frequently normalizes `professional → pro`.
- **Profiles:** `public.profiles` extends `auth.users` (shared PK). A `handle_new_user` trigger auto-creates a
  profile row on signup (role from `raw_user_meta_data`). App code also upserts profiles/patients/professionals
  defensively in `auth-context`.
- **Mobile role gate:** `mobile-app/app/index.tsx` — no user → `/auth`; `pro` → **forced MFA** (`/auth/mfa-setup`
  if not enrolled, `/auth/mfa-challenge` if session not AAL2) → `/pro`; `admin` → `/admin`; else `/patient`.
- **MFA:** TOTP (QR) or SMS OTP, targeting Supabase assurance level `aal2`. Logic in
  `mobile-app/lib/hooks/useMfa.ts` + `auth-context.tsx`. Pros cannot reach their dashboard without it.
- **Web admin gate is weak:** `RequireAuth role="admin"` only checks `localStorage.carelink_admin_authed`.
  See [tech-debt-and-security.md](tech-debt-and-security.md).

## Tech stack summary

| Layer | Web (`src/`) | Mobile (`mobile-app/`) |
|-------|-------------|------------------------|
| Framework | React 18, react-router 7 | React 19, Expo Router 6 |
| Build | Vite 6 | Metro / EAS |
| Styling | Tailwind v4 + shadcn/ui + MUI | NativeWind (Tailwind 3) + StyleSheet |
| State | React Context | React Context (`zustand` present but unused) |
| Icons | lucide-react | lucide-react-native, @expo/vector-icons |
| Maps | inline SVG (`BookingMap`) | custom SVG engine (`components/map/`) |
| Data | `lib/api.ts` (KV) + `lib/db` (tables) | `lib/db` (tables) only |
| Backend | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions on Deno/Hono) | same |
