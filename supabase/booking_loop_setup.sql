-- ============================================================================
-- CareLink — Booking → Bid → Accept loop: complete backend setup.
-- Run ONCE in Supabase → SQL Editor. Fully idempotent (safe to re-run).
--
-- This guarantees every DB prerequisite the real reverse-bidding loop needs:
--   1. Realtime publication for bids/bookings/professionals (live updates).
--   2. REPLICA IDENTITY FULL so UPDATE/DELETE realtime events carry the full
--      row (needed for RLS filtering + reliable "match removes it" on the feed).
--   3. accept_bid() RPC — RLS-safe atomic accept + reject others + match.
-- After this + supabase/seed_demo_pros.sql, the loop is fully wired server-side.
-- ============================================================================

-- ── 1. Realtime publication (idempotent) ───────────────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table public.bids;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bookings;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.professionals; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
end $$;

-- ── 2. Full row images for reliable realtime UPDATE/DELETE under RLS ────────
alter table public.bids     replica identity full;
alter table public.bookings replica identity full;

-- ── 3. Atomic, RLS-safe accept ─────────────────────────────────────────────
drop function if exists public.accept_bid(uuid);

create or replace function public.accept_bid(p_bid_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid     public.bids;
  v_booking public.bookings;
begin
  select * into v_bid from public.bids where id = p_bid_id;
  if v_bid.id is null then
    raise exception 'Offre introuvable';
  end if;

  select * into v_booking from public.bookings where id = v_bid.booking_id;
  if v_booking.id is null then
    raise exception 'Réservation introuvable';
  end if;

  -- Only the booking's patient may accept.
  if v_booking.patient_id <> auth.uid() then
    raise exception 'Non autorisé';
  end if;

  -- Only an open booking can be matched (guards double-accept / races).
  if v_booking.status <> 'open' then
    raise exception 'Cette demande n''est plus ouverte';
  end if;

  update public.bids
     set status = 'accepted', responded_at = now()
   where id = p_bid_id;

  update public.bids
     set status = 'rejected', responded_at = now()
   where booking_id = v_bid.booking_id
     and id <> p_bid_id
     and status = 'pending';

  update public.bookings
     set status          = 'matched',
         professional_id = v_bid.professional_id,
         final_price_mad = v_bid.price_mad,
         updated_at      = now()
   where id = v_bid.booking_id
   returning * into v_booking;

  return v_booking;
end;
$$;

grant execute on function public.accept_bid(uuid) to authenticated;

-- ── 4. Tracking coords — booking destination + matched pro origin as lat/lng ─
-- The live-tracking screen needs plain lat/lng to draw the route + move the pro,
-- but both are stored as PostGIS geography. Expose them (participants only).
drop function if exists public.get_track_coords(uuid);
create or replace function public.get_track_coords(b_id uuid)
returns table(
  dest_lat double precision, dest_lng double precision,
  pro_lat  double precision, pro_lng  double precision,
  pro_name text, pro_avatar text
)
language sql stable security definer set search_path = public as $$
  select
    st_y(b.location::geometry),  st_x(b.location::geometry),
    st_y(pr.location::geometry), st_x(pr.location::geometry),
    pf.full_name, pf.avatar_url
  from public.bookings b
  left join public.professionals pr on pr.id = b.professional_id
  left join public.profiles pf     on pf.id = b.professional_id
  where b.id = b_id
    and (b.patient_id = auth.uid() or b.professional_id = auth.uid());
$$;

grant execute on function public.get_track_coords(uuid) to authenticated;

-- ── 5. Sanity check — confirm the pieces exist ─────────────────────────────
select
  (select count(*) from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename in ('bids','bookings')) as realtime_tables,
  (select 1 from pg_proc where proname = 'accept_bid')                         as accept_bid_fn,
  (select 1 from pg_proc where proname = 'get_track_coords')                   as track_coords_fn;
