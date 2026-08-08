-- ============================================================================
-- CareLink — append-only log of terms-of-use acceptances.
-- Run once in Supabase → SQL Editor. Idempotent. Moves no money.
--
-- WHY A TABLE AND NOT JUST A COLUMN
-- `profiles.policy_accepted_at` / `policy_version` already exist (0018), but a
-- column records only the LAST acceptance: re-accepting a new version silently
-- destroys the evidence that the earlier one was ever agreed to. The entire
-- point of this record is to be producible later — "this user, this version,
-- this timestamp" — so it has to accumulate, not overwrite.
--
-- Append-only is enforced, not merely intended: there is an INSERT policy and
-- a SELECT policy and deliberately NO update or delete policy, so under RLS
-- nobody (including the user themselves) can rewrite their own history. The
-- profiles columns stay as the cheap "has this user accepted?" lookup; this
-- table is the audit trail behind it.
--
-- NOTE ON WHAT THIS IS AND ISN'T: this proves consent was collected. It does
-- not, on its own, make the disclaimer enforceable — that depends on the terms
-- themselves and on Moroccan consumer law. Have a lawyer read the text.
-- ============================================================================

create table if not exists public.terms_acceptances (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  version      text not null,                 -- e.g. '2026-08-08'
  accepted_at  timestamptz not null default now(),
  -- Context, so a later dispute can show WHAT the user was actually shown:
  locale       text,                          -- which translation they read
  role         text,                          -- patient | professional | admin
  platform     text,                          -- ios | android | web
  app_version  text,
  created_at   timestamptz not null default now()
);

comment on table public.terms_acceptances is
  'Append-only record of every terms-of-use acceptance. No update/delete policy exists by design.';

-- A user may accept a given version once; re-tapping is not a new fact.
create unique index if not exists uniq_terms_acceptance_user_version
  on public.terms_acceptances (user_id, version);

create index if not exists idx_terms_acceptances_user
  on public.terms_acceptances (user_id, accepted_at desc);

alter table public.terms_acceptances enable row level security;

-- INSERT: only ever for yourself. `with check` on auth.uid() means a
-- compromised client cannot forge an acceptance on someone else's behalf.
drop policy if exists terms_acceptances_insert_own on public.terms_acceptances;
create policy terms_acceptances_insert_own
  on public.terms_acceptances for insert
  to authenticated
  with check (user_id = auth.uid());

-- SELECT: your own rows.
drop policy if exists terms_acceptances_select_own on public.terms_acceptances;
create policy terms_acceptances_select_own
  on public.terms_acceptances for select
  to authenticated
  using (user_id = auth.uid());

-- Deliberately absent: UPDATE and DELETE policies. With RLS on and no policy,
-- both are denied for every non-superuser role — which is the whole point.

-- Admins need to be able to produce the record in a dispute. Kept as a
-- security-definer function rather than a broad SELECT policy so the read is
-- narrow, explicit, and auditable.
create or replace function public.admin_terms_history(p_user_id uuid)
returns setof public.terms_acceptances
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Réservé aux administrateurs';
  end if;

  return query
    select * from public.terms_acceptances
     where user_id = p_user_id
     order by accepted_at desc;
end;
$$;

revoke all on function public.admin_terms_history(uuid) from public, anon;
grant execute on function public.admin_terms_history(uuid) to authenticated;

-- ── Sanity ───────────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'terms_acceptances') as table_ok,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'terms_acceptances') as policy_count,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'terms_acceptances'
      and cmd in ('UPDATE', 'DELETE')) as mutating_policies_must_be_zero;
