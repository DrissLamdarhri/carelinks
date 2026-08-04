-- ============================================================================
-- CareLink — actually run the stale-booking sweep.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- WHAT WENT WRONG
--   0027 wrote `settle_stale_bookings()` and swept the backlog ONCE, then left
--   scheduling "for an admin to call by hand" — 0037's own comment says as
--   much. Nobody ever did. So from 24 Jul 2026 onward the backlog simply
--   started rebuilding: every booking whose pro never pressed "Terminer", and
--   every one a patient walked away from after accepting a bid, stayed
--   `matched` / `en_route` / `in_progress` forever.
--
--   Two visible consequences on the professional's home screen, both reported
--   from the field:
--     • the blue "Mission en cours" card kept offering to navigate to a patient
--       who had been seen days ago, because the booking still said in_progress;
--     • the planning list showed those same dead bookings as "À venir".
--
--   And one invisible, worse one: every stuck booking is a payment still
--   `authorized`. The patient is not refunded and the professional is not paid.
--   Money sits in limbo for as long as the row does. That is the actual reason
--   this is a scheduled job and not a UI filter.
--
-- WHAT THIS DOES
--   Schedules the existing function hourly, and sweeps the backlog that has
--   accumulated since 0027. The policy is 0027's, unchanged:
--     A) matched / en_route past the grace period → cancelled, patient refunded
--     B) in_progress past the grace period        → completed, pro paid
--
--   Grace is measured from `coalesce(scheduled_at, created_at)`, so a booking
--   scheduled for next week is never touched — only ones whose moment has
--   demonstrably passed.
--
-- ⚠  THE ONE-TIME SWEEP MOVES REAL MONEY. It refunds held payments on bookings
--    that were never delivered and releases escrow on visits that were never
--    closed. That is the intent — it is how the money gets unstuck — but on a
--    project with live data, read the "before" counts below first.
-- ============================================================================

-- ── Before: what is currently frozen ────────────────────────────────────────
select
  (select count(*) from public.bookings
     where status in ('matched', 'en_route')
       and coalesce(scheduled_at, created_at) < now() - interval '48 hours')  as stale_undelivered,
  (select count(*) from public.bookings
     where status = 'in_progress'
       and coalesce(scheduled_at, created_at) < now() - interval '48 hours')  as stale_unclosed,
  (select count(*)              from public.payments where status = 'authorized') as payments_held,
  (select coalesce(sum(amount_mad), 0) from public.payments where status = 'authorized') as mad_held;

-- ── Sweep the backlog ───────────────────────────────────────────────────────
select public.settle_stale_bookings(48) as swept_now;

-- ── Schedule it, so this can never silently rebuild again ───────────────────
-- Hourly, not per-minute: the grace period is 48 hours, so the difference
-- between checking every minute and every hour is invisible to any user, and
-- an hourly job is one that nobody needs to think about again.
--
-- If pg_cron isn't available on this project's plan this fails loudly rather
-- than silently doing nothing — enable "pg_cron" under Database → Extensions,
-- then re-run.
create extension if not exists pg_cron with schema extensions;

-- Unschedule first so re-running this file doesn't stack duplicate jobs.
do $$
begin
  perform cron.unschedule('settle-stale-bookings');
exception when others then null;  -- not scheduled yet
end $$;

select cron.schedule(
  'settle-stale-bookings',
  '0 * * * *',
  $$ select public.settle_stale_bookings(48); $$
);

-- ── Verify ──────────────────────────────────────────────────────────────────
select
  (select count(*) from public.bookings
     where status in ('matched', 'en_route', 'in_progress')
       and coalesce(scheduled_at, created_at) < now() - interval '48 hours')  as still_stale,
  (select count(*)              from public.payments where status = 'authorized') as payments_still_held,
  (select jobname from cron.job where jobname = 'settle-stale-bookings')          as cron_job_ok;
