-- ============================================================================
-- CareLink — stop broadcasting patients' home addresses to every professional.
-- Run in Supabase → SQL Editor. Idempotent.
--
-- THE LEAK (0001_schema.sql:371):
--   create policy "bookings_pro_view" on public.bookings for select using (
--     auth.uid() = professional_id
--     or (status = 'open' and public.current_role() = 'professional')   ← this
--   );
-- Every approved professional could read EVERY column of EVERY open booking:
--   • `address`  — the patient's exact street address
--   • `location` — their precise GPS point
--   • `notes`    — free text, frequently medical detail
-- before anyone had accepted anything. For a service where patients are often
-- elderly, ill, or alone at home, dozens of strangers received a home address
-- for free. It is also how the platform gets bypassed: a pro can contact or
-- visit the patient directly and keep the commission.
--
-- THE FIX — pros see only what they need to price a job:
--   `open_demands` is a redacted projection of open bookings, kept in sync by
--   trigger: specialty, urgency, timing, budget, a district-level area label and
--   coordinates fuzzed to ~1 km. No street, no exact point, no notes.
--   The full booking unlocks the moment the pro is actually assigned to it.
--
-- Why a table and not a view: Realtime (postgres_changes) only publishes tables,
-- and the pro's live demand feed depends on it.
-- ============================================================================

-- ── Area label: drop the street line, keep district + city ──────────────────
-- "12 Rue Ali, Agdal, Fès" → "Agdal, Fès"      "3X58+Q4P, Fès" → "Fès"
-- A single-segment address is a bare street or Plus Code and cannot be redacted
-- safely, so it yields NULL rather than leaking.
create or replace function public.area_from_address(p_address text)
returns text language plpgsql immutable as $$
declare
  parts text[];
  n     integer;
begin
  if p_address is null or btrim(p_address) = '' then
    return null;
  end if;
  parts := string_to_array(p_address, ',');
  n := array_length(parts, 1);
  if n is null or n < 2 then
    return null;
  end if;
  return btrim(array_to_string(parts[2:n], ', '));
end $$;

-- ── The redacted feed pros are allowed to see ───────────────────────────────
create table if not exists public.open_demands (
  booking_id     uuid primary key references public.bookings(id) on delete cascade,
  specialty      pro_specialty not null,
  urgency        urgency_level,
  scheduled_at   timestamptz,
  budget_min_mad numeric(10,2),
  budget_max_mad numeric(10,2),
  area_label     text,           -- district + city only
  approx_lat     numeric(8,2),   -- ~1 km grid, never the patient's doorstep
  approx_lng     numeric(8,2),
  created_at     timestamptz not null default now()
);
create index if not exists idx_open_demands_specialty
  on public.open_demands (specialty, created_at desc);

create or replace function public.sync_open_demand()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.open_demands where booking_id = old.id;
    return old;
  end if;

  -- Only `open` bookings are visible to the market. The moment one is matched,
  -- cancelled or completed it leaves the feed.
  if new.status::text <> 'open' then
    delete from public.open_demands where booking_id = new.id;
    return new;
  end if;

  insert into public.open_demands (
    booking_id, specialty, urgency, scheduled_at,
    budget_min_mad, budget_max_mad, area_label, approx_lat, approx_lng, created_at
  ) values (
    new.id, new.specialty, new.urgency, new.scheduled_at,
    new.budget_min_mad, new.budget_max_mad,
    public.area_from_address(new.address),
    round(st_y(new.location::geometry)::numeric, 2),
    round(st_x(new.location::geometry)::numeric, 2),
    coalesce(new.created_at, now())
  )
  on conflict (booking_id) do update set
    specialty      = excluded.specialty,
    urgency        = excluded.urgency,
    scheduled_at   = excluded.scheduled_at,
    budget_min_mad = excluded.budget_min_mad,
    budget_max_mad = excluded.budget_max_mad,
    area_label     = excluded.area_label,
    approx_lat     = excluded.approx_lat,
    approx_lng     = excluded.approx_lng;

  return new;
end $$;

drop trigger if exists trg_sync_open_demand_ins on public.bookings;
create trigger trg_sync_open_demand_ins after insert on public.bookings
  for each row execute function public.sync_open_demand();

drop trigger if exists trg_sync_open_demand_upd on public.bookings;
create trigger trg_sync_open_demand_upd after update on public.bookings
  for each row execute function public.sync_open_demand();

drop trigger if exists trg_sync_open_demand_del on public.bookings;
create trigger trg_sync_open_demand_del after delete on public.bookings
  for each row execute function public.sync_open_demand();

-- Backfill the demands that are open right now.
insert into public.open_demands (
  booking_id, specialty, urgency, scheduled_at,
  budget_min_mad, budget_max_mad, area_label, approx_lat, approx_lng, created_at
)
select b.id, b.specialty, b.urgency, b.scheduled_at,
       b.budget_min_mad, b.budget_max_mad,
       public.area_from_address(b.address),
       round(st_y(b.location::geometry)::numeric, 2),
       round(st_x(b.location::geometry)::numeric, 2),
       coalesce(b.created_at, now())
  from public.bookings b
 where b.status::text = 'open'
on conflict (booking_id) do nothing;

-- ── Lock the real bookings table down ───────────────────────────────────────
-- A professional now reads a booking only once they are assigned to it.
alter table public.open_demands enable row level security;

drop policy if exists "demands_pro_read" on public.open_demands;
create policy "demands_pro_read" on public.open_demands for select
  using (public.current_role() in ('professional', 'admin'));

grant select on public.open_demands to authenticated;

drop policy if exists "bookings_pro_view" on public.bookings;
create policy "bookings_pro_view" on public.bookings for select
  using (auth.uid() = professional_id);

-- Realtime: the pro's live demand feed subscribes to open_demands now.
do $$
begin
  alter publication supabase_realtime add table public.open_demands;
exception
  when duplicate_object then null;
end $$;

-- ── Verify: pros can no longer reach a street address pre-acceptance ────────
select
  (select count(*) from public.open_demands)                                  as demands_published,
  (select count(*) from public.open_demands where area_label is null)         as without_area_label,
  (select count(*) from public.bookings where status::text = 'open')          as open_bookings;
