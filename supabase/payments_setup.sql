-- ============================================================================
-- CareLink — Payments: fill the gaps so the flow actually works.
-- Run once in Supabase → SQL Editor. Idempotent. Requires payments.sql applied.
--   1. Patient can INSERT a payment for their own booking (was missing → RLS block).
--   2. Commission (15%) is set automatically on insert.
--   3. Payouts table + request flow for the pro wallet.
-- ============================================================================

-- ── 1. Patient insert policy ────────────────────────────────────────────────
drop policy if exists "payments_patient_insert" on public.payments;
create policy "payments_patient_insert" on public.payments for insert
  with check (auth.uid() = patient_id);

-- ── 2. Auto-commission on insert ────────────────────────────────────────────
create or replace function public.set_payment_commission()
returns trigger language plpgsql as $$
begin
  if coalesce(new.commission_mad, 0) = 0 then
    new.commission_mad := public.calc_commission(new.amount_mad);
  end if;
  return new;
end $$;

drop trigger if exists trg_payment_commission on public.payments;
create trigger trg_payment_commission before insert on public.payments
  for each row execute function public.set_payment_commission();

-- ── 3. Payouts (pro wallet withdrawals) ─────────────────────────────────────
do $$ begin
  create type payout_status as enum ('requested', 'processing', 'paid', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.payouts (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  amount_mad      integer not null check (amount_mad > 0),
  status          payout_status not null default 'requested',
  method          text default 'bank',
  note            text,
  created_at      timestamptz not null default now(),
  processed_at    timestamptz
);
create index if not exists idx_payouts_pro on public.payouts(professional_id, created_at desc);

alter table public.payouts enable row level security;

drop policy if exists "payouts_owner_read" on public.payouts;
create policy "payouts_owner_read" on public.payouts for select
  using (auth.uid() = professional_id or public.current_role() = 'admin');

drop policy if exists "payouts_request" on public.payouts;
create policy "payouts_request" on public.payouts for insert
  with check (auth.uid() = professional_id);

drop policy if exists "payouts_admin_all" on public.payouts;
create policy "payouts_admin_all" on public.payouts for all
  using (public.current_role() = 'admin');

-- Realtime for live wallet/payment updates
do $$ begin
  begin alter publication supabase_realtime add table public.payments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.payouts;  exception when duplicate_object then null; end;
end $$;

-- Sanity
select
  (select 1 from pg_policies where tablename = 'payments' and policyname = 'payments_patient_insert') as patient_insert_ok,
  (select 1 from pg_proc where proname = 'set_payment_commission')                                    as commission_fn,
  (select 1 from information_schema.tables where table_name = 'payouts')                              as payouts_table;
