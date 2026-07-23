-- ============================================================================
-- CareLink — never let a transaction (or the patient's money) freeze.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- PROBLEM FOUND IN PRODUCTION DATA (24 Jul 2026):
--   • 3 payments still `authorized` (650 MAD) on bookings that were matched and
--     never progressed — two held since 8 Jul. The patient cannot be refunded and
--     the professional cannot be paid: the money is simply stuck.
--   • 85 bookings sat in `matched` for 2+ days and will never close on their own.
-- There was no timeout anywhere in the lifecycle: if nobody pressed "terminer",
-- the booking — and its escrow — stayed frozen indefinitely.
--
-- POLICY (deterministic, and money is never trapped):
--   A) matched / en_route past the grace period → the visit never happened, so the
--      booking is cancelled. cancel_case stays NULL so capture_on_complete performs
--      its standard REFUND of the hold → the patient gets their money back.
--   B) in_progress past the grace period → the visit demonstrably started, so the
--      booking is auto-completed → capture_on_complete RELEASES the escrow to the
--      professional. (A patient who disagrees still has the disputes flow.)
--
-- Both paths fire notify_booking_status, so patient and pro are informed.
--
-- Schedule this (pg_cron, or call it from the admin panel) so the backlog can
-- never build up again.
-- ============================================================================

create index if not exists idx_bookings_status_sched
  on public.bookings (status, scheduled_at);

create or replace function public.settle_stale_bookings(p_grace_hours integer default 48)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_cancelled integer;
  v_completed integer;
begin
  -- A) Never delivered → cancel + refund the patient.
  update public.bookings
     set status        = 'cancelled',
         cancelled_at  = now(),
         cancelled_by  = 'system',
         cancel_reason = 'expired_not_delivered',
         updated_at    = now()
   where status in ('matched', 'en_route')
     and coalesce(scheduled_at, created_at) < now() - make_interval(hours => p_grace_hours);
  get diagnostics v_cancelled = row_count;

  -- B) Started but never closed → complete so the escrow reaches the professional.
  update public.bookings
     set status       = 'completed',
         completed_at = now(),
         updated_at   = now()
   where status = 'in_progress'
     and coalesce(scheduled_at, created_at) < now() - make_interval(hours => p_grace_hours);
  get diagnostics v_completed = row_count;

  return jsonb_build_object(
    'cancelled_not_delivered', v_cancelled,
    'auto_completed',          v_completed
  );
end $$;

grant execute on function public.settle_stale_bookings(integer) to authenticated;

-- ── One-time sweep of the existing backlog ──────────────────────────────────
-- This WILL move real rows: stale matched/en_route bookings are refunded to the
-- patient and stale in_progress ones are released to the professional. That is
-- the point — it unfreezes the 650 MAD currently held in limbo.
select public.settle_stale_bookings(48) as swept;

-- ── Verify nothing is left frozen ────────────────────────────────────────────
select
  (select count(*) from public.payments  where status = 'authorized')                     as still_held,
  (select count(*) from public.bookings  where status in ('matched','en_route')
     and coalesce(scheduled_at, created_at) < now() - interval '48 hours')                 as still_stale;
