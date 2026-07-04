# Setup & Deployment

## Prerequisites

- Node + **pnpm** (workspace-managed). For mobile: Expo CLI / EAS, and a device with Expo Go or a dev build.
- A Supabase project (current ref: `wjhzrovmktekfcjohhrw`).

## Local setup

```bash
pnpm install                      # from repo root — links `.`, `shared`, `mobile-app`

# Web app (Vite) — admin at /admin
pnpm dev                          # http://localhost:5173 (default)
pnpm build

# Mobile app (Expo)
pnpm -C mobile-app start          # Metro, LAN
pnpm -C mobile-app start:tunnel   # ngrok tunnel — device on a different network / restrictive Wi-Fi
pnpm -C mobile-app start:usb      # localhost host (USB)
pnpm -C mobile-app android        # / ios / web
pnpm -C mobile-app type-check     # tsc --noEmit
pnpm -C mobile-app lint
```

There is **no automated test suite**. Verify by `type-check` + exercising the flow in the running app.

## Environment variables

| Where | Vars |
|-------|------|
| Mobile (`mobile-app/lib/supabase.ts`) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` — **falls back to hardcoded values if unset** (so a wrong/missing env fails silently) |
| Web (`utils/supabase/info.ts`) | `projectId`, `publicAnonKey` (committed) |
| Edge Functions | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Email functions | `RESEND_API_KEY`, `APP_URL` |
| Web push (`src/lib/push.ts`) | `VAPID_PUBLIC_KEY` (currently a placeholder — web push is not functional) |

There is a helper `setup-supabase-key.ps1` (Windows PowerShell) for exporting the mobile anon key.

## Database deploy

Run the SQL files in Supabase → SQL Editor in the order from [`supabase/RUNBOOK.md`](../supabase/RUNBOOK.md)
(also summarized in [database.md § run order](database.md#sql-file-set--run-order)):

1. `schema.sql` → 2. `triggers.sql` → 3. `geo.sql` → 4. `payments.sql` → 5. `yoga-capacity.sql` →
6. `disputes.sql` → 7. `push.sql` → 8. `hardening.sql`.

Then, as needed: `mfa.sql`, `profile-messaging.sql`, `admin-booking-logs.sql`.

- Enable **Realtime replication** for `notifications`, `bids`, `bookings`, `messages`, `payments`.
- Create storage buckets: **`avatars`** (public) and **`pro-documents`** (private, own-folder RLS).
- Configure **Auth**: Site URL + Google OAuth (redirect `https://<ref>.supabase.co/auth/v1/callback`); Apple
  for iOS.

⚠️ **Never apply** `fixes.sql`, `fix-rls-policies.sql`, or `fix-rls-policies-option2.sql` in production — they
loosen/disable RLS. See [tech-debt-and-security.md](tech-debt-and-security.md).

### Documentation gaps (fill these in when you deploy)

- Neither `DEPLOY.md` nor `RUNBOOK.md` covers **deploying the Edge Functions** (`supabase functions deploy
  server`, `send-approval-email`, `send-rejection-email`) or setting their secrets (`RESEND_API_KEY`,
  `APP_URL`, service-role).
- The `subscriptions` table and the mobile `push_subscriptions` columns (`expo_push_token`, `platform`) are
  used by code but have **no DDL** in `supabase/` — create them before relying on subscriptions / mobile push.

## Mobile build (EAS)

`mobile-app/eas.json` defines Android profiles:
- `preview` / `preview2` / `preview3` → APK.
- `production` → AAB, with Play Store internal-track submit (`serviceAccount` in `submit.production`).

```bash
pnpm -C mobile-app build          # eas build (choose profile via --profile)
```

App identity (`mobile-app/app.json`): name **CareLink**, bundle id / package `ma.carelink.app`, scheme
`ma.carelink.app`, portrait only, OTA updates disabled. Plugins: expo-router, expo-font, expo-location,
expo-web-browser, expo-image-picker.
