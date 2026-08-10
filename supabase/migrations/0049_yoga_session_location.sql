-- ============================================================================
-- CareLink — yoga sessions get a real geocoded location, not just free text.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- WHY: yoga_sessions.location (a PostGIS point) has existed since day one
-- (0001_schema.sql) but nothing ever set it — the admin creation form only
-- ever captured plain-text address/city. A yoga class is a real physical
-- place patients need to actually get to, same as a nurse home visit, so it
-- deserves the same map-based location handling the rest of the app already
-- gives every other physical location (set_booking_location, set_pro_location).
-- ============================================================================

create or replace function public.set_yoga_session_location(p_session_id uuid, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'admin' then
    raise exception 'Réservé aux administrateurs.';
  end if;
  update public.yoga_sessions
     set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
   where id = p_session_id;
end $$;

grant execute on function public.set_yoga_session_location(uuid, double precision, double precision) to authenticated;

-- Plain lat/lng read for the patient-facing map preview — mirrors how
-- get_track_coords already exposes a PostGIS point as consumable numbers.
create or replace function public.get_yoga_session_coords(p_session_id uuid)
returns table(lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select st_y(location::geometry), st_x(location::geometry)
    from public.yoga_sessions
   where id = p_session_id and location is not null;
$$;

grant execute on function public.get_yoga_session_coords(uuid) to authenticated;

-- ── Sanity ───────────────────────────────────────────────────────────────────
select
  (select count(*) from pg_proc where proname = 'set_yoga_session_location') as set_fn_ok,
  (select count(*) from pg_proc where proname = 'get_yoga_session_coords')   as get_fn_ok;
