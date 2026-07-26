# Backup & Disaster Recovery

A working app is really **four separate things**, and losing any one of them independently can still sink
the project. This doc covers all four, what's already protected, what isn't, and the exact steps to rebuild
from zero if the worst happens.

| # | Thing | Where it lives | Protected today? |
|---|-------|-----------------|-------------------|
| 1 | **Code** | GitHub (`origin`) | ✅ Yes — every branch pushed, tagged checkpoints |
| 2 | **DB schema** | `supabase/migrations/*.sql` (in git) | ✅ Yes — this folder *is* the schema backup |
| 3 | **DB data** (bookings, payments, patients, pros, messages…) | Supabase Postgres only | ❌ **No backup exists** until you run the scripts below or enable native backups |
| 4 | **Storage files** (avatars, CIN photos, diplomas, yoga photos) + **auth users** | Supabase Storage / Auth only | ❌ **No backup exists** — same as above |

**Read this if nothing else:** #3 and #4 hold real patient CIN numbers, phone numbers, and professionals'
bank account numbers (RIB). There is currently **zero copy of that data anywhere except the live database**.
If the Supabase project were ever deleted, suspended for billing, or hit with a destructive mistake (a bad
`DROP TABLE`, one of the "nuclear" RLS scripts described in
[`tech-debt-and-security.md`](tech-debt-and-security.md) run in prod), **that data is gone, permanently,
with no way for anyone — including Anthropic, me, or Supabase support — to bring it back**, unless one of
the two things below is in place.

## Priority #1 (5 minutes, no engineering): turn on Supabase's own backups

This is the single highest-leverage thing you can do, and it needs no scripts:

1. Open the [Supabase dashboard](https://supabase.com/dashboard) → project **nurseMorocco** → **Settings → Database → Backups**.
2. If you're on the **Free plan, there are no automatic backups at all** — this is the most important
   finding in this whole document. Upgrading to **Pro** (~$25/mo) gets you 7 days of automatic daily
   backups, and lets you enable **Point-in-Time Recovery (PITR)** for an extra fee, which lets you restore
   to any minute in the last several days (not just once/day) — the right tier if a "delete the wrong row"
   mistake needs to be undone precisely.
3. Even on Pro, backups live **inside that same Supabase project**. If the *project itself* is deleted
   (wrong button, expired card, account issue), its backups go with it. That's why the manual/offline
   backup below is not optional even after you enable this — it's a second, independent copy.

## Priority #2: take a manual backup now, then on a regular cadence

Everything needed is in `scripts/backup/`. These must be run **from your own machine**, never inside an AI
chat session — they need your Supabase secrets (service role key, DB password), and secrets should never
be typed into a chat.

```bash
cd scripts/backup
cp .env.backup.example .env.backup
# open .env.backup and fill in the 3 values — the example file says exactly
# where to find each one in the dashboard.

./run-full-backup.sh
```

This produces **one file**: `backups/carelink-backup-<timestamp>.tar.gz.gpg` — encrypted (you'll be asked
to set a passphrase; save it in your password manager, because without it the backup is unreadable by
anyone, including you). It contains:

- `database.sql.gz` — full schema + every row of data (bookings, payments, patients, professionals,
  messages, yoga sessions, payout methods, everything in the `public` schema).
- `storage/` — every file from every bucket: `avatars`, `pro-documents`, `patient-ids`, `yoga-images`.
- `auth-users.json` — the account list (id, email, phone, role, created date). **Not** passwords — Supabase
  never exposes password hashes, even to admins; after a restore, users reset their password via the normal
  "forgot password" flow.

Run the individual scripts (`backup-database.sh`, `backup-storage.mjs`, `backup-auth-users.sh`) separately
if you only need one piece.

**`backups/` is git-ignored on purpose — never commit it.** It contains real CIN numbers, phone numbers and
bank RIBs; putting that in git history (even a private repo) means it never truly goes away, even if the
file is later deleted. Move the finished archive to encrypted, access-controlled storage (a password
manager's file vault, or a private cloud folder only you can open), then delete the local `backups/` folder.

**Suggested cadence:** weekly at minimum while the client has live users; before any risky migration or
"nuclear" fix; and always right before a major release.

## Moving to a brand-new Supabase project (account compromised, hit a quota, etc.)

This is a **different trigger** than disaster recovery — nothing is lost, you're choosing to move — but it
uses the exact same mechanics as the rebuild below, with a few things worth knowing up front:

- **Realtime needs no separate backup at all.** Every realtime-enabled table (`bookings`, `bids`, `payments`,
  `payouts`, `messages`, `notifications`, `professionals`, `patients`, `open_demands`) is wired up by an
  `alter publication supabase_realtime add table …` statement **inside the migration files themselves**.
  Re-running `supabase/migrations/` on the new project recreates that wiring automatically — there is
  nothing to export or reconnect by hand.
- **Passwords are the one tradeoff.** The standard restore (below) dumps only the `public` schema, so
  existing users keep their *account* but must reset their *password* once (Supabase never exposes password
  hashes for export, by design). If keeping logins working without a reset matters enough to justify the
  extra risk, `pg_dump` **can** dump the entire database including `auth.*`, and restoring that instead
  preserves password hashes intact — but a full `auth` schema restore into a fresh project is not something
  Supabase generally supports cleanly (their GoTrue service owns that schema's internal migration state, and
  a foreign one can conflict with it). Do this only as a deliberate, tested step — not the default path.
- **On "the account was stolen":** a portable backup outside Supabase (exactly what this doc sets up) is the
  right mitigation *after the fact*, but also turn on **2FA on your Supabase account** now (Dashboard →
  Account → Security), and check **Organization → Team** for members you don't recognize — a stolen account
  usually means a leaked password/token, not a hacked database.
- **On "the usage limit finished, let's just make a new free account":** understand what you're trading
  before doing this repeatedly. Free-tier projects have hard caps (roughly: 500MB database, 1GB storage,
  5GB bandwidth/month, 50k monthly active users) **and auto-pause after a week of no traffic**, needing a
  manual unpause. Bouncing between free accounts each time you hit a limit is fragile, and this project is
  no longer a prototype — it holds real patient CIN numbers and bank details for a paying client. The
  $25/mo Pro tier removes the request-volume anxiety *and* turns on the daily backups from Priority #1 above
  in the same move — at this stage that's the more durable fix than migrating accounts.
- **Config to update after moving** (the only code changes a migration needs — everything else is data):
  - `mobile-app/lib/supabase.ts` — `SUPABASE_URL` / the hardcoded anon-key fallback (or set
    `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` in EAS so the fallback is never used).
  - `utils/supabase/info.ts` — `projectId` (+ the web anon key alongside it) for the web/admin app.
  - Any Edge Function secrets (`RESEND_API_KEY`, `WHATSAPP_*`, `MAIL_FROM`) — these live per-project, so
    `supabase secrets set` again on the new project; they don't carry over automatically.

## Full rebuild from zero

If the Supabase project is gone and you're starting over with a brand new one (the same steps apply to a
deliberate move to a new project, per the callouts above):

1. **Code**: `git clone git@github.com:DrissLamdarhri/carelinks.git && cd carelinks && pnpm install`.
   If GitHub itself were ever unavailable, every branch also exists wherever you last ran `git pull` — check
   `git remote -v` and any local clones on other machines/laptops.
2. **New Supabase project**: create it in the dashboard, note the new project ref, URL, and anon key.
3. **Schema**: run every file in `supabase/migrations/` **in numeric order**, 0001 through the latest, in
   the SQL Editor (or `supabase db push` once linked). They are idempotent, so re-running one that partially
   applied is safe. This alone recreates every table, RLS policy, trigger, function, enum, and storage
   bucket **empty** — structurally complete, with zero rows.
4. **Restore data**: decrypt your latest backup archive (`gpg --decrypt` with the saved passphrase), then
   `psql <new-db-url> -f database.sql` to load every row back in.
5. **Restore storage files**: point `scripts/backup/.env.backup` at the **new** project (new URL + new
   project's service role key), then:
   ```bash
   node scripts/backup/restore-storage.mjs <path-to-decrypted-backup>/storage
   ```
   Re-uploads every file into the matching bucket (which step 3 already created, empty).
6. **Auth users**: existing `auth.users` rows restored via step 4 keep their accounts and roles; anyone new
   since the last backup (per `auth-users.json`) needs to be re-invited. All users must reset their password
   once (Supabase never lets you restore a password hash independently of the exact same DB).
7. **Edge Functions**: `supabase functions deploy notify-pro-status send-approval-email send-rejection-email`
   (list may have grown — check `supabase/functions/`).
8. **Secrets** (the app will run but key features silently no-op without these — see checklist below):
   `supabase secrets set KEY=value` for each one.
9. **Point the app at the new project**: update `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   (mobile) and `utils/supabase/info.ts` (web) to the new project's URL/anon key, and the hardcoded fallback
   in `mobile-app/lib/supabase.ts` if you rely on that fallback. Rebuild/redeploy.

## Secrets checklist — what exists, and where (never store the actual values here or in git)

| Secret | Used by | Currently configured in |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge functions (auto-injected by Supabase) | Supabase project (automatic) |
| `RESEND_API_KEY` | `notify-pro-status`, approval/rejection emails | Supabase project secrets |
| `MAIL_FROM` | Same, once a real domain is verified in Resend | Supabase project secrets |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_TEMPLATE_*` | `notify-pro-status` WhatsApp channel | Supabase project secrets (once set up) |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile app | EAS env / falls back to a hardcoded value in `lib/supabase.ts` |
| `EXPO_PUBLIC_MAPTILER_KEY` | Map tiles | **Committed in plaintext in `mobile-app/eas.json`** — see the security note below |
| DB password | Direct Postgres access (backups, `supabase db push`) | Only in your head / password manager — reset it in the dashboard if lost |

Keep an up-to-date copy of every real value in a password manager (1Password, Bitwarden) shared with
whoever else needs to operate this project. **Never** put real secret values in this repo, in this doc, or
in a chat session with any AI tool — treat an AI conversation the same as a public support ticket.

## Beyond backups — other things protecting (or endangering) this project

A backup protects against data *loss*. It does nothing against data *theft* or *misuse* while the app is
live — that's a different problem, and this codebase currently has known holes on that side. They're fully
documented in [`tech-debt-and-security.md`](tech-debt-and-security.md); the two most urgent, in short:

- A **hardcoded admin secret and demo admin credentials** are committed and shipped inside the web bundle —
  anyone who inspects it gets admin access.
- Several `supabase/fix-rls-*.sql` scripts **loosen or fully disable RLS** (one disables storage security
  globally). They're dev shortcuts from earlier debugging — confirm none of them have been run against the
  live project, and never run them there.
- The **MapTiler key found above is committed in plaintext** in `mobile-app/eas.json` across every build
  profile — low severity (map tiles, not user data) but worth rotating once billing/usage matters, since
  anyone with repo access can use your quota.

None of this is fixed by a backup. It's a separate pass — flagging it here because "protect the client's
work" covers both directions: don't lose it, and don't leave the door unlocked while it's live.
