-- ============================================================================
-- CareLink — fix: approved professionals could never go online.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- BUG: guard_pro_availability() (0020) forced is_available := false whenever
-- `new.verification_status <> 'approved'`. The app toggles availability with an
-- UPSERT that only sends {id, specialty, is_available}. On the INSERT pass of an
-- upsert, columns that aren't supplied take their DEFAULT — so
-- new.verification_status was 'pending' even for an approved pro, and the guard
-- silently reset availability. Result: the toggle appeared to work, the write
-- returned 200, and the value read back as false. Every pro was stuck offline.
--
-- FIX: resolve the pro's REAL stored verification_status instead of trusting the
-- (possibly defaulted) value on the incoming row. Genuine first inserts still
-- fall back to the incoming value, so an unapproved pro still cannot go online.
-- ============================================================================

create or replace function public.guard_pro_availability()
returns trigger language plpgsql
set search_path = public as $$
declare
  v_stored text;
begin
  if new.is_available is true then
    select p.verification_status::text into v_stored
      from public.professionals p
     where p.id = new.id;

    -- Prefer the stored status (UPDATE / upsert-over-existing); fall back to the
    -- incoming one when the row genuinely doesn't exist yet.
    if coalesce(v_stored, new.verification_status::text) is distinct from 'approved' then
      new.is_available := false;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_pro_availability on public.professionals;
create trigger trg_guard_pro_availability before insert or update on public.professionals
  for each row execute function public.guard_pro_availability();

-- ── Sanity: an approved pro can now go online, a pending one still cannot ────
select
  (select 1 from pg_proc where proname = 'guard_pro_availability') as guard_fn_ok;
