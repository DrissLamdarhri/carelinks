-- ============================================================================
-- CareLink — urgent/emergency requests: skip bidding, first online pro to
-- claim wins. Run once in Supabase → SQL Editor. Idempotent.
--
-- Today an "urgent"/"emergency" booking goes through the exact same slow
-- reverse-bidding loop as a routine one (post → wait for bids → patient
-- compares → patient accepts → pay). That's backwards for something time-
-- sensitive: the payment hold already happens up front on the patient side
-- (mobile-app/app/patient/urgent.tsx redirects straight to payment before
-- waiting for a match), and this RPC is the pro-side counterpart — an atomic
-- "claim" a professional calls instead of submitting a bid. First pro whose
-- UPDATE lands wins the compare-and-swap; everyone else's claim raises.
--
-- The existing escrow model needs no changes: the payment row created at
-- submission is already `authorized` (held, not captured); cancel_booking()'s
-- RULE #1 (0022_escrow_cancellation_rules.sql) already gives a full refund
-- for a still-`open` booking, which is exactly what the patient-side 5-minute
-- auto-expiry calls when nobody claims in time.
-- ============================================================================

drop function if exists public.claim_open_demand(uuid);

create or replace function public.claim_open_demand(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro     public.professionals;
  v_booking public.bookings;
begin
  select * into v_pro from public.professionals where id = auth.uid();
  if v_pro.id is null then
    raise exception 'Profil professionnel introuvable';
  end if;
  if v_pro.verification_status <> 'approved' then
    raise exception 'Compte non approuvé';
  end if;
  if not v_pro.is_available then
    raise exception 'Vous devez être en ligne pour accepter une demande';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Demande introuvable';
  end if;
  if v_booking.specialty <> v_pro.specialty then
    raise exception 'Spécialité non correspondante';
  end if;
  if v_booking.urgency is null or v_booking.urgency::text = 'normal' then
    raise exception 'Cette demande doit passer par une offre';
  end if;

  -- Atomic compare-and-swap: only the FIRST claim to reach Postgres wins —
  -- the WHERE clause re-checks status/professional_id inside the same UPDATE,
  -- so a second pro's concurrent claim simply matches zero rows.
  update public.bookings
     set status           = 'matched',
         professional_id  = v_pro.id,
         final_price_mad  = coalesce(final_price_mad, budget_max_mad, budget_min_mad),
         updated_at       = now()
   where id = p_booking_id
     and status = 'open'
     and professional_id is null
   returning * into v_booking;

  if v_booking.id is null then
    raise exception 'Déjà pris en charge par un autre professionnel';
  end if;

  -- The escrow hold (payments.create) was placed at submission time, before
  -- any pro was known, so professional_id was left null there. Backfill it
  -- now — otherwise this payment would never show up in the pro's own
  -- earnings history (payments.listForPro filters by professional_id).
  update public.payments
     set professional_id = v_pro.id
   where booking_id = p_booking_id
     and professional_id is null
     and coalesce(kind, 'service') = 'service';

  return v_booking;
end;
$$;

grant execute on function public.claim_open_demand(uuid) to authenticated;

-- ── Sanity ───────────────────────────────────────────────────────────────────
select (select 1 from pg_proc where proname = 'claim_open_demand') as claim_rpc_ok;
