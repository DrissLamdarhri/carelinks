-- ============================================================================
-- CareLink — Patient identity (CIN) verification.
-- ----------------------------------------------------------------------------
-- A nurse enters a stranger's home, so the patient must be identifiable. Model
-- copied from the pro KYC flow that already works:
--   patient submits CIN number + photo  →  id_status='pending'
--   admin approves/rejects              →  id_status='approved'|'rejected'
--
-- Privacy rules baked in here (the CIN photo is sensitive personal data):
--   • photos live in a PRIVATE bucket, readable only by the owner and admins
--   • professionals NEVER see the CIN number or photo — only a boolean badge
--     mirrored onto profiles.identity_verified
--   • patients cannot approve themselves (trigger, same lock as pros in 0009)
--
-- Idempotent. Run once in Supabase → SQL Editor.
-- ============================================================================

-- ── Status enum ─────────────────────────────────────────────────────────────
-- Distinct from verification_status: patients start at 'unverified' (nothing
-- submitted yet), which has no equivalent in the pro flow.
do $$ begin
  create type identity_status as enum ('unverified','pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- ── Columns on patients ─────────────────────────────────────────────────────
alter table public.patients
  add column if not exists cin_number          text,
  add column if not exists cin_photo_path      text,
  add column if not exists id_status           identity_status not null default 'unverified',
  add column if not exists id_submitted_at     timestamptz,
  add column if not exists id_verified_at      timestamptz,
  add column if not exists id_verified_by      uuid references public.profiles(id) on delete set null,
  add column if not exists id_rejection_reason text;

create index if not exists idx_patients_id_status on public.patients(id_status)
  where id_status = 'pending';

-- Moroccan CIN: 1–2 letters followed by 5–6 digits (e.g. "AB123456", "J12345").
-- Lenient + case-insensitive; null allowed so the column can exist before use.
do $$ begin
  alter table public.patients
    add constraint patients_cin_format
    check (cin_number is null or cin_number ~* '^[A-Z]{1,2}[0-9]{5,6}$');
exception when duplicate_object then null; end $$;

-- ── Public badge on profiles (what a pro is allowed to see) ─────────────────
alter table public.profiles
  add column if not exists identity_verified boolean not null default false;

create or replace function public.sync_identity_verified()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  update public.profiles
     set identity_verified = (new.id_status = 'approved')
   where id = new.id;
  return new;
end $$;

drop trigger if exists trg_sync_identity_verified on public.patients;
create trigger trg_sync_identity_verified
  after insert or update of id_status on public.patients
  for each row execute function public.sync_identity_verified();

-- ── Patients cannot approve themselves (mirrors 0009 for pros) ──────────────
create or replace function public.protect_patient_identity_fields()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if public.current_role() is distinct from 'admin' then
    -- The decision fields are admin-only.
    new.id_verified_at      := old.id_verified_at;
    new.id_verified_by      := old.id_verified_by;
    new.id_rejection_reason := old.id_rejection_reason;
    -- A patient may only move their own record into review ('pending') by
    -- submitting, or leave it untouched. Anything else reverts.
    if new.id_status is distinct from old.id_status
       and new.id_status <> 'pending' then
      new.id_status := old.id_status;
    end if;
    -- Re-submitting after a rejection is allowed; tampering after approval is not.
    if old.id_status = 'approved' then
      new.id_status     := old.id_status;
      new.cin_number    := old.cin_number;
      new.cin_photo_path := old.cin_photo_path;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_patient_identity on public.patients;
create trigger trg_protect_patient_identity
  before update on public.patients
  for each row execute function public.protect_patient_identity_fields();

-- ── Table RLS: owner manages their row, admin reviews ───────────────────────
alter table public.patients enable row level security;

drop policy if exists "patients_self_read"  on public.patients;
create policy "patients_self_read" on public.patients for select
  using (auth.uid() = id or public.current_role() = 'admin');

drop policy if exists "patients_self_write" on public.patients;
create policy "patients_self_write" on public.patients for update
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "patients_self_insert" on public.patients;
create policy "patients_self_insert" on public.patients for insert
  with check (auth.uid() = id);

drop policy if exists "patients_admin_all"  on public.patients;
create policy "patients_admin_all" on public.patients for all
  using (public.current_role() = 'admin');

-- ── Private storage bucket for CIN photos ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('patient-ids', 'patient-ids', false)
on conflict (id) do update set public = excluded.public;

-- Owner-only: the path MUST start with the user's uid — "<uid>/cin.jpg".
drop policy if exists "patient ids own files" on storage.objects;
create policy "patient ids own files"
on storage.objects for all to authenticated
using (
  bucket_id = 'patient-ids'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'patient-ids'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins review them; nobody else (professionals included) can read this bucket.
drop policy if exists "admins view patient ids" on storage.objects;
create policy "admins view patient ids"
on storage.objects for select to authenticated
using (
  bucket_id = 'patient-ids'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ── Backfill: existing patients keep working, flagged as unverified ─────────
update public.patients set id_status = 'unverified' where id_status is null;
update public.profiles p
   set identity_verified = coalesce((select pt.id_status = 'approved'
                                       from public.patients pt where pt.id = p.id), false)
 where p.role = 'patient' and p.identity_verified is distinct from
       coalesce((select pt.id_status = 'approved' from public.patients pt where pt.id = p.id), false);

-- ── Realtime (so the gate releases the moment an admin approves) ────────────
do $$ begin
  begin alter publication supabase_realtime add table public.patients; exception when duplicate_object then null; end;
end $$;

-- ── Sanity ──────────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.columns
    where table_name='patients' and column_name in
      ('cin_number','cin_photo_path','id_status','id_submitted_at','id_verified_at','id_verified_by','id_rejection_reason')) as patient_cols_7,
  (select 1 from information_schema.columns
    where table_name='profiles' and column_name='identity_verified')                       as badge_col,
  (select 1 from storage.buckets where id='patient-ids' and public = false)                as private_bucket,
  (select 1 from pg_trigger where tgname='trg_protect_patient_identity')                   as self_approve_lock;
