-- ============================================================================
-- CareLink — make remaining-seats sync in real time for every patient
-- watching the catalog, not just the one who just enrolled.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- WHY: the catalog's realtime subscription (useYogaCatalog) listens on both
-- yoga_sessions AND yoga_enrollments — but Supabase Realtime filters
-- postgres_changes events through RLS for the subscribing user. yoga_enrollments'
-- RLS only lets a patient see their OWN row (correctly — nobody else should
-- see who's enrolled in a class). That means when patient B enrolls, patient
-- A's realtime subscription never receives that INSERT event at all — RLS
-- silently drops it before delivery — so A's "places restantes" count never
-- updates until they manually leave and reopen the screen.
--
-- FIX: stop deriving the remaining-seats count from a live COUNT(*) over a
-- privacy-restricted table. Instead, denormalize it onto yoga_sessions.
-- enrolled_count (aggregate only — no identity, so no privacy concern),
-- maintained by a trigger, the same pattern this project already uses for
-- professionals.rating_avg/rating_count (0001_schema.sql). yoga_sessions is
-- publicly readable (`yoga_read: using (true)`), so its realtime UPDATE
-- events reach every subscribed client regardless of who they are — the
-- catalog's EXISTING yoga_sessions subscription starts working correctly
-- for this the moment the app reads enrolled_count instead of counting rows.
-- ============================================================================

alter table public.yoga_sessions
  add column if not exists enrolled_count integer not null default 0;

-- Backfill from the real current state.
update public.yoga_sessions s
   set enrolled_count = coalesce((select count(*) from public.yoga_enrollments e where e.session_id = s.id), 0);

create or replace function public.sync_yoga_enrolled_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.yoga_sessions set enrolled_count = enrolled_count + 1 where id = new.session_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.yoga_sessions set enrolled_count = greatest(0, enrolled_count - 1) where id = old.session_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists trg_yoga_enrolled_count on public.yoga_enrollments;
create trigger trg_yoga_enrolled_count
  after insert or delete on public.yoga_enrollments
  for each row execute function public.sync_yoga_enrolled_count();

-- ── Sanity ───────────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.columns
    where table_name = 'yoga_sessions' and column_name = 'enrolled_count') as count_col_ok,
  (select count(*) from pg_trigger where tgname = 'trg_yoga_enrolled_count') as trigger_ok,
  (select count(*) from public.yoga_sessions where enrolled_count <> (
     select count(*) from public.yoga_enrollments e where e.session_id = yoga_sessions.id
   )) as mismatched_rows_should_be_0;
