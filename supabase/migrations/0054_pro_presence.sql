-- ============================================================================
-- CareLink — tell the patient who is ACTUALLY online.
-- Run once in Supabase → SQL Editor. Idempotent. Moves no money.
--
-- WHAT WAS WRONG
--   `v_pros_public` exposes `is_available` but does not filter on it, and
--   `geo.findNearbyProsForMap()` never filtered on it either. So the patient's
--   map plotted every approved professional who had ever recorded a position,
--   online or not. Reported from the field as "even if the pro is not online,
--   he shows as online on the map".
--
--   Two things made that worse than a missing WHERE clause:
--     • `professionals.is_available` DEFAULTS TO TRUE. A pro was "online" from
--       the moment an admin approved them, without ever touching the switch,
--       and at whatever stale position they last had.
--     • Nothing ever expires it. Toggle online once, kill the app, and you are
--       online forever — to the patient's map, to `countAvailableForSpecialty`
--       (the gate on posting a request at all), to `find_pros_within`, and to
--       urgent auto-dispatch, which will hand a live emergency to a phone that
--       has been in a drawer since Tuesday.
--
-- TWO DIFFERENT QUESTIONS, DELIBERATELY KEPT APART
--   `is_available` — the professional's own switch. "I am working today."
--     This is what decides who may receive demands. It must NOT depend on the
--     app being open: pros are reached by push notification, so requiring a
--     foreground app to stay reachable would empty the marketplace.
--
--   `is_online`    — available AND seen recently AND has a position.
--     This is what the patient's map shows. A green dot is a promise about
--     right now, so it is allowed to be strict where availability is not.
--
--   The presence window is generous (30 min) precisely because the heartbeat
--   only ticks while the pro has the app open. It is sized to catch "toggled
--   on last week and never came back", not to police whether someone is
--   staring at their screen.
-- ============================================================================

-- ── Presence column ─────────────────────────────────────────────────────────
alter table public.professionals
  add column if not exists last_seen_at timestamptz;

-- Existing rows have never heartbeaten. `updated_at` is the closest honest
-- proxy for "when did this account last do anything".
update public.professionals
   set last_seen_at = coalesce(last_seen_at, updated_at, now() - interval '30 days')
 where last_seen_at is null;

create index if not exists idx_pros_presence
  on public.professionals (is_available, last_seen_at);

-- ── Availability is opt-in, not a side effect of being approved ─────────────
alter table public.professionals
  alter column is_available set default false;

-- ── Heartbeat ───────────────────────────────────────────────────────────────
-- Called by the pro portal every couple of minutes while it is open. Stamps
-- presence and nothing else: no location, no availability change. A pro who is
-- deliberately offline still heartbeats, and still does not appear anywhere —
-- `is_online` requires both.
create or replace function public.pro_heartbeat()
returns void
language sql
security definer
set search_path = public as $$
  update public.professionals
     set last_seen_at = now()
   where id = auth.uid();
$$;

revoke all on function public.pro_heartbeat() from public, anon;
grant execute on function public.pro_heartbeat() to authenticated;

-- A position refresh is itself proof of life, so it stamps presence too. This
-- is what keeps a pro visible while they are driving with the map open.
create or replace function public.set_pro_location(p_id uuid, p_lat double precision, p_lng double precision)
returns void language sql security definer
set search_path = public as $$
  update public.professionals
     set location     = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
         last_seen_at = now()
   where id = p_id;
$$;

-- ── The view the patient reads ──────────────────────────────────────────────
-- Rows are NOT filtered out: `geo.getProCoords()` looks up the matched
-- professional here during a live trip, and that must keep working whether or
-- not they are still accepting new work. The view answers the question; the
-- caller decides what to do with the answer.
create or replace view public.v_pros_public as
select
  p.id, p.full_name, p.avatar_url, p.city, p.phone,
  pr.specialty, pr.bio, pr.hourly_rate_mad, pr.rating_avg, pr.rating_count,
  pr.total_bookings, pr.years_experience, pr.is_available,
  st_y(pr.location::geometry) as lat,
  st_x(pr.location::geometry) as lng,
  pr.last_seen_at,
  (
    pr.is_available
    and pr.location is not null
    and pr.last_seen_at is not null
    and pr.last_seen_at > now() - interval '30 minutes'
  ) as is_online
from public.profiles p
join public.professionals pr on pr.id = p.id
where pr.verification_status = 'approved';

-- ── Abandoned accounts stop counting as available ───────────────────────────
-- 24 hours, not 30 minutes: this is about the switch, not about presence. A pro
-- who has not opened the app in a day is not "working today" in any sense the
-- patient would recognise, and leaving them available is what lets an urgent
-- dispatch land on a dormant phone.
create or replace function public.expire_dormant_pro_availability(p_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare v_count integer;
begin
  update public.professionals
     set is_available = false,
         updated_at   = now()
   where is_available
     and coalesce(last_seen_at, updated_at) < now() - make_interval(hours => p_hours);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.expire_dormant_pro_availability(integer) from public, anon;

create extension if not exists pg_cron with schema extensions;

do $$
begin
  perform cron.unschedule('expire-dormant-pro-availability');
exception when others then null;  -- not scheduled yet
end $$;

select cron.schedule(
  'expire-dormant-pro-availability',
  '*/15 * * * *',
  $$ select public.expire_dormant_pro_availability(24); $$
);

-- Clear the existing backlog of "online since whenever" accounts.
select public.expire_dormant_pro_availability(24) as switched_offline_now;

-- ── Verify ──────────────────────────────────────────────────────────────────
select
  (select count(*) from public.v_pros_public)                                    as approved_pros,
  (select count(*) from public.v_pros_public where is_available)                 as marked_available,
  (select count(*) from public.v_pros_public where is_online)                    as online_right_now,
  (select count(*) from public.v_pros_public where is_available and lat is null) as available_without_position,
  (select jobname from cron.job where jobname = 'expire-dormant-pro-availability') as cron_job_ok;
