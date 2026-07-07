-- ============================================================================
-- CareLink — accept_bid(): atomically accept a bid and match the booking.
-- Run once in Supabase → SQL Editor.
--
-- Why an RPC: the patient is NOT the bid's owner, so RLS ("bids_pro_write")
-- blocks them from updating bids directly (the client-side accept silently
-- affected 0 rows). This SECURITY DEFINER function checks the caller IS the
-- booking's patient, then flips the bid statuses + matches the booking in one
-- transaction. The bid UPDATE also fires trg_notify_bid_accepted → the pro is
-- notified. Idempotent-ish and safe.
-- ============================================================================

-- An older accept_bid(uuid) with a different return type may already exist —
-- drop it so we can change the return type to the matched booking row.
drop function if exists public.accept_bid(uuid);

create or replace function public.accept_bid(p_bid_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid     public.bids;
  v_booking public.bookings;
begin
  select * into v_bid from public.bids where id = p_bid_id;
  if v_bid.id is null then
    raise exception 'Offre introuvable';
  end if;

  select * into v_booking from public.bookings where id = v_bid.booking_id;
  if v_booking.id is null then
    raise exception 'Réservation introuvable';
  end if;

  -- Only the booking's patient may accept.
  if v_booking.patient_id <> auth.uid() then
    raise exception 'Non autorisé';
  end if;

  -- Only an open booking can be matched (guards double-accept).
  if v_booking.status <> 'open' then
    raise exception 'Cette demande n''est plus ouverte';
  end if;

  update public.bids
     set status = 'accepted', responded_at = now()
   where id = p_bid_id;

  update public.bids
     set status = 'rejected', responded_at = now()
   where booking_id = v_bid.booking_id
     and id <> p_bid_id
     and status = 'pending';

  update public.bookings
     set status          = 'matched',
         professional_id = v_bid.professional_id,
         final_price_mad = v_bid.price_mad,
         updated_at      = now()
   where id = v_bid.booking_id
   returning * into v_booking;

  return v_booking;
end;
$$;

grant execute on function public.accept_bid(uuid) to authenticated;
