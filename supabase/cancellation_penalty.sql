  -- ============================================================================
  -- CareLink — Late-cancellation penalty + warnings + suspension.
  -- Run once in Supabase → SQL Editor. Idempotent.
  -- Cancelling a booking while the pro is en route (matched / in_progress) costs a
  -- 5 MAD penalty (credited to the pro) + 1 warning. 2 warnings → account suspended.
  -- ============================================================================

  alter table public.profiles add column if not exists cancel_warnings integer not null default 0;
  alter table public.profiles add column if not exists is_suspended    boolean not null default false;

  create or replace function public.cancel_with_penalty(p_booking uuid)
  returns jsonb language plpgsql security definer
  set search_path = public as $$
  declare
    v_patient  uuid;
    v_status   text;
    v_pro      uuid;
    v_warnings integer;
    v_suspend  boolean;
  begin
    select patient_id, status, professional_id
      into v_patient, v_status, v_pro
      from public.bookings where id = p_booking;

    if not found then raise exception 'Réservation introuvable'; end if;
    if v_patient <> auth.uid() then raise exception 'Non autorisé'; end if;
    if v_status not in ('matched', 'in_progress') then
      raise exception 'Annulation sans pénalité pour ce statut';
    end if;

    -- Cancel the booking (this also refunds any patient pre-payment via the
    -- capture_on_complete trigger).
    update public.bookings
      set status = 'cancelled',
          cancelled_at = now(),
          cancel_reason = 'Annulation tardive (professionnel en route)'
    where id = p_booking;

    -- Add a warning; suspend at 2.
    update public.profiles
      set cancel_warnings = cancel_warnings + 1,
          is_suspended    = (cancel_warnings + 1) >= 2
    where id = auth.uid()
    returning cancel_warnings, is_suspended into v_warnings, v_suspend;

    -- 5 MAD compensation credited to the pro's wallet (inserted AFTER the cancel so
    -- the refund trigger doesn't touch it).
    if v_pro is not null then
      insert into public.payments (booking_id, patient_id, professional_id, amount_mad, commission_mad, provider, status)
      values (p_booking, auth.uid(), v_pro, 5, 0, 'cash', 'captured');
    end if;

    return jsonb_build_object('warnings', v_warnings, 'suspended', v_suspend, 'penalty_mad', 5);
  end $$;

  grant execute on function public.cancel_with_penalty(uuid) to authenticated;

  select
    (select 1 from information_schema.columns where table_name='profiles' and column_name='cancel_warnings') as warnings_col,
    (select 1 from pg_proc where proname='cancel_with_penalty') as rpc_ok;
