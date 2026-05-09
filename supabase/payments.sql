-- =====================================================================
-- CareLink — Payments (Step 10)
-- Auth-hold on bid accept, capture on booking complete, refund on cancel.
-- Provider-agnostic: works with CMI (Maroc) or Stripe via edge function.
-- =====================================================================

create type payment_status as enum ('pending', 'authorized', 'captured', 'refunded', 'failed');
create type payment_provider as enum ('cmi', 'stripe', 'cash');

create table public.payments (
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

create index idx_payments_booking on public.payments(booking_id);
create index idx_payments_status  on public.payments(status);

create trigger trg_payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
create policy "payments_owner_read" on public.payments for select
  using (auth.uid() = patient_id or auth.uid() = professional_id or public.current_role() = 'admin');
create policy "payments_admin_all"  on public.payments for all
  using (public.current_role() = 'admin');

-- Helper: compute 15% platform commission
create or replace function public.calc_commission(p_amount integer)
returns integer language sql immutable as $$ select greatest(1, (p_amount * 15) / 100) $$;

-- On booking complete -> mark payment captured
create or replace function public.capture_on_complete()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.payments
       set status = 'captured'
     where booking_id = new.id
       and status = 'authorized';
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.payments
       set status = 'refunded'
     where booking_id = new.id
       and status in ('authorized', 'captured');
  end if;
  return new;
end; $$;

drop trigger if exists trg_payment_capture on public.bookings;
create trigger trg_payment_capture after update on public.bookings
  for each row execute function public.capture_on_complete();
