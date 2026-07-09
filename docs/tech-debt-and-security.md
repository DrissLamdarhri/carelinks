# Tech Debt & Security

Read this before shipping. The codebase is a Figma-Make export that was ported web → mobile and rebranded,
so it carries **parallel/duplicated systems** and several **dev shortcuts that are unsafe in production**.

## 🔴 Security landmines

1. **Hardcoded admin secret `<redacted>`** — committed in `src/lib/api.ts` (`ADMIN_KEY`, sent as
   `X-Admin-Key`) and accepted by every admin route in `supabase/functions/server/index.tsx`; `/admin/login`
   even returns it. Anyone reading the shipped web bundle gets full admin access to the KV backend.
2. **Hardcoded admin credentials** `admin@carelink.ma` / `<redacted>` — in `src/lib/api.ts`,
   `src/app/components/AdminLogin.tsx` (**and rendered on the login screen**), and `mobile-app/app/admin/index.tsx`.
3. **Client-trusted web admin gate** — `RequireAuth role="admin"` only checks
   `localStorage.carelink_admin_authed === "true"`. A user can set that flag to reach `/admin/dashboard`.
   (Path-B admin data is still protected by RLS; Path-A admin routes rely on the shared key.)
4. **RLS-loosening SQL scripts** — **do not apply in production:**
   - `supabase/fixes.sql` → `profiles_insert WITH CHECK (true)`, pro insert when `auth.uid() IS NULL`.
   - `supabase/fix-rls-policies.sql` → **public (anyone) uploads** to `pro-documents`.
   - `supabase/fix-rls-policies-option2.sql` → **disables RLS on `storage.objects` globally** ("nuclear").
5. **Unauthenticated email Edge Functions** — `send-approval-email` / `send-rejection-email` accept any caller
   (CORS `*`, no body-sender auth) and send via Resend.
6. **Committed keys / placeholders** — hardcoded Supabase URL + anon key fallbacks in
   `mobile-app/lib/supabase.ts`; project ref `wjhzrovmktekfcjohhrw` in `kv_store.tsx`; `push.ts`
   `VAPID_PUBLIC_KEY` is a non-functional placeholder. (Anon key is public by design, but the fallbacks mean
   env misconfig fails silently instead of loudly.)

**Remediation sketch:** move admin auth to real Supabase roles + RLS everywhere; delete the shared key and
demo creds; server-verify the admin gate; require auth on email functions; never apply the `fix-rls-*` scripts
to prod; move secrets to env.

## 🟠 Architectural debt

- **Two unsynchronized backends / data models** — KV Edge Function (Path A, web/demo) vs. relational tables
  (Path B, mobile/production). See [architecture.md](architecture.md#the-dual-data-path). Consolidate onto
  Path B.
- **Two messaging models** — `messages` table (used) vs. `conversations`/`conversation_messages`
  (`profile-messaging.sql`, largely unused).
- **Three copies of the realtime hooks** — `shared/db/realtime.ts`, `src/lib/db/realtime.ts`,
  `mobile-app/lib/db/realtime.ts`.
- **Two map projection engines** — `mobile-app/components/map/engine.ts` vs. `mobile-app/lib/map/mapEngine.ts`.
- **`toDbSpecialty` duplicated** in three places (mobile types, web, Edge Function) — keep in sync.
- **DAL bypass** — `RatingForm` writes `ratings` via raw `supabase` instead of the DAL; don't copy the pattern.

## 🟡 Dead / duplicated code

Safe to treat as non-authoritative; don't extend these.

**Mobile:**
- `mobile-app/app/pro/index6.tsx` — exact duplicate of `index.tsx`.
- `mobile-app/app/pro/profile6.tsx` — near-copy of `profile.tsx`.
- `mobile-app/app/patient/tracking/[bookingId]C.tsx` — older tracking variant (uses `TrackingMap`).
- `mobile-app/app/patient/tracking/[bookingId].tsx` lines ~1–500 — commented-out prior version.
- `mobile-app/app/_layoutBefore.tsx`, `mobile-app/app/auth/_layoutBefore.tsx` — Expo Router ignores these.
- `mobile-app/mobile-app/` — a stale nested copy of the DAL (differs from canonical).
- `mobile-app/src/` — legacy map stack + `MapsScreenWithMapcnRn.tsx` (react-native-maps approach, unused).
- `mobile-app/components/BookingMapC.tsx`, `BookingMapC2.tsx` — map iterations; likely one is live.
- `mobile-app/adjustedInterfaces/` — 11 WhatsApp design-mockup JPEGs (assets, not code).
- `zustand` dependency — never imported.
- `SubscriptionProvider` / `SubscriptionGate` — provider never mounted, so inert.

**Repo root:**
- `src.zip`, `mobile-app.zip` (~370 MB) — build artifacts checked into git; candidates for removal + `.gitignore`.
- ~30 historical `*.md` notes and one-off `*.sql`/`*.ts` files (`ADMIN_*`, `PROFESSIONAL_*`, `DOCUMENT_UPLOAD_*`,
  `*_FIX*`, `CLEAN_SQL_FIX.sql`, `DEBUG_PROFESSIONALS_QUERY.sql`, `TEST_YOGA_BOOKING.sh`, etc.) — point-in-time
  changelog, superseded by `docs/`.

## Stale docs to distrust

- `.github/copilot-instructions.md` — refers to a `mobile/` workspace and claims mobile uses the `shared/`
  providers. **Both are wrong now:** the app is `mobile-app/` and is self-contained. Prefer `CLAUDE.md` +
  `docs/`.
- `README.md` — Figma boilerplate.
- `carelink-design-system.md` — describes the **old teal** palette, superseded by the navy rebrand.
