-- ============================================================================
-- CareLink — Psychologist appointments: single / recurring / subscription,
-- in-person vs remote (Google Meet + Zoom links), on top of the escrow engine.
-- Run once in Supabase → SQL Editor. Idempotent. (Follow-up to 0022/0023.)
--
-- Money model: UNCHANGED — each session is a normal booking that goes through
-- the escrow (5 DH fee + 15% commission, held → released when the session is
-- marked completed). No new payment path, no fixed cost.
--
-- Appointment kinds (plan_type):
--   'single'       → one session
--   'recurring'    → same slot repeated (recurrence weekly/biweekly/monthly)
--   'subscription' → a prepaid pack of N sessions (abonnement / suivi)
-- Sessions of a recurring plan / pack share a `series_id` and carry
-- session_index / session_total.
--
-- Video is FREE: the app hosts no video. Each psychologist saves their own
-- Google Meet + Zoom links (professionals.meet_link / zoom_link); on booking we
-- snapshot them onto the session row so the confirmation page can show a Join
-- button. (Auto-generating unique links via the Calendar/Zoom API can be added
-- later without changing this schema.)
-- ============================================================================

-- ── Session / plan metadata on each booking ──────────────────────────────────
alter table public.bookings add column if not exists session_mode  text;               -- 'in_person' | 'remote'
alter table public.bookings add column if not exists plan_type     text default 'single'; -- 'single'|'recurring'|'subscription'
alter table public.bookings add column if not exists recurrence    text default 'none';   -- 'none'|'weekly'|'biweekly'|'monthly'
alter table public.bookings add column if not exists series_id     uuid;                 -- links sessions of a plan/pack
alter table public.bookings add column if not exists session_index integer;             -- 1-based position in the series
alter table public.bookings add column if not exists session_total integer;             -- total sessions in the series
alter table public.bookings add column if not exists meet_link     text;                -- snapshot of the psychologist's Meet link
alter table public.bookings add column if not exists zoom_link     text;                -- snapshot of the psychologist's Zoom link

create index if not exists idx_bookings_series on public.bookings(series_id);

-- ── Psychologist's saved remote-meeting links (level-1, free) ─────────────────
alter table public.professionals add column if not exists meet_link text;
alter table public.professionals add column if not exists zoom_link text;

-- ── Sanity ───────────────────────────────────────────────────────────────────
select
  (select 1 from information_schema.columns where table_name='bookings' and column_name='plan_type')     as plan_type_ok,
  (select 1 from information_schema.columns where table_name='bookings' and column_name='session_mode')  as session_mode_ok,
  (select 1 from information_schema.columns where table_name='bookings' and column_name='series_id')     as series_ok,
  (select 1 from information_schema.columns where table_name='professionals' and column_name='meet_link') as pro_meet_ok;
