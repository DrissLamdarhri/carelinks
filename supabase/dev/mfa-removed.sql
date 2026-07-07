-- =====================================================================
-- CareLink — MFA schema (TOTP + backup codes)
-- Run in Supabase SQL Editor. Safe to re-run.
-- =====================================================================

-- Add MFA flags to profiles
alter table public.profiles
  add column if not exists mfa_enabled boolean not null default false,
  add column if not exists mfa_method text;

do $$ begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_mfa_method_check'
  ) then
    alter table public.profiles
      add constraint profiles_mfa_method_check
      check (mfa_method is null or mfa_method in ('totp', 'sms'));
  end if;
end $$;

-- Backup codes storage (hashed)
create table if not exists public.mfa_backup_codes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, code_hash)
);

create index if not exists idx_mfa_backup_codes_user on public.mfa_backup_codes(user_id);

-- RLS
alter table public.mfa_backup_codes enable row level security;
create policy "mfa_codes_owner"
  on public.mfa_backup_codes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
