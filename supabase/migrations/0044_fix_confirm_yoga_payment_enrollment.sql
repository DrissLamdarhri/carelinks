-- ============================================================================
-- CareLink — redeploy confirm_yoga_payment() + enforce_yoga_capacity(), which
-- are silently failing to persist the enrollment on the live project.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- FOUND LIVE (03 Aug 2026), via a real end-to-end test against the live
-- project (fresh test patient, real upcoming session, real RPC call):
-- confirm_yoga_payment() returns {"ok": true}, the booking correctly flips
-- to 'matched', a real payment row is correctly created — but the
-- yoga_enrollments row it's supposed to insert FIRST never actually persists
-- (confirmed three independent ways: count(*) as the enrolled patient,
-- count(*) for the whole session, and a plain select — all return 0 rows,
-- right after the RPC reports success). Since the function has no exception
-- handler that could swallow a failure, and every other statement in the
-- same function body DID commit (payment insert, status update), this can
-- only be explained by function/trigger drift on the live project not
-- matching what 0043 defined — the same class of "deployed code doesn't
-- match the migration file" issue already hit once before this session
-- (0039, get_track_coords).
--
-- `create or replace function` only replaces a function with the EXACT same
-- argument signature — if an earlier, differently-typed draft was ever
-- applied (e.g. p_amount_mad as numeric instead of integer), both can
-- coexist as overloads, and PostgREST's RPC dispatch can resolve to the
-- wrong one. This migration removes that possibility outright: every
-- possible prior signature is dropped explicitly, then the function is
-- created fresh, once, unambiguously.
-- ============================================================================

drop function if exists public.confirm_yoga_payment(uuid, integer, text);
drop function if exists public.confirm_yoga_payment(uuid, numeric, text);
drop function if exists public.confirm_yoga_payment(uuid, integer, payment_provider);
drop function if exists public.confirm_yoga_payment(uuid, numeric, payment_provider);

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
  v_booking public.bookings;
  v_enrollment_id uuid;
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

  insert into public.yoga_enrollments (session_id, patient_id, booking_id)
  values (v_booking.yoga_session_id, auth.uid(), p_booking_id)
  returning session_id into v_enrollment_id;

  -- Defensive: if the insert above silently produced no row (should be
  -- impossible in standard Postgres — a BEFORE INSERT trigger either RAISEs
  -- or lets the row through — but this project's live schema has drifted
  -- from its migration files before), fail loudly instead of charging for a
  -- reservation that doesn't actually exist.
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

-- ── Redeploy the capacity trigger too, in case it's the actual culprit ──────
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

-- ── Sanity ───────────────────────────────────────────────────────────────────
select
  (select count(*) from pg_proc where proname = 'confirm_yoga_payment')   as confirm_fn_count,
  (select count(*) from pg_proc where proname = 'enforce_yoga_capacity')  as capacity_fn_count,
  (select count(*) from pg_trigger where tgname = 'trg_yoga_capacity')    as capacity_trigger_count;
