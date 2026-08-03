-- ============================================================================
-- CareLink — yoga: admin session creation, real instructor link, and
-- per-patient self-service cancellation with a 24h refund policy.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- CONTEXT (checked directly against the live project before writing this):
--   • yoga_sessions / yoga_enrollments already exist (0001, extended by 0019,
--     0029, 0031) — far more built out than "create from scratch". Capacity
--     enforcement (enforce_yoga_capacity trigger) and an admin-only, WHOLE-
--     CLASS cancel_yoga_session()/complete_yoga_session() already exist too.
--   • Live probe found yoga_sessions.instructor_id does NOT exist (0001
--     defined it, but the deployed table never got it) — instead a freeform
--     instructor_name text column was added out-of-band. There is also no
--     `city` column at all. Both confirmed via a live `select *`.
--   • Nothing in the app ever calls cancel_yoga_session()/complete_yoga_session(),
--     and there is no admin UI to create a session — yoga_sessions rows only
--     exist today because someone inserted them by hand.
--   • cancel_booking() (0035) has zero time-based logic — it picks a refund
--     rule purely from booking status + caller role, so calling it on a yoga
--     booking would always apply RULE #2 (commission kept) regardless of how
--     far in advance of the class the patient cancels. There is no 24h-aware
--     path anywhere. This migration adds one, as its own function — mirroring
--     the "yoga gets its own lifecycle RPCs" convention 0031 already
--     established with cancel_yoga_session(), rather than bolting a 5th,
--     differently-shaped rule onto the already-intricate cancel_booking().
--   • yoga_sessions' RLS ("yoga_all") is currently `using (true) with check
--     (true)` for ALL operations — any authenticated user can insert/update/
--     delete any class today. Tightened to admin-only writes now that a real
--     admin screen exists to be the intended (and only) writer.
-- ============================================================================

-- ── Columns actually missing live ───────────────────────────────────────────
alter table public.yoga_sessions
  add column if not exists city text,
  add column if not exists instructor_id uuid references public.professionals(id) on delete set null;

create index if not exists idx_yoga_sessions_instructor on public.yoga_sessions(instructor_id);

-- ── Lock down who can create/edit/delete classes ────────────────────────────
drop policy if exists "yoga_all" on public.yoga_sessions;
create policy "yoga_admin_write" on public.yoga_sessions
  for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');
-- "yoga_read" (public select) and "yoga_instructor" (instructor manages their
-- own class) from 0001 are untouched.

-- ── Server-side source of truth for the 24h rule ────────────────────────────
create or replace function public.can_refund_yoga_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(s.starts_at - now() >= interval '24 hours', true)
    from public.yoga_enrollments e
    join public.yoga_sessions s on s.id = e.session_id
   where e.booking_id = p_booking_id
   limit 1;
  -- No matching enrollment (e.g. the booking/enrollment link never completed)
  -- → coalesce to true: nothing "class-shaped" to protect, so a plain full
  -- refund is the fair default, same spirit as RULE #1 for a never-matched
  -- booking.
$$;

grant execute on function public.can_refund_yoga_booking(uuid) to authenticated;

-- ── Patient self-service cancellation (distinct from 0031's admin-only,
--    whole-class cancel_yoga_session) ────────────────────────────────────────
create or replace function public.cancel_yoga_booking(p_booking_id uuid)
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
    select s.* into v_session from public.yoga_sessions s where s.id = v_enrollment.session_id;
    v_eligible := v_session.starts_at is not null and (v_session.starts_at - now()) >= interval '24 hours';
    -- Free the seat immediately so another patient can take it.
    delete from public.yoga_enrollments where id = v_enrollment.id;
  end if;

  -- Honest refund: only touch a payment that actually exists and is held —
  -- same guard every other cancellation path in this app uses (0035).
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

  if v_session.instructor_id is not null then
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
select
  (select count(*) from pg_proc where proname = 'can_refund_yoga_booking') as can_refund_fn_ok,
  (select count(*) from pg_proc where proname = 'cancel_yoga_booking')     as cancel_fn_ok,
  (select count(*) from information_schema.columns
    where table_name = 'yoga_sessions' and column_name in ('city', 'instructor_id')) as new_cols_ok;
