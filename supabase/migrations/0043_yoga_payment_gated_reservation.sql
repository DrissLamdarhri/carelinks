-- ============================================================================
-- CareLink — yoga: a reservation is not real until it's paid.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- THE BUG (found live, flagged directly by the product owner): tapping
-- "Réserver" inserted into yoga_enrollments IMMEDIATELY — before the patient
-- ever reached the payment screen, let alone completed it. Two real
-- consequences:
--   1. A patient who backed out of payment (closed the app, pressed back,
--      anything) had still permanently taken a seat in a capacity-limited
--      class — enforce_yoga_capacity() had already counted them in, blocking
--      a paying patient from that spot for nothing.
--   2. The booking was created with status = 'matched' straight away, which
--      every other screen in this app treats as "confirmed" — so an unpaid,
--      abandoned reservation displayed and behaved exactly like a paid one.
--      That is the literal complaint: "why is he considered as paid."
--
-- THE FIX: reorder the flow so paying is what creates the reservation, not a
-- side effect of tapping a button.
--   • "Réserver" now only creates a bookings row with status = 'open' (the
--     same status every other specialty starts at before being matched) and
--     a NEW bookings.yoga_session_id column carrying which class it's for —
--     needed because, until now, the only thing that ever linked a booking
--     to its session was the yoga_enrollments row, and that row no longer
--     exists yet at this point.
--   • The payment screen calls confirm_yoga_payment() below on success. That
--     one function does, atomically: insert the enrollment (which is what
--     ACTUALLY enforces capacity, via the existing race-safe trigger from
--     0031 — if the class filled up while the patient was checking out, this
--     raises and the whole function aborts) → THEN insert the payment row →
--     THEN flip the booking to 'matched'. If the class is full, no payment
--     row is ever created — nobody is charged for a seat that doesn't exist.
--   • sync_open_demand() (0028) mirrors every 'open' booking into the pro
--     bidding feed (open_demands) — but yoga classes are never bid on, the
--     instructor is already fixed by the session. Excluded explicitly so a
--     pending-payment yoga reservation never shows up asking a yoga
--     instructor to "bid" on it.
-- ============================================================================

alter table public.bookings
  add column if not exists yoga_session_id uuid references public.yoga_sessions(id) on delete set null;

create index if not exists idx_bookings_yoga_session on public.bookings(yoga_session_id) where yoga_session_id is not null;

-- ── Keep yoga out of the bidding feed at every status, not just non-'open' ──
create or replace function public.sync_open_demand()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.open_demands where booking_id = old.id;
    return old;
  end if;

  -- Only `open` bookings are visible to the market, and yoga never bids —
  -- its instructor is fixed by the session, price is fixed by the class.
  if new.status::text <> 'open' or new.specialty = 'yoga_instructor' then
    delete from public.open_demands where booking_id = new.id;
    return new;
  end if;

  insert into public.open_demands (
    booking_id, specialty, urgency, scheduled_at,
    budget_min_mad, budget_max_mad, area_label, approx_lat, approx_lng, created_at
  ) values (
    new.id, new.specialty, new.urgency, new.scheduled_at,
    new.budget_min_mad, new.budget_max_mad,
    public.area_from_address(new.address),
    round(st_y(new.location::geometry)::numeric, 2),
    round(st_x(new.location::geometry)::numeric, 2),
    coalesce(new.created_at, now())
  )
  on conflict (booking_id) do update set
    specialty      = excluded.specialty,
    urgency        = excluded.urgency,
    scheduled_at   = excluded.scheduled_at,
    budget_min_mad = excluded.budget_min_mad,
    budget_max_mad = excluded.budget_max_mad,
    area_label     = excluded.area_label,
    approx_lat     = excluded.approx_lat,
    approx_lng     = excluded.approx_lng;

  return new;
end $$;

-- A yoga booking created 'open' before this migration would already have
-- leaked into open_demands under the old trigger — clean that up now.
delete from public.open_demands d
using public.bookings b
where d.booking_id = b.id and b.specialty = 'yoga_instructor';

-- ── Close the loophole this whole migration exists to fix ───────────────────
-- "yoga_enroll_self" (0001) granted patients unrestricted INSERT/UPDATE/
-- DELETE on their own yoga_enrollments rows — i.e. a client could still
-- insert a real enrollment directly, skipping payment entirely, exactly the
-- bug this migration fixes at the app level. Every legitimate write now goes
-- through a SECURITY DEFINER function (confirm_yoga_payment inserts,
-- cancel_yoga_booking deletes) which bypasses RLS regardless — patients only
-- ever need to READ their own rows, which "yoga_enroll_read" already covers.
drop policy if exists "yoga_enroll_self" on public.yoga_enrollments;

-- ── Pay → reserve, atomically ───────────────────────────────────────────────
create or replace function public.confirm_yoga_payment(
  p_booking_id uuid,
  p_amount_mad integer,
  p_provider text default 'cmi'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
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

  -- Capacity is enforced HERE, for real, by the existing race-safe trigger
  -- (enforce_yoga_capacity, 0031) — locks the session row, rejects if full,
  -- already-started, or cancelled. If it raises, this whole function aborts:
  -- no payment row is created, the booking stays 'open' for the patient to
  -- retry elsewhere or let the cleanup job below cancel it.
  insert into public.yoga_enrollments (session_id, patient_id, booking_id)
  values (v_booking.yoga_session_id, auth.uid(), p_booking_id);

  insert into public.payments (booking_id, patient_id, professional_id, amount_mad, provider, status)
  values (p_booking_id, auth.uid(), v_booking.professional_id, p_amount_mad, p_provider::payment_provider, 'authorized');

  update public.bookings
     set status = 'matched', updated_at = now()
   where id = p_booking_id;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.confirm_yoga_payment(uuid, integer, text) to authenticated;

-- ── Never let an abandoned checkout sit forever ─────────────────────────────
-- An 'open' yoga booking holds no seat and no money — but it would otherwise
-- clutter "Mes RDV" indefinitely if the patient just walks away mid-checkout.
-- Generous grace period since this is a real card-entry+OTP flow, not a
-- one-tap confirm.
create or replace function public.expire_stale_yoga_reservations(p_grace_minutes integer default 45)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.bookings
     set status        = 'cancelled',
         cancelled_at  = now(),
         cancelled_by  = 'system',
         cancel_reason = 'Paiement non finalisé',
         updated_at    = now()
   where specialty = 'yoga_instructor'
     and status = 'open'
     and created_at < now() - make_interval(mins => p_grace_minutes);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

grant execute on function public.expire_stale_yoga_reservations(integer) to authenticated;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'expire-stale-yoga-reservations',
  '*/10 * * * *',
  $$ select public.expire_stale_yoga_reservations(45); $$
);

-- ── cancel_yoga_booking(): find the session even before an enrollment exists
--    (a patient can now cancel an unpaid, still-open reservation) ──────────
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
    -- Free the seat immediately so another patient can take it.
    delete from public.yoga_enrollments where id = v_enrollment.id;
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

  -- Only notify the instructor about a real desinscription — a booking
  -- cancelled before it was ever paid/enrolled never actually took a seat in
  -- their class, so there's nothing for them to be told about.
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
select
  (select count(*) from information_schema.columns
    where table_name = 'bookings' and column_name = 'yoga_session_id')          as session_col_ok,
  (select count(*) from pg_proc where proname = 'confirm_yoga_payment')         as confirm_fn_ok,
  (select count(*) from pg_proc where proname = 'expire_stale_yoga_reservations') as expire_fn_ok,
  (select count(*) from cron.job where jobname = 'expire-stale-yoga-reservations') as cron_job_ok;
