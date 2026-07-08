-- ============================================================================
-- CareLink — Payments: complete, self-contained setup. Run once in Supabase.
-- Fully idempotent (safe to re-run). Does NOT require payments.sql — it creates
-- everything: table, commission, auth-hold → capture-on-complete → refund, and
-- the pro payouts (wallet) flow.
-- (Requires schema.sql applied: needs public.set_updated_at() + current_role().)
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type payment_status as enum ('pending','authorized','captured','refunded','failed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payment_provider as enum ('cmi','stripe','cash');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payout_status as enum ('requested','processing','paid','rejected');
exception when duplicate_object then null; end $$;

-- ── payments table ──────────────────────────────────────────────────────────
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  patient_id      uuid not null references public.profiles(id),
  professional_id uuid references public.profiles(id),
  amount_mad      integer not null check (amount_mad > 0),
  commission_mad  integer not null default 0,
  provider        payment_provider not null default 'cmi',
  provider_ref    text,
  status          payment_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_payments_booking on public.payments(booking_id);
create index if not exists idx_payments_status  on public.payments(status);
create index if not exists idx_payments_pro     on public.payments(professional_id, status);

drop trigger if exists trg_payments_updated on public.payments;
create trigger trg_payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
drop policy if exists "payments_owner_read"     on public.payments;
create policy "payments_owner_read" on public.payments for select
  using (auth.uid() = patient_id or auth.uid() = professional_id or public.current_role() = 'admin');
drop policy if exists "payments_admin_all"       on public.payments;
create policy "payments_admin_all"  on public.payments for all
  using (public.current_role() = 'admin');
-- the missing piece: the patient can pay for their own booking
drop policy if exists "payments_patient_insert"  on public.payments;
create policy "payments_patient_insert" on public.payments for insert
  with check (auth.uid() = patient_id);

-- ── Commission (15%) — helper + auto-set on insert ──────────────────────────
create or replace function public.calc_commission(p_amount integer)
returns integer language sql immutable as $$ select greatest(1, (p_amount * 15) / 100) $$;

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

-- ── Capture on complete / refund on cancel ──────────────────────────────────
create or replace function public.capture_on_complete()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.payments set status = 'captured'
     where booking_id = new.id and status = 'authorized';
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.payments set status = 'refunded'
     where booking_id = new.id and status in ('authorized','captured');
  end if;
  return new;
end; $$;
drop trigger if exists trg_payment_capture on public.bookings;
create trigger trg_payment_capture after update on public.bookings
  for each row execute function public.capture_on_complete();

-- ── Payouts (pro wallet withdrawals) ────────────────────────────────────────
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

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$ begin
  begin alter publication supabase_realtime add table public.payments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.payouts;  exception when duplicate_object then null; end;
end $$;

-- ── Sanity ──────────────────────────────────────────────────────────────────
select
  (select 1 from information_schema.tables where table_name = 'payments')                          as payments_table,
  (select 1 from pg_policies where tablename = 'payments' and policyname = 'payments_patient_insert') as patient_insert_ok,
  (select 1 from pg_proc where proname = 'set_payment_commission')                                  as commission_fn,
  (select 1 from information_schema.tables where table_name = 'payouts')                            as payouts_table;
