# Tech Debt & Security

Read this before shipping. The codebase is a Figma-Make export that was ported web → mobile and rebranded,
so it carries **parallel/duplicated systems** and several **dev shortcuts that are unsafe in production**.

## ✅ Resolved (kept here as history — verify before assuming any "known landmine" is still live)

Everything below was found already fixed when re-audited on 2026-07-26, except #5/#6 which were fixed that
day. The lesson that earned this section: this doc nearly caused a fix to be re-applied to code that no
longer existed — **always check the file is still there and still says what the doc claims before acting
on this list.**

1. ~~Hardcoded admin secret / `X-Admin-Key`~~ — the KV edge function that accepted it
   (`supabase/functions/server/index.tsx`) no longer exists in the repo, and its **deployed** copy
   (`make-server-aa5d1aa6`, still ACTIVE months after the source was deleted) was undeployed on 2026-07-26.
   `src/lib/api.ts` now runs entirely on Supabase Auth + Postgres RLS.
2. ~~Hardcoded admin credentials~~ — `adminLogin()` in `src/lib/api.ts` does real
   `supabase.auth.signInWithPassword` + a `profiles.role === 'admin'` check. No credentials in source.
3. ~~Client-trusted web admin gate~~ — `isAdminAuthed` in `src/lib/auth-context.tsx` is derived from
   `profile.role` (a real DB-backed value under RLS), not a localStorage flag. `setAdminAuthed` is a no-op
   kept only for old call-site compatibility.
4. ~~RLS-loosening "nuclear" SQL scripts~~ — `supabase/fixes.sql`, `fix-rls-policies.sql`,
   `fix-rls-policies-option2.sql` no longer exist in the repo.
5. **Unauthenticated email Edge Functions** — `send-approval-email` / `send-rejection-email` accepted any
   caller (CORS `*`, no auth check) **and were never actually deployed to this project** — every admin
   screen that called them (there were three: `KycModerationQueue.tsx`, `AdminPanel.tsx`,
   `ProfessionalsManager.tsx`) was silently failing to email anyone. Fixed 2026-07-26: both deleted from the
   repo; all three call sites now go through `notifyProStatus()` (`src/lib/api.ts`) →
   `supabase/functions/notify-pro-status`, one authenticated function that sends the in-app notification,
   email (Resend) and WhatsApp (Meta Cloud API) consistently everywhere.
6. **`kv_store_aa5d1aa6` table** — the KV blob table itself. Migration `0033_drop_legacy_kv_backend.sql`
   drops it; run it in the SQL Editor like every other migration.

**Still true and worth knowing:** the Supabase anon key + a hardcoded fallback project URL are committed in
`mobile-app/lib/supabase.ts` — this is normal (the anon key is public by design, protected by RLS), but the
fallback means a misconfigured env var fails silently instead of loudly. A MapTiler API key is also
committed in plaintext across every profile in `mobile-app/eas.json` — low severity (map tiles, not user
data), worth rotating once usage/billing matters since anyone with repo access can spend the quota.

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
