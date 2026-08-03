-- ============================================================================
-- CareLink — clean up orphaned yoga_enrollments rows + make confirm_yoga_payment
-- self-healing against them.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- FOUND LIVE (03 Aug 2026): a real payment attempt failed with
-- "duplicate key value violates unique constraint yoga_enrollments_pkey".
-- Root cause: before this session wired cancel_yoga_booking() into the
-- patient cancellation flow (bookings.tsx), cancelling a yoga booking went
-- through the generic cancel_booking() RPC — which has zero awareness of
-- yoga_enrollments and never deleted it. That left a real row sitting in
-- yoga_enrollments for (session_id, patient_id) even though its booking was
-- cancelled, permanently blocking any future re-enrollment in that same
-- class: yoga_enrollments' primary key is exactly (session_id, patient_id),
-- so a second attempt can never succeed while the stale row exists.
--
-- Fixes both the existing bad data and the root cause of it recurring:
--   1. One-time sweep — delete any yoga_enrollments row whose linked booking
--      is cancelled (or whose booking_id is dangling/null with no live
--      booking behind it). A cancelled booking never legitimately keeps a
--      seat.
--   2. confirm_yoga_payment() now self-heals: if it hits an existing
--      enrollment row for this exact (session, patient) pair, it checks
--      whether that row's booking is actually dead — if so it clears the
--      stale row and proceeds instead of crashing on the constraint; if the
--      existing enrollment is still live, it raises a clear, honest
--      "vous êtes déjà inscrit" instead of a raw Postgres error.
-- ============================================================================

-- ── 1. One-time sweep of existing orphaned rows ─────────────────────────────
delete from public.yoga_enrollments e
where e.booking_id is not null
  and exists (
    select 1 from public.bookings b
     where b.id = e.booking_id and b.status = 'cancelled'
  );

delete from public.yoga_enrollments e
where e.booking_id is not null
  and not exists (select 1 from public.bookings b where b.id = e.booking_id);

-- ── 2. Self-healing enrollment insert ───────────────────────────────────────
drop function if exists public.confirm_yoga_payment(uuid, integer, text);

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
  v_enrollment_id    uuid;
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

  -- Self-heal: a leftover enrollment row from a booking that was cancelled
  -- through a path that predates cancel_yoga_booking() would otherwise
  -- collide on the (session_id, patient_id) primary key. Only clear it if
  -- its booking is actually dead — a still-live enrollment correctly blocks
  -- a genuine double-booking.
  select booking_id into v_stale_booking_id
    from public.yoga_enrollments
   where session_id = v_booking.yoga_session_id and patient_id = auth.uid();

  if v_stale_booking_id is not null then
    if v_stale_booking_id = p_booking_id then
      -- Retrying this exact booking after a prior partial failure — fine.
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
  elsif exists (
    select 1 from public.yoga_enrollments
     where session_id = v_booking.yoga_session_id and patient_id = auth.uid()
  ) then
    -- booking_id is null (shouldn't normally happen post-0031, but be safe).
    delete from public.yoga_enrollments
     where session_id = v_booking.yoga_session_id and patient_id = auth.uid();
  end if;

  insert into public.yoga_enrollments (session_id, patient_id, booking_id)
  values (v_booking.yoga_session_id, auth.uid(), p_booking_id)
  returning session_id into v_enrollment_id;

  if v_enrollment_id is null then
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

-- ── Sanity ───────────────────────────────────────────────────────────────────
select
  (select count(*) from pg_proc where proname = 'confirm_yoga_payment') as confirm_fn_count,
  (select count(*) from public.yoga_enrollments e
     where e.booking_id is not null
       and exists (select 1 from public.bookings b where b.id = e.booking_id and b.status = 'cancelled')
  ) as remaining_orphans_should_be_0;
