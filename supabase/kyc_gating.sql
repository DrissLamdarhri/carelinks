-- ============================================================================
-- CareLink — KYC gating: only APPROVED professionals can place bids.
-- Run once in Supabase → SQL Editor. Idempotent.
-- (The map already hides unapproved pros via v_pros_public. This closes the
--  remaining hole: bids_pro_write only checked ownership, not approval.)
-- ============================================================================

-- Helper: is this professional approved? SECURITY DEFINER so the RLS check
-- doesn't depend on the caller being able to read the professionals row.
create or replace function public.is_approved_pro(p_uid uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.professionals
    where id = p_uid and verification_status = 'approved'
  );
$$;

-- Tighten bid writes: must own the bid AND be an approved pro.
drop policy if exists "bids_pro_write" on public.bids;
create policy "bids_pro_write" on public.bids for all
  using (auth.uid() = professional_id)
  with check (auth.uid() = professional_id and public.is_approved_pro(auth.uid()));

-- Sanity
select
  (select 1 from pg_proc where proname = 'is_approved_pro')                         as helper_ok,
  (select 1 from pg_policies where tablename = 'bids' and policyname = 'bids_pro_write') as policy_ok;
