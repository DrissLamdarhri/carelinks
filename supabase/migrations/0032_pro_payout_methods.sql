-- ============================================================================
-- CareLink — Professional payout details (RIB), so "Retirer" is actually payable.
-- ----------------------------------------------------------------------------
-- The payout flow was complete except for one thing: nowhere did a pro tell us
-- WHERE to send the money. An admin could mark a payout "paid" with no bank
-- account to send it to. This adds that missing piece.
--
-- Why a separate table and not columns on `professionals`:
--   policy "pros_public_read" (0001) lets ANY user select a professionals row
--   whose verification_status = 'approved'. A RIB stored there would be readable
--   by every patient in the app. This table is owner + admin only, never public.
--
-- NB CMI is irrelevant here. CMI is card ACQUIRING — money IN (patient card →
-- our merchant account). Paying a pro is money OUT, which is a bank transfer.
-- These payout details are needed whether or not CMI is live.
--
-- Idempotent. Run once in Supabase → SQL Editor.
-- ============================================================================

create table if not exists public.pro_payout_methods (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  holder_name     text not null,
  bank_name       text not null,
  rib             text not null,          -- 24 digits, stored normalised (no spaces)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Moroccan RIB is exactly 24 digits (bank 3 + branch 3 + account 16 + key 2).
do $$ begin
  alter table public.pro_payout_methods
    add constraint pro_payout_rib_format check (rib ~ '^[0-9]{24}$');
exception when duplicate_object then null; end $$;

drop trigger if exists trg_payout_methods_updated on public.pro_payout_methods;
create trigger trg_payout_methods_updated before update on public.pro_payout_methods
  for each row execute function public.set_updated_at();

-- ── RLS: the owner and admins. Explicitly NOT public. ───────────────────────
alter table public.pro_payout_methods enable row level security;

drop policy if exists "payout_method_owner_read" on public.pro_payout_methods;
create policy "payout_method_owner_read" on public.pro_payout_methods for select
  using (auth.uid() = professional_id or public.current_role() = 'admin');

drop policy if exists "payout_method_owner_write" on public.pro_payout_methods;
create policy "payout_method_owner_write" on public.pro_payout_methods for insert
  with check (auth.uid() = professional_id);

drop policy if exists "payout_method_owner_update" on public.pro_payout_methods;
create policy "payout_method_owner_update" on public.pro_payout_methods for update
  using (auth.uid() = professional_id) with check (auth.uid() = professional_id);

drop policy if exists "payout_method_admin_all" on public.pro_payout_methods;
create policy "payout_method_admin_all" on public.pro_payout_methods for all
  using (public.current_role() = 'admin');

-- ── Snapshot the destination onto each payout request ───────────────────────
-- The admin must pay exactly what was on file when the request was made: if a
-- pro edits their RIB afterwards, a pending payout must not silently retarget.
alter table public.payouts
  add column if not exists holder_name text,
  add column if not exists bank_name   text,
  add column if not exists rib         text;

create or replace function public.attach_payout_destination()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_holder text;
  v_bank   text;
  v_rib    text;
begin
  select holder_name, bank_name, rib
    into v_holder, v_bank, v_rib
    from public.pro_payout_methods
   where professional_id = new.professional_id;

  if v_rib is null then
    raise exception 'Ajoutez vos coordonnées bancaires (RIB) avant de demander un retrait';
  end if;

  new.holder_name := v_holder;
  new.bank_name   := v_bank;
  new.rib         := v_rib;
  return new;
end $$;

drop trigger if exists trg_payout_destination on public.payouts;
create trigger trg_payout_destination before insert on public.payouts
  for each row execute function public.attach_payout_destination();

-- Backfill destinations on payouts that predate this (best effort — only where
-- the pro has since registered a RIB).
update public.payouts p
   set holder_name = m.holder_name, bank_name = m.bank_name, rib = m.rib
  from public.pro_payout_methods m
 where m.professional_id = p.professional_id
   and p.rib is null;

-- ── Sanity ──────────────────────────────────────────────────────────────────
select
  (select 1 from information_schema.tables  where table_name='pro_payout_methods')                       as table_ok,
  (select 1 from information_schema.columns where table_name='payouts' and column_name='rib')            as payout_rib_col,
  (select 1 from pg_trigger where tgname='trg_payout_destination')                                       as guard_trigger,
  (select count(*) from pg_policies where tablename='pro_payout_methods')                                as policies_4;
