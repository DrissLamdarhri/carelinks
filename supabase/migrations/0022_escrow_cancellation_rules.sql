-- ============================================================================
-- CareLink — Escrow (InHold) payments + the 4 cancellation business rules.
-- Run once in Supabase → SQL Editor. Idempotent. Requires 0001 + 0005 applied.
--
-- MODEL (all amounts MAD, example price P = 120):
--   commission C = 15% of P   (18)
--   service fee F = 5          (flat, client-paid)
--   client pays  = P + F       (125)
--   nurse net    = P − C       (102)   ← released ONLY when the job is completed
--   platform     = C + F       (23)
--
-- ESCROW: a payment is created `authorized` (held / InHold) and is NOT counted
-- toward the nurse's withdrawable balance. It becomes `captured` (released) only
-- when the booking is marked `completed` (capture_on_complete trigger).
--
-- CANCELLATION CASES (implemented in public.cancel_booking):
--   RULE #1  open       (nurse not moved)          → full refund (P+F), no fees
--   RULE #2  matched    (accepted, not out)        → keep C+F, refund P−C, nurse 0
--   RULE #3  en_route / in_progress (nurse out)    → nurse gets C+F (trip comp), refund P−C
--   RULE #4  cancelled BY the nurse                → full refund (P+F) + penalty off nurse balance
-- ============================================================================

-- ── New booking status: `en_route` (nurse has left / is "out") ───────────────
-- NOTE: added as an enum value. Functions below compare with `status::text` so
-- they never coerce the literal 'en_route' at CREATE time (avoids the Postgres
-- "unsafe use of new enum value in the same transaction" error).
alter type booking_status add value if not exists 'en_route';

-- ── Ledger / settlement columns ──────────────────────────────────────────────
-- payments.kind distinguishes the escrow row from post-cancellation ledger rows:
--   'service'   → the client's escrow hold (authorized → captured | refunded)
--   'trip_comp' → RULE #3 compensation credited to the nurse (captured)
--   'penalty'   → RULE #4 debit against the nurse's balance (captured, subtracted)
alter table public.payments  add column if not exists kind text not null default 'service';

alter table public.bookings  add column if not exists cancel_case  smallint;   -- 1..4
alter table public.bookings  add column if not exists refund_mad   integer;     -- client refund recorded for CMI settlement
alter table public.bookings  add column if not exists cancelled_by text;        -- 'patient' | 'pro'

-- ── Commission back to 15% (client rule; supersedes 0006_commission_20) ───────
create or replace function public.calc_commission(p_amount integer)
returns integer language sql immutable as $$ select greatest(1, (p_amount * 15) / 100) $$;

-- Only the client's SERVICE payment is commissioned. trip_comp / penalty ledger
-- rows must keep commission 0 (the nurse receives the full trip comp; a penalty is
-- a flat debit) — so the auto-commission trigger skips non-service kinds.
create or replace function public.set_payment_commission()
returns trigger language plpgsql as $$
begin
  if coalesce(new.commission_mad, 0) = 0 and coalesce(new.kind, 'service') = 'service' then
    new.commission_mad := public.calc_commission(new.amount_mad);
  end if;
  return new;
end $$;

-- ── Escrow capture/refund on booking status change ───────────────────────────
-- completed → release the hold (authorized → captured).
-- cancelled → refund the hold, BUT only for the "plain" path (cancel_case is null).
-- When cancel_booking() runs it sets cancel_case and settles payments itself, so
-- this trigger must NOT double-refund. It also filters kind='service' so it can
-- never touch trip_comp / penalty ledger rows.
create or replace function public.capture_on_complete()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.payments set status = 'captured'
     where booking_id = new.id and status = 'authorized' and coalesce(kind,'service') = 'service';
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and new.cancel_case is null then
    update public.payments set status = 'refunded'
     where booking_id = new.id and status in ('authorized','captured') and coalesce(kind,'service') = 'service';
  end if;
  return new;
end; $$;

-- ── Status-change notifications (both parties stay in sync) ───────────────────
-- Adds the `en_route` message and skips the generic 'cancelled' notice when the
-- cancellation went through cancel_booking() (which sends a detailed, case-aware
-- notification with the refund / compensation / penalty amounts).
create or replace function public.notify_booking_status()
returns trigger language plpgsql security definer as $$
declare
  v_title text := 'Statut de la prestation';
  v_body  text;
begin
  if new.status is distinct from old.status then
    if new.status = 'cancelled' and new.cancel_case is not null then
      return new; -- detailed cancellation notification handled by cancel_booking()
    end if;
    v_body := case new.status::text
      when 'matched'     then 'Un professionnel a été assigné'
      when 'en_route'    then 'Le professionnel est en route'
      when 'in_progress' then 'La prestation a commencé'
      when 'completed'   then 'La prestation est terminée'
      when 'cancelled'   then 'La prestation a été annulée'
      else 'Statut mis à jour'
    end;
    insert into public.notifications (user_id, kind, title, body, payload)
    values (new.patient_id, 'booking_status', v_title, v_body,
            jsonb_build_object('booking_id', new.id, 'status', new.status));
    if new.professional_id is not null then
      insert into public.notifications (user_id, kind, title, body, payload)
      values (new.professional_id, 'booking_status', v_title, v_body,
              jsonb_build_object('booking_id', new.id, 'status', new.status));
    end if;
  end if;
  return new;
end; $$;

-- ── The 4 cancellation rules, one status-based RPC ───────────────────────────
-- A legacy public.cancel_booking(uuid, text) exists in this project (applied
-- ad-hoc, not in the repo) with different parameter names. `create or replace`
-- cannot rename parameters, so drop the old signature(s) first.
drop function if exists public.cancel_booking(uuid, text);
drop function if exists public.cancel_booking(uuid);

create or replace function public.cancel_booking(p_booking uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_fee     constant integer := 5;   -- flat service fee (client-paid)   ← change here
  c_penalty constant integer := 20;  -- RULE #4 nurse penalty (MAD)      ← change here
  v_patient uuid; v_pro uuid; v_status text; v_price integer;
  v_caller  uuid := auth.uid();
  v_is_pro  boolean; v_is_patient boolean;
  v_commission integer; v_case smallint;
  v_refund integer := 0; v_nurse_comp integer := 0; v_penalty integer := 0;
  v_hold_amount integer;
begin
  select patient_id, professional_id, status::text,
         coalesce(final_price_mad, budget_max_mad, budget_min_mad, 0)
    into v_patient, v_pro, v_status, v_price
    from public.bookings where id = p_booking;
  if not found then raise exception 'Réservation introuvable'; end if;

  -- Prefer the actual escrow hold amount as the price basis, if a payment exists.
  select amount_mad into v_hold_amount from public.payments
    where booking_id = p_booking and coalesce(kind,'service') = 'service'
    order by created_at desc limit 1;
  if v_hold_amount is not null then v_price := v_hold_amount; end if;
  v_commission := public.calc_commission(v_price); -- 15%

  v_is_pro     := (v_caller = v_pro);
  v_is_patient := (v_caller = v_patient);
  if not (v_is_pro or v_is_patient or public.current_role() = 'admin') then
    raise exception 'Non autorisé';
  end if;
  if v_status in ('completed','cancelled') then
    raise exception 'Cette réservation ne peut plus être annulée';
  end if;

  if v_is_pro then
    -- ── RULE #4 : cancellation caused BY the nurse ──────────────────────────
    -- Client fully refunded; a penalty is deducted from the nurse's balance.
    v_case := 4;
    v_refund  := v_price + c_fee;
    v_penalty := c_penalty;
    update public.payments set status = 'refunded'
      where booking_id = p_booking and status in ('authorized','captured') and coalesce(kind,'service') = 'service';
    insert into public.payments (booking_id, patient_id, professional_id, amount_mad, commission_mad, provider, status, kind)
      values (p_booking, v_patient, v_pro, v_penalty, 0, 'cash', 'captured', 'penalty');
  elsif v_status = 'open' then
    -- ── RULE #1 : nurse has not moved → standard full refund, no fees ───────
    v_case := 1;
    v_refund := v_price + c_fee;
    update public.payments set status = 'refunded'
      where booking_id = p_booking and status in ('authorized','captured') and coalesce(kind,'service') = 'service';
  elsif v_status = 'matched' then
    -- ── RULE #2 : accepted but not out → platform keeps commission + fee ────
    v_case := 2;
    v_refund := v_price - v_commission;      -- client gets P − C back; platform keeps C + F
    update public.payments set status = 'refunded'
      where booking_id = p_booking and status in ('authorized','captured') and coalesce(kind,'service') = 'service';
  else
    -- v_status = 'en_route' or 'in_progress'
    -- ── RULE #3 : nurse is out → fees paid to the nurse as trip compensation ─
    v_case := 3;
    v_nurse_comp := v_commission + c_fee;    -- the deducted fees go to the nurse
    v_refund     := v_price - v_commission;  -- client gets P − C back
    update public.payments set status = 'refunded'
      where booking_id = p_booking and status in ('authorized','captured') and coalesce(kind,'service') = 'service';
    insert into public.payments (booking_id, patient_id, professional_id, amount_mad, commission_mad, provider, status, kind)
      values (p_booking, v_patient, v_pro, v_nurse_comp, 0, 'cash', 'captured', 'trip_comp');
  end if;

  -- Cancel the booking. cancel_case is set → capture_on_complete skips its blanket
  -- refund and notify_booking_status skips its generic notice (handled below).
  update public.bookings
    set status = 'cancelled', cancelled_at = now(),
        cancel_reason = coalesce(p_reason, cancel_reason),
        cancel_case = v_case, refund_mad = v_refund,
        cancelled_by = case when v_is_pro then 'pro' else 'patient' end
  where id = p_booking;

  -- ── Notifications: every party stays in sync (case number + amounts) ───────
  insert into public.notifications (user_id, kind, title, body, payload)
  values (v_patient, 'booking_status', 'Réservation annulée',
    case v_case
      when 1 then 'Annulation — remboursement intégral de ' || v_refund || ' MAD.'
      when 2 then 'Annulation — remboursement de ' || v_refund || ' MAD (frais de service retenus).'
      when 3 then 'Annulation — remboursement de ' || v_refund || ' MAD (le professionnel était déjà en route).'
      else        'Le professionnel a annulé — remboursement intégral de ' || v_refund || ' MAD.'
    end,
    jsonb_build_object('booking_id', p_booking, 'cancel_case', v_case, 'refund_mad', v_refund));

  if v_pro is not null then
    insert into public.notifications (user_id, kind, title, body, payload)
    values (v_pro, 'booking_status',
      case when v_case = 4 then 'Pénalité appliquée' else 'Réservation annulée' end,
      case v_case
        when 3 then 'Compensation de déplacement : ' || v_nurse_comp || ' MAD créditée à votre solde.'
        when 4 then 'Vous avez annulé — pénalité de ' || v_penalty || ' MAD déduite de votre solde.'
        else        'La réservation a été annulée.'
      end,
      jsonb_build_object('booking_id', p_booking, 'cancel_case', v_case,
                         'trip_comp_mad', v_nurse_comp, 'penalty_mad', v_penalty));
  end if;

  return jsonb_build_object('cancel_case', v_case, 'refund_mad', v_refund,
                            'nurse_comp_mad', v_nurse_comp, 'penalty_mad', v_penalty);
end $$;

grant execute on function public.cancel_booking(uuid, text) to authenticated;

-- ── Sanity ───────────────────────────────────────────────────────────────────
select
  (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'booking_status' and e.enumlabel = 'en_route')       as en_route_ok,
  public.calc_commission(120)                                                as commission_should_be_18,
  (select 1 from pg_proc where proname = 'cancel_booking')                   as cancel_rpc_ok,
  (select 1 from information_schema.columns
     where table_name = 'payments' and column_name = 'kind')                 as payments_kind_ok;
