-- ============================================================================
-- CareLink — yoga payment/enrollment/cancellation: final consolidated
-- redeploy. Supersedes 0043, 0044, 0045, 0046 — running this once is
-- equivalent to running all four again, in the correct final state.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- WHY THIS EXISTS: testing live just now reproduced the EXACT original bug
-- (confirm_yoga_payment reports {"ok":true}, the booking correctly becomes
-- 'matched', a real payment row is correctly created — but the
-- yoga_enrollments row is not there) even though 0044 was specifically
-- written to make that impossible (it adds a RETURNING ... INTO check that
-- RAISES if the insert silently affects zero rows). Since that raise never
-- fired, the most likely explanation is that 0044/0045/0046 were not all
-- fully applied — not a new, deeper bug. Rather than write a fifth
-- speculative fix, this migration consolidates the intended final state of
-- every yoga RPC into ONE file, and its Sanity block reports the ACTUAL
-- deployed source of confirm_yoga_payment so this can be confirmed directly
-- instead of guessed at again.
--
-- IMPORTANT: run this ENTIRE file in one go in the SQL Editor, and watch for
-- any red error text partway through — if one statement fails, everything
-- after it may not run, which is exactly the class of problem this
-- migration exists to rule out.
-- ============================================================================

-- ── 1. Capacity trigger ──────────────────────────────────────────────────────
drop trigger if exists trg_yoga_capacity on public.yoga_enrollments;
drop function if exists public.enforce_yoga_capacity();

create function public.enforce_yoga_capacity()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_count    int;
  v_capacity int;
  v_status   yoga_session_status;
  v_starts   timestamptz;
begin
  select capacity, status, starts_at
    into v_capacity, v_status, v_starts
    from public.yoga_sessions
   where id = new.session_id
     for update;

  if not found then
    raise exception 'Séance introuvable';
  end if;
  if v_status <> 'scheduled' then
    raise exception 'Cette séance n''est plus ouverte aux inscriptions';
  end if;
  if v_starts < now() then
    raise exception 'Cette séance est déjà passée';
  end if;

  select count(*) into v_count
    from public.yoga_enrollments
   where session_id = new.session_id;

  if v_count >= coalesce(v_capacity, 0) then
    raise exception 'Séance complète';
  end if;
  return new;
end $$;

create trigger trg_yoga_capacity before insert on public.yoga_enrollments
  for each row execute function public.enforce_yoga_capacity();

-- ── 2. Pay → reserve, atomically, with a loud failure guard ─────────────────
drop function if exists public.confirm_yoga_payment(uuid, integer, text);
drop function if exists public.confirm_yoga_payment(uuid, numeric, text);

create function public.confirm_yoga_payment(
  p_booking_id uuid,
  p_amount_mad integer,
  p_provider text default 'cmi'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking          public.bookings;
  v_enrollment_check uuid;
  v_stale_booking_id uuid;
  v_stale_status     text;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Réservation introuvable.';
  end if;
  if v_booking.patient_id <> auth.uid() then
    raise exception 'Non autorisé.';
  end if;
  if v_booking.specialty <> 'yoga_instructor' then
    raise exception 'Cette réservation n''est pas un cours de yoga.';
  end if;
  if v_booking.yoga_session_id is null then
    raise exception 'Séance introuvable pour cette réservation.';
  end if;
  if v_booking.status <> 'open' then
    raise exception 'Cette réservation a déjà été traitée.';
  end if;

  -- Self-heal against a leftover enrollment row from a booking cancelled
  -- through a path that predates cancel_yoga_booking().
  select booking_id into v_stale_booking_id
    from public.yoga_enrollments
   where session_id = v_booking.yoga_session_id and patient_id = auth.uid();

  if v_stale_booking_id is not null then
    if v_stale_booking_id = p_booking_id then
      delete from public.yoga_enrollments
       where session_id = v_booking.yoga_session_id and patient_id = auth.uid();
    else
      select status into v_stale_status from public.bookings where id = v_stale_booking_id;
      if v_stale_status is null or v_stale_status = 'cancelled' then
        delete from public.yoga_enrollments
         where session_id = v_booking.yoga_session_id and patient_id = auth.uid();
      else
        raise exception 'Vous êtes déjà inscrit·e à ce cours.';
      end if;
    end if;
  end if;

  insert into public.yoga_enrollments (session_id, patient_id, booking_id)
  values (v_booking.yoga_session_id, auth.uid(), p_booking_id);

  -- Loud, explicit proof the row actually exists before charging anyone —
  -- a fresh SELECT, not trusting the INSERT's own reported success.
  select session_id into v_enrollment_check
    from public.yoga_enrollments
   where session_id = v_booking.yoga_session_id and patient_id = auth.uid();

  if v_enrollment_check is null then
    raise exception 'L''inscription n''a pas pu être enregistrée. Réessayez.';
  end if;

  insert into public.payments (booking_id, patient_id, professional_id, amount_mad, provider, status)
  values (p_booking_id, auth.uid(), v_booking.professional_id, p_amount_mad, p_provider::payment_provider, 'authorized');

  update public.bookings
     set status = 'matched', updated_at = now()
   where id = p_booking_id;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.confirm_yoga_payment(uuid, integer, text) to authenticated;

-- ── 3. Patient cancellation, with the correct primary key ───────────────────
drop function if exists public.cancel_yoga_booking(uuid);

create function public.cancel_yoga_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking        public.bookings;
  v_enrollment     public.yoga_enrollments;
  v_session        public.yoga_sessions;
  v_eligible       boolean := true;
  v_had_payment    boolean := false;
  v_had_enrollment boolean := false;
  v_refund_mad     numeric := 0;
  v_payment_amt    integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Réservation introuvable.';
  end if;
  if v_booking.patient_id <> auth.uid() then
    raise exception 'Non autorisé.';
  end if;
  if v_booking.specialty <> 'yoga_instructor' then
    raise exception 'Cette réservation n''est pas un cours de yoga.';
  end if;
  if v_booking.status in ('completed', 'cancelled') then
    raise exception 'Cette réservation est déjà terminée ou annulée.';
  end if;

  select e.* into v_enrollment from public.yoga_enrollments e where e.booking_id = p_booking_id limit 1;
  if v_enrollment.session_id is not null then
    v_had_enrollment := true;
    select s.* into v_session from public.yoga_sessions s where s.id = v_enrollment.session_id;
    -- yoga_enrollments has no `id` column — its key is (session_id, patient_id).
    delete from public.yoga_enrollments
     where session_id = v_enrollment.session_id and patient_id = v_enrollment.patient_id;
  elsif v_booking.yoga_session_id is not null then
    select s.* into v_session from public.yoga_sessions s where s.id = v_booking.yoga_session_id;
  end if;
  v_eligible := v_session.starts_at is null or (v_session.starts_at - now()) >= interval '24 hours';

  select amount_mad into v_payment_amt
    from public.payments
   where booking_id = p_booking_id and kind = 'service' and status in ('authorized', 'captured')
   limit 1;
  v_had_payment := v_payment_amt is not null;

  if v_eligible and v_had_payment then
    update public.payments
       set status = 'refunded'
     where booking_id = p_booking_id and kind = 'service' and status in ('authorized', 'captured');
    v_refund_mad := v_payment_amt;
  end if;

  update public.bookings
     set status        = 'cancelled',
         cancelled_at  = now(),
         cancel_reason = 'Annulé par le patient',
         cancelled_by  = 'patient',
         updated_at    = now()
   where id = p_booking_id;

  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    v_booking.patient_id,
    'booking_status',
    'Cours de yoga annulé',
    case
      when v_eligible and v_had_payment then
        'Votre inscription a été annulée. Remboursement intégral de ' || v_refund_mad || ' MAD effectué (annulation à plus de 24h du cours).'
      when v_had_payment then
        'Votre inscription a été annulée. Aucun remboursement : l''annulation a eu lieu à moins de 24h du cours.'
      else
        'Votre inscription a été annulée. Aucun montant n''avait été prélevé.'
    end,
    jsonb_build_object('booking_id', p_booking_id, 'refund_mad', v_refund_mad, 'eligible', v_eligible)
  );

  if v_had_enrollment and v_session.instructor_id is not null then
    insert into public.notifications (user_id, kind, title, body, payload)
    values (
      v_session.instructor_id,
      'booking_status',
      'Désinscription à votre cours',
      'Un·e élève s''est désinscrit·e de "' || coalesce(v_session.title, 'votre cours') || '".',
      jsonb_build_object('booking_id', p_booking_id, 'session_id', v_session.id)
    );
  end if;

  return jsonb_build_object('eligible', v_eligible, 'refund_mad', v_refund_mad, 'had_payment', v_had_payment);
end $$;

grant execute on function public.cancel_yoga_booking(uuid) to authenticated;

-- ── 4. One-time cleanup of orphaned enrollments (idempotent) ────────────────
delete from public.yoga_enrollments e
where e.booking_id is not null
  and exists (select 1 from public.bookings b where b.id = e.booking_id and b.status = 'cancelled');

delete from public.yoga_enrollments e
where e.booking_id is not null
  and not exists (select 1 from public.bookings b where b.id = e.booking_id);

-- ── Sanity — paste this whole result back if anything still looks wrong ────
select
  (select count(*) from pg_proc where proname = 'confirm_yoga_payment')  as confirm_fn_count,
  (select count(*) from pg_proc where proname = 'cancel_yoga_booking')   as cancel_fn_count,
  (select count(*) from pg_proc where proname = 'enforce_yoga_capacity') as capacity_fn_count,
  (select count(*) from pg_trigger where tgname = 'trg_yoga_capacity')   as capacity_trigger_count,
  (select prosrc like '%v_enrollment_check%' from pg_proc where proname = 'confirm_yoga_payment' limit 1) as confirm_fn_is_latest_version;
