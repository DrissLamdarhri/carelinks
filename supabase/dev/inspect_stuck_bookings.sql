-- ============================================================================
-- CareLink — what is currently frozen mid-lifecycle?
-- Read-only. Safe to run any time, on any project.
--
-- Every row here is a booking that will never close on its own, and every one
-- of them is holding a payment that can be neither refunded nor paid out.
-- `settle_stale_bookings()` (scheduled hourly by migration 0053) clears them
-- once they pass the 48h grace period; this shows you what is waiting.
-- ============================================================================

-- 1 · Bookings stuck in a live status, oldest first.
select
  b.id,
  b.status,
  coalesce(pro.full_name, '(unassigned)')            as professional,
  coalesce(pat.full_name, '(unknown)')               as patient,
  b.scheduled_at,
  b.created_at,
  now() - coalesce(b.scheduled_at, b.created_at)     as age,
  (now() - coalesce(b.scheduled_at, b.created_at)) > interval '48 hours'
                                                     as sweepable_now,
  pay.status                                         as payment_status,
  pay.amount_mad
from public.bookings b
left join public.profiles pro on pro.id = b.professional_id
left join public.profiles pat on pat.id = b.patient_id
left join lateral (
  select status::text, amount_mad
    from public.payments
   where booking_id = b.id
   order by created_at desc
   limit 1
) pay on true
where b.status in ('matched', 'en_route', 'in_progress')
order by coalesce(b.scheduled_at, b.created_at) asc;

-- 2 · The money view: how much is sitting in limbo right now.
select
  count(*)                          as payments_held,
  coalesce(sum(amount_mad), 0)      as mad_held
from public.payments
where status = 'authorized';

-- 3 · Is the sweep actually scheduled? (empty = migration 0053 never applied)
select jobid, jobname, schedule, active
  from cron.job
 where jobname in ('settle-stale-bookings', 'expire-stale-open-demands');
