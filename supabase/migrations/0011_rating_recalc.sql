-- ============================================================================
-- FIX — ratings weren't updating the pro's displayed score.
-- recalc_pro_rating() ran with the *patient's* privileges (it fires on the
-- patient's rating insert). RLS on professionals then blocked the UPDATE of the
-- pro's row, so rating_avg / rating_count never changed. Making it
-- SECURITY DEFINER lets the recompute update the pro row regardless of caller.
-- Run once in Supabase → SQL Editor. Idempotent (trigger already points here).
-- ============================================================================

create or replace function public.recalc_pro_rating()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  update public.professionals p set
    rating_avg   = coalesce((select avg(stars)::numeric(3,2) from public.ratings where professional_id = p.id), 0),
    rating_count = (select count(*) from public.ratings where professional_id = p.id)
  where p.id = coalesce(new.professional_id, old.professional_id);
  return null;
end $$;

select 'rating recompute is now SECURITY DEFINER' as result;
