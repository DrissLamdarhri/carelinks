-- ============================================================================
-- CareLink — real patient/pro complaint & dispute system.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- WHY: there was no reachable way for a patient (or a pro) to report a real
-- problem — a nurse arriving very late because of traffic, a no-show, unsafe
-- or unprofessional conduct, a wrong price charged, property damage, an
-- identity mismatch (someone other than the approved pro showing up),
-- harassment, a payment that looks wrong, or anything else. The only thing
-- that ever existed (0015_disputes.sql: a `dispute_open` boolean + a dormant
-- `open_dispute()` RPC) was never called from any screen — patients and pros
-- had nowhere to go but argue with support outside the app, which is exactly
-- the kind of thing that turns into a bad review of our own engineering, not
-- of the actual incident.
--
-- This migration adds a proper `disputes` table covering the realistic case
-- list end to end: filing (by either side of a booking), evidence photos,
-- an admin resolution queue (refund / warn / dismiss), and a dispute counter
-- on the professional so repeat offenders are visible to admins.
-- ============================================================================

create type public.dispute_category as enum (
  'late_arrival',       -- pro arrived significantly after the ETA (traffic, etc.)
  'no_show',             -- pro never showed up at all
  'safety_incident',     -- anything physically unsafe during the visit
  'poor_conduct',        -- unprofessional behavior, rudeness
  'quality_issue',       -- the care/service itself was substandard
  'price_dispute',       -- final amount charged doesn't match what was agreed
  'property_damage',     -- something was damaged during the visit
  'harassment',          -- harassment / inappropriate behavior
  'identity_mismatch',   -- the person who showed up wasn't the approved pro
  'payment_issue',       -- payment/refund looks wrong
  'other'
);

create type public.dispute_status as enum (
  'open',
  'under_review',
  'resolved_refund',
  'resolved_warning',
  'resolved_dismissed'
);

create table if not exists public.disputes (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid references public.bookings(id) on delete set null,
  reporter_id       uuid not null references public.profiles(id) on delete cascade,
  reporter_role     text not null check (reporter_role in ('patient', 'professional')),
  against_id        uuid references public.profiles(id) on delete set null,
  category          public.dispute_category not null,
  description       text not null,
  evidence_paths    text[] not null default '{}',   -- private storage paths, not public URLs
  status            public.dispute_status not null default 'open',
  resolution_note   text,
  refund_amount_mad numeric,
  resolved_by       uuid references public.profiles(id),
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_disputes_status   on public.disputes(status, created_at desc);
create index if not exists idx_disputes_booking  on public.disputes(booking_id);
create index if not exists idx_disputes_against  on public.disputes(against_id);
create index if not exists idx_disputes_reporter on public.disputes(reporter_id);

alter table public.professionals add column if not exists dispute_count integer not null default 0;

drop trigger if exists disputes_set_updated_at on public.disputes;
create trigger disputes_set_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

alter table public.disputes enable row level security;

drop policy if exists "disputes select own or admin" on public.disputes;
create policy "disputes select own or admin" on public.disputes
  for select using (
    reporter_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- No direct insert/update policy: writes only go through file_dispute() /
-- resolve_dispute() below (security definer) so reporter_role, against_id
-- and the admin-only resolution gate can't be forged from the client.

-- ── File a dispute ───────────────────────────────────────────────────────
create or replace function public.file_dispute(
  p_booking_id uuid,
  p_category public.dispute_category,
  p_description text,
  p_evidence_paths text[] default '{}'
) returns public.disputes
language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings;
  v_role text;
  v_against uuid;
  v_row public.disputes;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Réservation introuvable.';
  end if;

  if v_booking.patient_id = auth.uid() then
    v_role := 'patient';
    v_against := v_booking.professional_id;
  elsif v_booking.professional_id = auth.uid() then
    v_role := 'professional';
    v_against := v_booking.patient_id;
  else
    raise exception 'Vous ne faites pas partie de cette réservation.';
  end if;

  if coalesce(trim(p_description), '') = '' then
    raise exception 'Merci de décrire ce qui s''est passé.';
  end if;

  insert into public.disputes (booking_id, reporter_id, reporter_role, against_id, category, description, evidence_paths)
  values (p_booking_id, auth.uid(), v_role, v_against, p_category, p_description, coalesce(p_evidence_paths, '{}'))
  returning * into v_row;

  if v_role = 'patient' and v_against is not null then
    update public.professionals set dispute_count = dispute_count + 1 where id = v_against;
  end if;

  -- Surface it to admins immediately — a silent queue is how the old
  -- dispute_open flag died unused.
  insert into public.notifications (user_id, kind, title, body, payload)
  select id, 'system', 'Nouveau litige',
         'Un litige a été ouvert sur une réservation — catégorie: ' || p_category::text,
         jsonb_build_object('dispute_id', v_row.id, 'booking_id', p_booking_id)
    from public.profiles where role = 'admin';

  return v_row;
end $$;

grant execute on function public.file_dispute(uuid, public.dispute_category, text, text[]) to authenticated;

-- ── Admin resolves a dispute ─────────────────────────────────────────────
create or replace function public.resolve_dispute(
  p_dispute_id uuid,
  p_status public.dispute_status,
  p_resolution_note text,
  p_refund_amount_mad numeric default null
) returns public.disputes
language plpgsql security definer set search_path = public as $$
declare
  v_row public.disputes;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if p_status not in ('under_review', 'resolved_refund', 'resolved_warning', 'resolved_dismissed') then
    raise exception 'Statut de résolution invalide.';
  end if;

  update public.disputes
     set status            = p_status,
         resolution_note   = p_resolution_note,
         refund_amount_mad = p_refund_amount_mad,
         resolved_by       = case when p_status = 'under_review' then resolved_by else auth.uid() end,
         resolved_at       = case when p_status = 'under_review' then resolved_at else now() end,
         updated_at        = now()
   where id = p_dispute_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'Litige introuvable.';
  end if;

  -- Honest refund: only flip a payment that's actually held (authorized or
  -- captured), same guard as the cancellation rules use — never announce
  -- money moving that never existed.
  if p_status = 'resolved_refund' and v_row.booking_id is not null then
    update public.payments
       set status = 'refunded'
     where booking_id = v_row.booking_id
       and status in ('authorized', 'captured');
  end if;

  insert into public.notifications (user_id, kind, title, body, payload)
  values (
    v_row.reporter_id, 'system', 'Votre litige a été traité',
    coalesce(p_resolution_note, 'Notre équipe a traité votre signalement.'),
    jsonb_build_object('dispute_id', v_row.id, 'status', p_status)
  );

  return v_row;
end $$;

grant execute on function public.resolve_dispute(uuid, public.dispute_status, text, numeric) to authenticated;

-- ── Private evidence bucket (photos attached to a complaint) ────────────
insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "dispute evidence own files" on storage.objects;
create policy "dispute evidence own files"
on storage.objects for all to authenticated
using (
  bucket_id = 'dispute-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'dispute-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "dispute evidence admin view" on storage.objects;
create policy "dispute evidence admin view"
on storage.objects for select to authenticated
using (
  bucket_id = 'dispute-evidence'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ── Sanity ───────────────────────────────────────────────────────────────
select (select count(*) from pg_type where typname = 'dispute_category') as category_enum_ok,
       (select count(*) from pg_proc where proname = 'file_dispute')     as file_fn_ok,
       (select count(*) from pg_proc where proname = 'resolve_dispute')  as resolve_fn_ok;
