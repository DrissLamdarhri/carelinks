-- ============================================================================
-- CareLink — redeploy get_track_coords(), missing on this live project.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- FOUND LIVE (31 Jul 2026, two real phones held side by side, neither
-- moving): the pro's navigation screen drew a route to a location nowhere
-- near either phone. Root cause, confirmed by calling the RPC directly —
-- public.get_track_coords does not exist on this project (schema cache
-- returns "Could not find the function"), even though it was defined back
-- in 0004_booking_loop.sql and accept_bid() from that same migration file
-- clearly IS live (bookings do get matched). Whatever happened, this one
-- function specifically never made it in (or was dropped since).
--
-- Without it, both tracking screens fall back to re-geocoding the booking's
-- plain-text `address` column — which can be as vague as "Fès" (just the
-- city). That's a wildly imprecise fallback for something whose whole job is
-- showing exactly where the patient is: the booking already has the real,
-- precise point (`bookings.location`, a PostGIS geography set at request
-- time by set_booking_location) — it just wasn't being read at all, because
-- this function is the only thing that turns it into plain lat/lng for a
-- participant to consume.
--
-- Identical definition to 0004 — this is a redeploy, not a redesign.
-- ============================================================================

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

-- ── Sanity ───────────────────────────────────────────────────────────────────
select (select 1 from pg_proc where proname = 'get_track_coords') as track_coords_fn_ok;
