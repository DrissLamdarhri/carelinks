-- ============================================================================
-- CareLink — expire stale demands so the app never shows dead content.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- Problem: a patient request stays `open` forever if nobody accepts it. The pro
-- feed filled up with weeks-old demands (25 in one screenshot) that no longer
-- reflect a real need — bad for the pro experience and misleading for the client.
--
-- The app already only *shows* open demands from the last 24h; this closes the
-- loop on the data itself so the table doesn't accumulate dead rows.
--
-- Note: cancel_case is deliberately left NULL so the existing capture_on_complete
-- trigger performs its standard full refund of any escrow hold (an unaccepted
-- request is RULE #1 — nothing was owed to anyone).
-- ============================================================================

create index if not exists idx_bookings_open_created
  on public.bookings (status, created_at desc);

create or replace function public.expire_stale_open_bookings(p_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = public as $$
declare
  v_count integer;
begin
  update public.bookings
     set status        = 'cancelled',
         cancelled_at  = now(),
         cancelled_by  = 'system',
         cancel_reason = 'expired_no_offer',
         updated_at    = now()
   where status = 'open'
     and created_at < now() - make_interval(hours => p_hours);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.expire_stale_open_bookings(integer) to authenticated;

-- Sweep the existing backlog once now.
select public.expire_stale_open_bookings(24) as expired_now;
