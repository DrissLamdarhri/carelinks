-- =====================================================================
-- CareLink — Geolocation (Step 9)
-- Run AFTER schema.sql + triggers.sql in Supabase SQL Editor.
-- Adds PostGIS, geography columns on professionals + bookings, and an
-- RPC `find_pros_within(booking_id, radius_km)` used by the matching loop.
-- =====================================================================

create extension if not exists postgis;

-- ── Columns ───────────────────────────────────────────────────────────
alter table public.professionals
  add column if not exists location geography(Point, 4326),
  add column if not exists service_radius_km integer not null default 10;

alter table public.bookings
  add column if not exists location geography(Point, 4326);

create index if not exists idx_pros_location     on public.professionals using gist (location);
create index if not exists idx_bookings_location on public.bookings      using gist (location);

-- ── Helper: set location from lat/lng ─────────────────────────────────
create or replace function public.set_pro_location(p_id uuid, p_lat double precision, p_lng double precision)
returns void language sql security definer as $$
  update public.professionals
     set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
   where id = p_id;
$$;

create or replace function public.set_booking_location(b_id uuid, p_lat double precision, p_lng double precision)
returns void language sql security definer as $$
  update public.bookings
     set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
   where id = b_id;
$$;

-- ── RPC: find approved pros within radius of a booking ────────────────
-- Returns pros whose specialty matches the booking AND whose service_radius_km
-- covers the distance. Sorted by distance ascending.
create or replace function public.find_pros_within(p_booking_id uuid, p_radius_km integer default 15)
returns table (
  id uuid,
  full_name text,
  specialty pro_specialty,
  rating_avg numeric,
  distance_km double precision
)
language sql
security definer
as $$
  select pr.id,
         p.full_name,
         pr.specialty,
         pr.rating_avg,
         st_distance(pr.location, b.location) / 1000.0 as distance_km
    from public.bookings    b
    join public.professionals pr on pr.specialty = b.specialty
    join public.profiles    p   on p.id = pr.id
   where b.id = p_booking_id
     and pr.verification_status = 'approved'
     and pr.is_available = true
     and pr.location is not null
     and b.location  is not null
     and st_dwithin(pr.location, b.location, least(p_radius_km, pr.service_radius_km) * 1000)
   order by distance_km asc
   limit 50;
$$;

grant execute on function public.find_pros_within(uuid, integer) to authenticated;
grant execute on function public.set_pro_location(uuid, double precision, double precision) to authenticated;
grant execute on function public.set_booking_location(uuid, double precision, double precision) to authenticated;
