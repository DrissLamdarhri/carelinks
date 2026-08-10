-- ============================================================================
-- CareLink — fix a real bug in cancel_yoga_booking(): it deletes the
-- enrollment row by a column that doesn't exist.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- FOUND LIVE, from the app's own error toast (proof the honest-error-message
-- fix from earlier is working): tapping "Annuler la réservation" on a yoga
-- booking failed with `column "id" does not exist`.
--
-- Root cause: `yoga_enrollments` has never had an `id` column — its primary
-- key is the composite (session_id, patient_id) (0001_schema.sql). But
-- cancel_yoga_booking() (introduced in 0041, carried into 0043's redeploy)
-- does `delete from yoga_enrollments where id = v_enrollment.id` — a bug I
-- introduced by wrongly assuming a surrogate id column existed. It never
-- errored during writing/type-checking because PL/pgSQL only plans each SQL
-- statement the first time it actually executes, so this specific line only
-- ever got exercised the first time a real patient tried to cancel a paid
-- (enrolled) yoga booking.
-- ============================================================================

drop function if exists public.cancel_yoga_booking(uuid);

create function public.cancel_yoga_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking      public.bookings;
  v_enrollment   public.yoga_enrollments;
  v_session      public.yoga_sessions;
  v_eligible     boolean := true;
  v_had_payment  boolean := false;
  v_had_enrollment boolean := false;
  v_refund_mad   numeric := 0;
  v_payment_amt  integer;
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
    -- Free the seat immediately so another patient can take it. Deleted by
    -- the real composite primary key — this table has no `id` column.
    delete from public.yoga_enrollments
     where session_id = v_enrollment.session_id and patient_id = v_enrollment.patient_id;
  elsif v_booking.yoga_session_id is not null then
    -- No enrollment yet (still unpaid) — look the class up straight from the
    -- booking so the cancellation notice can still say which one it was.
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

-- ── Sanity ───────────────────────────────────────────────────────────────────
select (select count(*) from pg_proc where proname = 'cancel_yoga_booking') as cancel_fn_count;
