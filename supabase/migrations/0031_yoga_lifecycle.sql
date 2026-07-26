-- ============================================================================
-- CareLink — Yoga lifecycle: completion, cancellation, capacity, no online.
-- ----------------------------------------------------------------------------
-- Yoga is a CLASS model, not an on-demand visit: the admin publishes a session,
-- patients enroll and pay (escrow hold), they attend, then the money is released.
-- That last step did not exist — nothing ever marked a class "done", so every
-- yoga payment stayed frozen in escrow forever (the same stuck-money class of
-- bug the Paiements banner reports).
--
-- This migration adds:
--   1. a status on yoga_sessions (scheduled → completed | cancelled)
--   2. enrollment ↔ booking link, so a class knows which payments it owns
--   3. complete_yoga_session()  → releases escrow  (booking → 'completed')
--      cancel_yoga_session()    → refunds everyone (booking → 'cancelled')
--   4. race-safe capacity enforcement (0019 counted without locking, so two
--      simultaneous enrollments could both pass the check and overfill a class)
--   5. removal of online classes — the client does not offer them.
--
-- Idempotent. Run once in Supabase → SQL Editor.
-- ============================================================================

-- ── 1. Session status ───────────────────────────────────────────────────────
do $$ begin
  create type yoga_session_status as enum ('scheduled','completed','cancelled');
exception when duplicate_object then null; end $$;

alter table public.yoga_sessions
  add column if not exists status         yoga_session_status not null default 'scheduled',
  add column if not exists completed_at   timestamptz,
  add column if not exists cancelled_at   timestamptz,
  add column if not exists cancel_reason  text;

create index if not exists idx_yoga_sessions_status on public.yoga_sessions(status, starts_at desc);

-- ── 2. Link an enrollment to the booking that carries its payment ───────────
alter table public.yoga_enrollments
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create index if not exists idx_yoga_enroll_booking on public.yoga_enrollments(booking_id);

-- Best-effort backfill for enrollments created before this link existed: match
-- the patient's yoga booking whose notes carry the session title.
update public.yoga_enrollments e
   set booking_id = b.id
  from public.bookings b, public.yoga_sessions s
 where e.booking_id is null
   and e.session_id = s.id
   and b.patient_id = e.patient_id
   and b.specialty  = 'yoga_instructor'
   and b.notes ilike '%' || s.title || '%';

-- ── 3. No online classes (client does not offer them) ───────────────────────
update public.yoga_sessions
   set is_online = false, meeting_url = null
 where is_online is true or meeting_url is not null;

do $$ begin
  alter table public.yoga_sessions
    add constraint yoga_no_online check (is_online is not true);
exception when duplicate_object then null; end $$;

-- ── 4. Race-safe capacity + validity guard ──────────────────────────────────
-- Replaces 0019: that version counted rows without locking the session, so two
-- concurrent inserts could both see "space left" and overfill the class.
create or replace function public.enforce_yoga_capacity()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_count    int;
  v_capacity int;
  v_status   yoga_session_status;
  v_starts   timestamptz;
begin
  -- Lock the session row so concurrent enrollments serialise on it.
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

drop trigger if exists trg_yoga_capacity on public.yoga_enrollments;
create trigger trg_yoga_capacity before insert on public.yoga_enrollments
  for each row execute function public.enforce_yoga_capacity();

-- ── 5. Completion → release escrow ──────────────────────────────────────────
-- Setting the booking to 'completed' fires capture_on_complete() (0005), which
-- flips its authorized payment to captured. That is what actually pays out.
create or replace function public.complete_yoga_session(p_session_id uuid)
returns int language plpgsql security definer
set search_path = public as $$
declare v_n int;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;

  update public.yoga_sessions
     set status = 'completed', completed_at = now()
   where id = p_session_id;

  update public.bookings b
     set status = 'completed'
    from public.yoga_enrollments e
   where e.session_id = p_session_id
     and e.booking_id = b.id
     and b.status not in ('completed','cancelled');
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── 6. Cancellation → refund everyone ───────────────────────────────────────
-- Booking → 'cancelled' fires the same trigger, which refunds held funds.
create or replace function public.cancel_yoga_session(p_session_id uuid, p_reason text default null)
returns int language plpgsql security definer
set search_path = public as $$
declare v_n int;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;

  update public.yoga_sessions
     set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   where id = p_session_id;

  update public.bookings b
     set status = 'cancelled'
    from public.yoga_enrollments e
   where e.session_id = p_session_id
     and e.booking_id = b.id
     and b.status not in ('completed','cancelled');
  get diagnostics v_n = row_count;

  -- Tell every enrolled patient why.
  insert into public.notifications (user_id, kind, title, body, payload)
  select e.patient_id, 'system', 'Séance de yoga annulée',
         coalesce(p_reason, 'La séance a été annulée. Vous êtes intégralement remboursé.'),
         jsonb_build_object('session_id', p_session_id)
    from public.yoga_enrollments e
   where e.session_id = p_session_id;

  return v_n;
end $$;

grant execute on function public.complete_yoga_session(uuid) to authenticated;
grant execute on function public.cancel_yoga_session(uuid, text) to authenticated;

-- ── 7. Storage bucket for class photos (uploaded, never hot-linked) ─────────
insert into storage.buckets (id, name, public)
values ('yoga-images', 'yoga-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "yoga images public read" on storage.objects;
create policy "yoga images public read"
on storage.objects for select
using (bucket_id = 'yoga-images');

drop policy if exists "yoga images admin write" on storage.objects;
create policy "yoga images admin write"
on storage.objects for all to authenticated
using (
  bucket_id = 'yoga-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
)
with check (
  bucket_id = 'yoga-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ── Sanity ──────────────────────────────────────────────────────────────────
select
  (select 1 from information_schema.columns where table_name='yoga_sessions' and column_name='status')      as status_col,
  (select 1 from information_schema.columns where table_name='yoga_enrollments' and column_name='booking_id') as link_col,
  (select 1 from pg_proc where proname='complete_yoga_session')                                              as complete_fn,
  (select 1 from pg_proc where proname='cancel_yoga_session')                                                as cancel_fn,
  (select 1 from storage.buckets where id='yoga-images')                                                     as bucket,
  (select count(*) from public.yoga_sessions where is_online is true)                                        as online_left_must_be_0;
