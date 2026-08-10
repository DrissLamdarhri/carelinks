-- ============================================================================
-- CareLink — block bids on a booking that's no longer open.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- THE GAP (reported live by the patient testing): nothing ever checked that
-- a booking was still `open` before letting a pro insert a bid. bids_pro_write
-- (0008_kyc_gating.sql) only verifies ownership + approval status — a pro
-- could still submit a bid on a booking the patient had already cancelled
-- (or that another pro had already been matched to), as long as their client
-- still had it cached. Same class of bug as 0035 — a write that should have
-- been rejected server-side, wasn't.
--
-- The other half of the complaint ("it shouldn't still show on the home
-- page") is already correct: sync_open_demand() (0028) deletes the
-- open_demands row the instant a booking leaves `open`, and the pro's feed
-- is subscribed to that table's realtime deletes — cancelling already
-- removes the card live. This migration only closes the write-side gap.
-- ============================================================================

create or replace function public.check_booking_open_for_bid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  select status::text into v_status from public.bookings where id = new.booking_id;
  if v_status is null then
    raise exception 'Réservation introuvable';
  end if;
  if v_status <> 'open' then
    raise exception 'Cette demande n''est plus disponible — elle a été annulée ou déjà prise en charge.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_booking_open_for_bid on public.bids;
create trigger trg_check_booking_open_for_bid
  before insert on public.bids
  for each row execute function public.check_booking_open_for_bid();

-- ── Sanity ───────────────────────────────────────────────────────────────────
select (select 1 from pg_proc where proname = 'check_booking_open_for_bid') as trigger_fn_ok;
