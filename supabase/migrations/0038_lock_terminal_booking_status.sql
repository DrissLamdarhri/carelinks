-- ============================================================================
-- CareLink — a cancelled/completed booking must never change status again.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- DATA CORRUPTION FOUND LIVE while testing (31 Jul 2026): booking
-- c5874acd-50d9-4697-8f6b-9167d856b388 was cancelled by the pro at 04:30:30
-- (cancel_case=4, refund_mad=215, cancelled_by='pro' — the escrow was
-- correctly refunded). Seven minutes later, at 04:37:49, its status was
-- silently overwritten to 'completed' with a completed_at timestamp — while
-- cancel_reason/cancel_case/refund_mad from the cancellation were still
-- sitting there, now describing a booking that claims to be "completed".
--
-- ROOT CAUSE: mobile-app/app/pro/tracking/[bookingId].tsx has no realtime
-- subscription on the booking row, so its local `booking` state goes stale
-- the moment the booking is cancelled by someone/something else — patient,
-- admin, or the pro's own "Annuler la mission" if they navigate back into
-- the same screen after cancelling. Its "Terminer la mission" button then
-- calls setStatus(id, "completed") against that stale state with NOTHING,
-- anywhere, checking the booking hadn't already reached a terminal state.
-- (Escrow itself was NOT double-charged — capture_on_complete's own WHERE
-- clause only touches payments still `authorized`, and this one was already
-- `refunded` — but the booking record itself is now lying about what
-- happened, and the patient got a second "prestation terminée" notification
-- for a job that was actually cancelled.)
--
-- This migration is the real fix (client-side subscriptions, added in the
-- same pass, are defense in depth — this is the guarantee that holds even if
-- a client is stale, buggy, or malicious).
-- ============================================================================

-- ── Repair the one row corrupted by this bug FIRST ───────────────────────────
-- Must run before the trigger below exists, or the trigger would itself
-- block this exact transition (completed → cancelled).
update public.bookings
   set status = 'cancelled', completed_at = null, updated_at = now()
 where id = 'c5874acd-50d9-4697-8f6b-9167d856b388'
   and status = 'completed'
   and cancel_case is not null;

-- ── Now make it impossible for this to ever happen again ────────────────────
create or replace function public.prevent_terminal_status_change()
returns trigger language plpgsql as $$
begin
  if old.status::text in ('completed', 'cancelled') and new.status is distinct from old.status then
    raise exception 'Cette réservation est déjà "%" — son statut ne peut plus changer.', old.status
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_terminal_status_change on public.bookings;
create trigger trg_prevent_terminal_status_change
  before update on public.bookings
  for each row execute function public.prevent_terminal_status_change();

-- ── Sanity ───────────────────────────────────────────────────────────────────
select
  (select 1 from pg_proc where proname = 'prevent_terminal_status_change')                        as trigger_fn_ok,
  (select status from public.bookings where id = 'c5874acd-50d9-4697-8f6b-9167d856b388')            as repaired_status;
