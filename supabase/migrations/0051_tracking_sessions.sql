-- ============================================================================
-- CareLink — live tracking sessions (Phase 1 of the tracking redesign)
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- WHY THIS EXISTS
--   Live tracking had no server-side notion of a "session". It existed because
--   a React screen was mounted and a Realtime channel happened to be joined.
--   That made every lifecycle guarantee a client-side promise:
--     • nothing stopped a client broadcasting before the nurse had left;
--     • nothing stopped it broadcasting after the visit ended;
--     • nothing tied "who may watch" to "who is on this booking".
--
--   A tracking session is now a row, driven by triggers on `bookings`. The
--   client cannot create one, extend one, or keep one alive. Companion
--   migration 0052 points Realtime Authorization at this table so the database
--   — not the app — decides who may join a tracking channel.
--
-- LIFECYCLE (mirrors booking_status; the client never writes these)
--   matched                → session 'pending'  (channels open, chat, ETA context)
--                                                NO GPS may flow yet
--   en_route               → session 'active'   (GPS broadcasting permitted)
--   in_progress            → session 'ended'    (reason 'arrived')
--   completed              → session 'ended'    (reason 'completed')
--   cancelled              → session 'ended'    (reason 'cancelled')
--   stale (sweep)          → session 'ended'    (reason 'expired')
--
-- PATIENT LIVE-LOCATION SHARING (opt-in, temporary, revocable)
--   By default the nurse sees only the booking destination — never the
--   patient's live GPS. When the nurse is close, the patient MAY grant a
--   short-lived share (apartment blocks, gated communities, hospital campuses,
--   patient waiting outside). The grant is a server record with a hard expiry;
--   0052 makes the nurse's ability to subscribe depend on it.
-- ============================================================================

-- ── Table ───────────────────────────────────────────────────────────────────
create table if not exists public.tracking_sessions (
  id                        uuid primary key default gen_random_uuid(),
  booking_id                uuid not null unique
                              references public.bookings(id) on delete cascade,
  -- Same parents as bookings.patient_id / bookings.professional_id. These ids
  -- ARE auth user ids (patients.id → profiles.id → auth.users.id), which is why
  -- `auth.uid() = patient_id` works, but the FK must point at the domain tables
  -- so cascades behave the same way they do for every other booking-scoped row.
  patient_id                uuid not null references public.patients(id) on delete cascade,
  pro_id                    uuid not null references public.professionals(id) on delete cascade,

  -- 'pending' = accepted, channels open, GPS forbidden
  -- 'active'  = nurse en route, GPS permitted
  -- 'ended'   = terminal, nothing may flow ever again
  status                    text not null default 'pending'
                              check (status in ('pending', 'active', 'ended')),

  created_at                timestamptz not null default now(),
  gps_started_at            timestamptz,
  ended_at                  timestamptz,
  end_reason                text check (end_reason in
                              ('arrived', 'completed', 'cancelled', 'expired')),

  -- Last known professional position. Deliberately a MUTABLE single row, not an
  -- append-only ping log: at ~1.5s per fix, thousands of concurrent sessions
  -- would mean hundreds of inserts/second forever. Realtime broadcast carries
  -- the live stream (it never touches Postgres); this row exists only so a
  -- patient opening the app cold sees the nurse immediately instead of a blank
  -- map. Written at most every ~15s by update_tracking_position().
  last_lat                  double precision,
  last_lng                  double precision,
  last_heading              double precision,
  last_speed                double precision,
  -- Monotonic per-session counter. Lets receivers drop out-of-order arrivals
  -- instead of letting the marker jump backwards on a late packet.
  last_seq                  bigint not null default 0,
  last_at                   timestamptz,

  -- Patient → nurse live share (opt-in). Active iff granted, unexpired,
  -- un-revoked. Never set by a trigger: only the patient's explicit consent.
  patient_share_granted_at  timestamptz,
  patient_share_expires_at  timestamptz,
  patient_share_revoked_at  timestamptz,
  -- Set when the patient declines, so we never nag them again this trip.
  patient_share_declined_at timestamptz
);

comment on table public.tracking_sessions is
  'Server-owned lifecycle for a live tracking session. Drives Realtime Authorization (see 0052). Clients may read their own row but never write it.';

create index if not exists idx_tracking_sessions_booking on public.tracking_sessions (booking_id);
create index if not exists idx_tracking_sessions_patient on public.tracking_sessions (patient_id) where status <> 'ended';
create index if not exists idx_tracking_sessions_pro     on public.tracking_sessions (pro_id)     where status <> 'ended';
-- Supports the staleness sweep without scanning ended sessions.
create index if not exists idx_tracking_sessions_open    on public.tracking_sessions (created_at) where status <> 'ended';

-- ── Predicate helpers ───────────────────────────────────────────────────────
-- Kept as functions so 0052's Realtime policies and the table policies below
-- share ONE definition of "may this person see this stream". Duplicating that
-- rule in two places is how authorization drifts.

-- STABLE, never IMMUTABLE: this reads now(). Marking a now()-dependent function
-- IMMUTABLE lets the planner constant-fold it, so an expired share could keep
-- evaluating as active for the life of a plan — silently defeating the automatic
-- expiry this whole feature depends on.
create or replace function public.tracking_share_active(s public.tracking_sessions)
returns boolean
language sql
stable
as $$
  select s.patient_share_granted_at is not null
     and s.patient_share_revoked_at is null
     and s.patient_share_expires_at is not null
     and s.patient_share_expires_at > now();
$$;

comment on function public.tracking_share_active is
  'True while the patient''s opt-in live-location share is granted, un-revoked and unexpired.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.tracking_sessions enable row level security;

-- Read: only the two parties to the visit. Admins keep their existing override
-- so support can investigate an incident.
drop policy if exists "tracking_sessions_parties_read" on public.tracking_sessions;
create policy "tracking_sessions_parties_read"
  on public.tracking_sessions for select
  using (auth.uid() = patient_id or auth.uid() = pro_id);

drop policy if exists "tracking_sessions_admin" on public.tracking_sessions;
create policy "tracking_sessions_admin"
  on public.tracking_sessions for select
  using (public.current_role() = 'admin');

-- NO insert/update/delete policy for anyone. Every write goes through the
-- security-definer functions below, which enforce the state machine. A client
-- with a stolen anon key still cannot open, extend, or resurrect a session.

-- ── Lifecycle triggers on bookings ──────────────────────────────────────────
create or replace function public.sync_tracking_session()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  -- Nothing actually changed (an UPDATE that merely mentions these columns
  -- still fires an `update of` trigger) — do not churn session state.
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.professional_id is not distinct from old.professional_id then
    return new;
  end if;

  -- Accepted → open a session (channels + chat + ETA context, but no GPS).
  if new.status = 'matched' and new.professional_id is not null then
    insert into public.tracking_sessions (booking_id, patient_id, pro_id, status)
    values (new.id, new.patient_id, new.professional_id, 'pending')
    on conflict (booking_id) do update
      -- Reaching `matched` means a live engagement, so a session must exist and
      -- be open — including after an 'expired' sweep, which otherwise left a
      -- booking permanently untrackable.
      set pro_id     = excluded.pro_id,
          status     = 'pending',
          ended_at   = null,
          end_reason = null,
          gps_started_at = null,
          -- CRITICAL: a consent given to the previous professional must never
          -- carry over to a new one. Re-matching wipes the share outright; the
          -- patient consents again, to this nurse, or not at all.
          patient_share_granted_at  = null,
          patient_share_expires_at  = null,
          patient_share_revoked_at  = null,
          patient_share_declined_at = null;

  -- Nurse pressed "Je pars" → GPS is now permitted. This is the ONLY place
  -- that flips a session to 'active'.
  elsif new.status = 'en_route' then
    update public.tracking_sessions
       set status = 'active',
           gps_started_at = coalesce(gps_started_at, now())
     where booking_id = new.id
       and status = 'pending';

  -- Arrival / terminal states → close permanently and kill any patient share.
  elsif new.status in ('in_progress', 'completed', 'cancelled') then
    update public.tracking_sessions
       set status = 'ended',
           ended_at = coalesce(ended_at, now()),
           end_reason = coalesce(end_reason, case new.status
                                   when 'in_progress' then 'arrived'
                                   when 'completed'   then 'completed'
                                   else 'cancelled' end),
           patient_share_revoked_at = coalesce(patient_share_revoked_at, now())
     where booking_id = new.id
       and status <> 'ended';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_tracking_session on public.bookings;
create trigger trg_sync_tracking_session
after insert or update of status, professional_id on public.bookings
for each row execute function public.sync_tracking_session();

-- ── Position write (throttled, called by the nurse's device) ────────────────
create or replace function public.update_tracking_position(
  b_id      uuid,
  p_lat     double precision,
  p_lng     double precision,
  p_heading double precision default null,
  p_speed   double precision default null,
  p_seq     bigint default null
)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  -- A no-match is a silent no-op, deliberately: a fix landing a moment after
  -- the visit ends is normal (the GPS service stops asynchronously), and
  -- raising would surface a scary failure to a nurse who did nothing wrong.
  -- The WHERE clause is the security boundary — caller-supplied identity is
  -- never trusted, only auth.uid().
  update public.tracking_sessions
     set last_lat     = p_lat,
         last_lng     = p_lng,
         last_heading = p_heading,
         last_speed   = p_speed,
         last_seq     = greatest(last_seq, coalesce(p_seq, last_seq + 1)),
         last_at      = now()
   where booking_id = b_id
     and pro_id = auth.uid()      -- only the assigned professional
     and status = 'active';       -- and only while genuinely en route
end;
$$;

-- ── Patient live-location share: grant / revoke / decline ───────────────────
create or replace function public.grant_patient_live_share(
  b_id uuid,
  p_minutes integer default 30
)
returns public.tracking_sessions
language plpgsql
security definer
set search_path = public as $$
declare
  v_row public.tracking_sessions;
begin
  -- Clamp: a share is a convenience for the last few hundred metres, not an
  -- open-ended license to follow someone. Even a buggy client cannot ask for
  -- more than an hour.
  p_minutes := least(greatest(coalesce(p_minutes, 30), 1), 60);

  update public.tracking_sessions
     set patient_share_granted_at = now(),
         patient_share_expires_at = now() + make_interval(mins => p_minutes),
         patient_share_revoked_at = null
   where booking_id = b_id
     and patient_id = auth.uid()   -- only the patient may consent, for themselves
     and status = 'active'         -- and only during a live trip
   returning * into v_row;

  if v_row.id is null then
    raise exception 'no active tracking session for this booking'
      using errcode = 'check_violation';
  end if;
  return v_row;
end;
$$;

create or replace function public.revoke_patient_live_share(b_id uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  update public.tracking_sessions
     set patient_share_revoked_at = now()
   where booking_id = b_id
     and patient_id = auth.uid();
end;
$$;

-- Records a refusal so the prompt is never shown twice in one trip. Nagging a
-- patient for their location is how an app loses trust.
create or replace function public.decline_patient_live_share(b_id uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  update public.tracking_sessions
     set patient_share_declined_at = now()
   where booking_id = b_id
     and patient_id = auth.uid();
end;
$$;

-- ── Safety net: nothing may stay open forever ───────────────────────────────
-- Triggers close sessions on every legitimate transition. This exists for the
-- paths that bypass them: a crashed job, a booking row deleted oddly, a status
-- left dangling. A tracking session that outlives its visit is a privacy leak
-- with a timer on it, so there is a hard backstop.
create or replace function public.expire_stale_tracking_sessions(
  p_max_hours integer default 12
)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  v_count integer;
begin
  update public.tracking_sessions
     set status = 'ended',
         ended_at = now(),
         end_reason = 'expired',
         patient_share_revoked_at = coalesce(patient_share_revoked_at, now())
   where status <> 'ended'
     and created_at < now() - make_interval(hours => p_max_hours);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Deny by default, allow on purpose. TWO separate grants have to be stripped:
--
--   1. Postgres implicitly grants EXECUTE on every new function to PUBLIC.
--   2. Supabase additionally carries a default-privileges rule on this schema
--      that grants EXECUTE on new functions DIRECTLY to `anon` (and
--      `authenticated`, `service_role`). `REVOKE ... FROM PUBLIC` does NOT
--      remove a direct grant, so revoking only from PUBLIC leaves `anon` — an
--      unauthenticated caller holding the bundled anon key — able to invoke
--      every RPC here. The Phase 1 verification suite caught exactly this.
--
-- The calls would all no-op (auth.uid() is null, and every WHERE clause
-- requires it to match a real party), but that is defence by accident. An
-- unauthenticated role should not hold execute rights on a consent RPC at all.
revoke execute on function public.tracking_share_active(public.tracking_sessions) from public, anon;
revoke execute on function public.update_tracking_position(uuid, double precision, double precision, double precision, double precision, bigint) from public, anon;
revoke execute on function public.grant_patient_live_share(uuid, integer)  from public, anon;
revoke execute on function public.revoke_patient_live_share(uuid)          from public, anon;
revoke execute on function public.decline_patient_live_share(uuid)         from public, anon;
-- Infrastructure only: pg_cron / service_role. No app role, authenticated or not.
revoke execute on function public.expire_stale_tracking_sessions(integer)  from public, anon, authenticated;

grant select on public.tracking_sessions to authenticated;
grant execute on function public.tracking_share_active(public.tracking_sessions) to authenticated;
grant execute on function public.update_tracking_position(uuid, double precision, double precision, double precision, double precision, bigint) to authenticated;
grant execute on function public.grant_patient_live_share(uuid, integer)  to authenticated;
grant execute on function public.revoke_patient_live_share(uuid)          to authenticated;
grant execute on function public.decline_patient_live_share(uuid)         to authenticated;
-- The sweep is infrastructure: pg_cron / service role only. No app role calls it.

-- Realtime: the nurse's client needs to learn the instant a patient grants or
-- revokes a share, and both sides need session status changes.
do $$ begin
  begin alter publication supabase_realtime add table public.tracking_sessions;
  exception when duplicate_object then null; end;
end $$;

-- ── Backfill: bookings already in flight when this shipped ──────────────────
insert into public.tracking_sessions (booking_id, patient_id, pro_id, status, gps_started_at)
select b.id, b.patient_id, b.professional_id,
       case when b.status = 'en_route' then 'active' else 'pending' end,
       case when b.status = 'en_route' then now() else null end
  from public.bookings b
 where b.professional_id is not null
   and b.status in ('matched', 'en_route')
on conflict (booking_id) do nothing;

-- ── Verification ────────────────────────────────────────────────────────────
select
  (select count(*) from public.tracking_sessions)                              as sessions_total,
  (select count(*) from public.tracking_sessions where status = 'active')      as sessions_active,
  (select count(*) from pg_trigger
    where tgname = 'trg_sync_tracking_session')                                as trigger_installed,
  (select count(*) from pg_policies
    where tablename = 'tracking_sessions')                                     as policies_installed;
