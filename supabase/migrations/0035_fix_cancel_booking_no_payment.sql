-- ============================================================================
-- CareLink — fix cancel_booking() announcing a "refund" that never happened.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- THE BUG (reported live by a patient testing a normal request): they posted
-- a request, no professional was ever around to bid, so they cancelled while
-- it was still `open` — before ever reaching the payment screen. No payment
-- row exists for that booking. cancel_booking() (0022_escrow_cancellation_
-- rules.sql) computed v_refund straight from the booking's price (budget +
-- fee) with no check for whether a payment was ever actually collected, then
-- told the patient "remboursement intégral de 75 MAD". No money moved (there
-- was nothing to refund), but the notification is flatly false — the exact
-- same gap exists for RULE #2/#3/#4. Fixed by tracking whether an escrow
-- payment actually existed (v_had_payment) and wording each notification —
-- and the returned refund_mad — accordingly.
-- ============================================================================

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
  v_had_payment boolean;
begin
  select patient_id, professional_id, status::text,
         coalesce(final_price_mad, budget_max_mad, budget_min_mad, 0)
    into v_patient, v_pro, v_status, v_price
    from public.bookings where id = p_booking;
  if not found then raise exception 'Réservation introuvable'; end if;

  -- Prefer the actual escrow hold amount as the price basis, if a payment
  -- exists — and remember whether one does, so we never announce a refund
  -- for money that was never actually taken.
  select amount_mad into v_hold_amount from public.payments
    where booking_id = p_booking and coalesce(kind,'service') = 'service'
      and status in ('authorized','captured')
    order by created_at desc limit 1;
  v_had_payment := v_hold_amount is not null;
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
    -- Client fully refunded (if they'd paid anything); a penalty is deducted
    -- from the nurse's balance regardless — that's about their conduct, not
    -- about what the client happened to have paid.
    v_case := 4;
    v_penalty := c_penalty;
    if v_had_payment then
      v_refund := v_price + c_fee;
      update public.payments set status = 'refunded'
        where booking_id = p_booking and status in ('authorized','captured') and coalesce(kind,'service') = 'service';
    end if;
    insert into public.payments (booking_id, patient_id, professional_id, amount_mad, commission_mad, provider, status, kind)
      values (p_booking, v_patient, v_pro, v_penalty, 0, 'cash', 'captured', 'penalty');
  elsif v_status = 'open' then
    -- ── RULE #1 : nurse has not moved → standard full refund, no fees ───────
    v_case := 1;
    if v_had_payment then
      v_refund := v_price + c_fee;
      update public.payments set status = 'refunded'
        where booking_id = p_booking and status in ('authorized','captured') and coalesce(kind,'service') = 'service';
    end if;
  elsif v_status = 'matched' then
    -- ── RULE #2 : accepted but not out → platform keeps commission + fee ────
    v_case := 2;
    if v_had_payment then
      v_refund := v_price - v_commission;      -- client gets P − C back; platform keeps C + F
      update public.payments set status = 'refunded'
        where booking_id = p_booking and status in ('authorized','captured') and coalesce(kind,'service') = 'service';
    end if;
  else
    -- v_status = 'en_route' or 'in_progress'
    -- ── RULE #3 : nurse is out → fees paid to the nurse as trip compensation ─
    v_case := 3;
    if v_had_payment then
      v_nurse_comp := v_commission + c_fee;    -- the deducted fees go to the nurse
      v_refund     := v_price - v_commission;  -- client gets P − C back
      update public.payments set status = 'refunded'
        where booking_id = p_booking and status in ('authorized','captured') and coalesce(kind,'service') = 'service';
      insert into public.payments (booking_id, patient_id, professional_id, amount_mad, commission_mad, provider, status, kind)
        values (p_booking, v_patient, v_pro, v_nurse_comp, 0, 'cash', 'captured', 'trip_comp');
    end if;
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
  -- Each branch has an honest "nothing was ever charged" wording for when
  -- v_had_payment is false — no more claiming a refund that never happened.
  insert into public.notifications (user_id, kind, title, body, payload)
  values (v_patient, 'booking_status', 'Réservation annulée',
    case
      when v_case = 1 and v_had_payment then 'Annulation — remboursement intégral de ' || v_refund || ' MAD.'
      when v_case = 1                   then 'Demande annulée — aucun montant n''avait été prélevé.'
      when v_case = 2 and v_had_payment then 'Annulation — remboursement de ' || v_refund || ' MAD (frais de service retenus).'
      when v_case = 2                   then 'Réservation annulée — aucun montant n''avait été prélevé.'
      when v_case = 3 and v_had_payment then 'Annulation — remboursement de ' || v_refund || ' MAD (le professionnel était déjà en route).'
      when v_case = 3                   then 'Réservation annulée — aucun montant n''avait été prélevé.'
      when v_case = 4 and v_had_payment then 'Le professionnel a annulé — remboursement intégral de ' || v_refund || ' MAD.'
      else                                    'Le professionnel a annulé — aucun montant n''avait été prélevé.'
    end,
    jsonb_build_object('booking_id', p_booking, 'cancel_case', v_case, 'refund_mad', v_refund, 'had_payment', v_had_payment));

  if v_pro is not null then
    insert into public.notifications (user_id, kind, title, body, payload)
    values (v_pro, 'booking_status',
      case when v_case = 4 then 'Pénalité appliquée' else 'Réservation annulée' end,
      case v_case
        when 3 then case when v_had_payment then 'Compensation de déplacement : ' || v_nurse_comp || ' MAD créditée à votre solde.'
                          else 'La réservation a été annulée.' end
        when 4 then 'Vous avez annulé — pénalité de ' || v_penalty || ' MAD déduite de votre solde.'
        else        'La réservation a été annulée.'
      end,
      jsonb_build_object('booking_id', p_booking, 'cancel_case', v_case,
                         'trip_comp_mad', v_nurse_comp, 'penalty_mad', v_penalty));
  end if;

  return jsonb_build_object('cancel_case', v_case, 'refund_mad', v_refund,
                            'nurse_comp_mad', v_nurse_comp, 'penalty_mad', v_penalty,
                            'had_payment', v_had_payment);
end $$;

grant execute on function public.cancel_booking(uuid, text) to authenticated;

-- ── Sanity ───────────────────────────────────────────────────────────────────
select (select 1 from pg_proc where proname = 'cancel_booking') as cancel_rpc_ok;
