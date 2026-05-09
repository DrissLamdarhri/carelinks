# CareLink — Supabase Deployment Runbook (Step 4)

These steps must be run in the Supabase Dashboard for your connected project. Files are ready in `/supabase/`.

## 1. Execute the schema
1. Open Supabase Dashboard → **SQL Editor** → New query.
2. Paste the contents of `supabase/schema.sql` and **Run**.
3. Verify in **Table Editor**: 12 tables (`profiles`, `patients`, `services`, `professionals`, `pro_services`, `pro_documents`, `bookings`, `bids`, `ratings`, `yoga_sessions`, `yoga_enrollments`, `messages`, `notifications`).

## 2. Install notification triggers
1. SQL Editor → New query → paste `supabase/triggers.sql` → **Run**.
2. This creates 5 trigger functions and adds the 4 tables to `supabase_realtime` publication.

## 3. Enable Realtime replication (UI fallback)
If step 2's `alter publication` already succeeded, skip. Otherwise:
- Dashboard → **Database → Replication** → toggle ON for: `notifications`, `bids`, `bookings`, `messages`.

## 4. Configure Google OAuth
1. Google Cloud Console → APIs & Services → **Credentials** → Create OAuth 2.0 Client ID (Web).
2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Copy Client ID + Secret.
4. Supabase Dashboard → **Authentication → Providers → Google** → enable, paste credentials, save.
5. **Authentication → URL Configuration** → set Site URL to your Figma Make preview URL (and add it to Redirect URLs).

## Verification
- Insert a test bid via SQL → confirm a row appears in `notifications` for the patient.
- Sign in with Google → confirm a row appears in `public.profiles` (handled by `trg_on_auth_user_created`).
- Open the patient app → `NotificationBell` shows the unread count in real time.
