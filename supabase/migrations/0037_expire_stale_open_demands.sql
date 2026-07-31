-- ============================================================================
-- CareLink — auto-expire unclaimed urgent/emergency requests server-side.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- THE GAP (reported live: an urgent request from 03:58 and an emergency one
-- from the day before were STILL sitting open, unrefunded, pinned at the top
-- of the pro's home feed hours/minutes later): the "5-minute auto-refund"
-- built for urgent/emergency (mobile-app/app/patient/waiting/[bookingId].tsx)
-- is a client-side setInterval — it only fires while the PATIENT'S app is
-- sitting on that exact screen. Close the app, lose signal, or navigate away
-- before 5 minutes pass, and nothing ever expires the hold or the demand.
-- Money must never depend on a screen staying open — same lesson as
-- 0027_settle_stale_bookings.sql (matched/en_route bookings frozen for days).
--
-- THIS FIXES BOTH THINGS the patient asked for in one pass:
--   1. "a pro shouldn't be able to bid on something already cancelled" —
--      already closed by 0036 (bids require an `open` booking) — once this
--      expires the booking, a stale client can no longer bid on it either.
--   2. "it shouldn't still show on the pro's home page" — sync_open_demand()
--      (0028) deletes the open_demands row the instant status leaves `open`,
--      and the pro's feed is subscribed to that table's realtime deletes —
--      so cancelling here removes the card live, same as a manual cancel.
--
-- Unlike settle_stale_bookings() (written but left for an admin to call by
-- hand — see its own comment), this one is actually scheduled via pg_cron so
-- the backlog can never build up silently again.
-- ============================================================================

create or replace function public.expire_stale_open_demands(p_grace_minutes integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_row         record;
  v_expired     integer := 0;
  v_had_payment boolean;
  v_price       integer;
  v_refund      integer;
begin
  for v_row in
    select id, patient_id, coalesce(final_price_mad, budget_max_mad, budget_min_mad, 0) as price
      from public.bookings
     where status = 'open'
       and urgency in ('urgent', 'emergency')
       and professional_id is null
       and created_at < now() - make_interval(mins => p_grace_minutes)
  loop
    -- Same "never announce a refund that never happened" rule as 0035.
    select amount_mad into v_price
      from public.payments
     where booking_id = v_row.id
       and coalesce(kind, 'service') = 'service'
       and status in ('authorized', 'captured')
     order by created_at desc limit 1;
    v_had_payment := v_price is not null;
    v_refund := 0;

    if v_had_payment then
      v_refund := v_price + 5; -- flat service fee, same constant as cancel_booking's RULE #1
      update public.payments set status = 'refunded'
       where booking_id = v_row.id and status in ('authorized', 'captured')
         and coalesce(kind, 'service') = 'service';
    end if;

    update public.bookings
       set status        = 'cancelled',
           cancelled_at  = now(),
           cancelled_by  = 'system',
           cancel_reason = 'expired_unclaimed',
           cancel_case   = 1,
           refund_mad    = v_refund,
           updated_at    = now()
     where id = v_row.id;

    insert into public.notifications (user_id, kind, title, body, payload)
    values (v_row.patient_id, 'booking_status', 'Réservation annulée',
      case when v_had_payment
        then 'Aucun professionnel n''a accepté à temps — remboursement intégral de ' || v_refund || ' MAD.'
        else 'Aucun professionnel n''a accepté à temps — aucun montant n''avait été prélevé.'
      end,
      jsonb_build_object('booking_id', v_row.id, 'cancel_case', 1, 'refund_mad', v_refund, 'had_payment', v_had_payment));

    v_expired := v_expired + 1;
  end loop;

  return jsonb_build_object('expired', v_expired);
end;
$$;

grant execute on function public.expire_stale_open_demands(integer) to authenticated;

-- ── Sweep the existing backlog right now (the two demos stuck for hours) ────
select public.expire_stale_open_demands(5) as swept_now;

-- ── Schedule it for real: every minute, forever ──────────────────────────────
-- If pg_cron isn't available on this project's plan, this block fails loudly
-- and clearly instead of silently doing nothing — enable the "pg_cron"
-- extension under Database → Extensions in the dashboard, then re-run.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'expire-stale-open-demands',
  '* * * * *',
  $$ select public.expire_stale_open_demands(5); $$
);

-- ── Verify ───────────────────────────────────────────────────────────────────
select
  (select count(*) from public.bookings
     where status = 'open' and urgency in ('urgent','emergency')
       and created_at < now() - interval '5 minutes')          as still_stale,
  (select jobname from cron.job where jobname = 'expire-stale-open-demands') as cron_job_ok;
