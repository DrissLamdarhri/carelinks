# CLAUDE.md — CareLink

CareLink is an **on-demand home-care marketplace for Morocco** (InDrive-style reverse bidding). Patients
post care requests; verified professionals (nurse, psychologist, yoga instructor, physiotherapist) bid;
the patient accepts a bid, then gets live tracking, chat, payment, and rating. Prices in **MAD**, UI in
**French** (also Arabic + Darija). Backend is **Supabase** (Postgres + Auth + Realtime + Storage + Edge Functions).

> Deeper docs live in [`docs/`](docs/). Read [`docs/architecture.md`](docs/architecture.md) first, and
> [`docs/tech-debt-and-security.md`](docs/tech-debt-and-security.md) before shipping anything.

## Repo layout (pnpm monorepo — `pnpm-workspace.yaml`: `.`, `shared`, `mobile-app`)

| Path | What it is | Stack |
|------|-----------|-------|
| `src/` | **Web app** — iPhone-preview patient/pro flows + real desktop admin at `/admin` | Vite + React 18 + react-router 7 + Tailwind v4 + shadcn/ui |
| `mobile-app/` | **Mobile app** — the primary product, self-contained | Expo SDK 54, Expo Router, React 19, RN 0.81, NativeWind |
| `supabase/` | DB schema (`.sql`), RLS, triggers, and Edge Functions | Postgres + PostGIS + Deno/Hono |
| `shared/` | Legacy shared lib (auth/i18n/supabase/realtime/DAL) | **Not imported by `mobile-app`** — see note below |
| `utils/supabase/info.ts` | Web Supabase `projectId` + anon key | — |

**Supabase project ref:** `wjhzrovmktekfcjohhrw`. Edge Function base path: `make-server-aa5d1aa6`.

## Backend: one source of truth — Postgres

The **entire product runs on direct Postgres tables** under RLS + Realtime: the
**mobile app** (the product) and the **web admin panel** (`/admin`). A typed DAL
(`mobile-app/lib/db/dal.ts`, `src/lib/db/dal.ts`) reads/writes relational tables
(`bookings`, `bids`, `payments`, `professionals`, …). **Build here.**

The old **Figma-Make KV edge function** (`make-server-aa5d1aa6`) + its
`kv_store_aa5d1aa6` blob table + the web "iPhone preview" patient/pro demo have
been **retired** — there is no second backend. The only edge functions left are
`send-approval-email` / `send-rejection-email`. Details: [`docs/architecture.md`](docs/architecture.md).

> One leftover cleanup on the Supabase side: the deployed `server` function + the
> `kv_store_aa5d1aa6` table still physically exist in the project — drop them when
> convenient (`supabase functions delete server`; `drop table kv_store_aa5d1aa6;`).

## Commands

```bash
# Install everything from the repo root (workspaces are linked)
pnpm install

# Web app (root) — Vite dev server; admin at /admin
pnpm dev
pnpm build

# Mobile app (Expo) — run from the mobile-app workspace
pnpm -C mobile-app start          # Metro, LAN
pnpm -C mobile-app start:tunnel   # ngrok tunnel (device on different network)
pnpm -C mobile-app android        # / ios / web
pnpm -C mobile-app lint
pnpm -C mobile-app type-check     # tsc --noEmit
pnpm -C mobile-app build          # eas build (see mobile-app/eas.json)
```

There is **no test suite**. Verify changes by `type-check` + running the app.

## Environment / config

- **Mobile** reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`mobile-app/lib/supabase.ts`),
  but **falls back to hardcoded project URL + anon key** if unset. No `.env` is committed.
- **Web** reads `utils/supabase/info.ts` (`projectId` + `publicAnonKey`).
- **Edge Functions** need `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; email functions
  need `RESEND_API_KEY` + `APP_URL`.
- Mobile deep-link scheme: `ma.carelink.app` (OAuth callback `ma.carelink.app://auth/callback`).

## Conventions & gotchas

- **Mobile imports use `@/*`** → the `mobile-app/` root (`tsconfig.json` paths). Data access is via the `db`
  object from `@/lib/db/dal` — **prefer the DAL over raw `supabase.from(...)`** (a few screens like
  `RatingForm` bypass it — don't copy that).
- **`mobile-app` does NOT use the `shared/` package** — it has its own `lib/` copies of auth/i18n/supabase/
  realtime/DAL. `shared/` serves the web/legacy path. Editing `shared/` will not affect the mobile app.
- **Auth roles:** DB uses `professional`; app code often maps it to `pro`. Role gate is `mobile-app/app/index.tsx`
  (patient → `/patient`, pro → forced MFA → `/pro`, admin → `/admin`).
- **Pros are forced through MFA (TOTP/SMS, AAL2)** before reaching `/pro`. See `mobile-app/lib/hooks/useMfa.ts`.
- **i18n locales are `fr | ar | dar`** (French / Arabic / Darija-in-Latin) — **no English**. `ar` forces RTL
  (needs app restart). Strings are inline dictionaries, not translation files.
- **Maps are 100% custom SVG** (`mobile-app/components/map/`, `react-native-svg` + `expo-location`) — **no
  Google/Apple Maps SDK, no API key**. The `mobile-app/src/components/map/` stack is **legacy/dead** (README says delete).
- **`zustand` is a dependency but is never used** — global state is React Context only (`AuthProvider`, `I18nProvider`).
- Booking status flow: `open → matched → in_progress → completed | cancelled`. Bid status: `pending →
  accepted | rejected | withdrawn`.

## Known dead / duplicated code (don't extend these)

`app/pro/index6.tsx`, `profile6.tsx`, `app/patient/tracking/[bookingId]C.tsx` + the commented-out top half of
`[bookingId].tsx`, `*_layoutBefore.tsx`, the nested `mobile-app/mobile-app/` dir, `mobile-app/src/`,
`BookingMapC*.tsx`, unmounted `SubscriptionProvider`. Full list: [`docs/tech-debt-and-security.md`](docs/tech-debt-and-security.md).

## Security must-knows (before any deploy)

Hardcoded admin secret `carelink-admin-2024` and demo creds `admin@carelink.ma` / `CareLinkAdmin2024!` are
committed and shipped in the web bundle; the web admin gate trusts a `localStorage` flag; several
`supabase/fix-rls-*.sql` scripts **loosen or disable RLS** (`fix-rls-policies-option2.sql` disables storage
RLS globally). These are dev shortcuts — **do not apply the "fix"/"nuclear" RLS scripts in production**. See
[`docs/tech-debt-and-security.md`](docs/tech-debt-and-security.md).
