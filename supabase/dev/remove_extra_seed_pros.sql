-- ============================================================================
-- CareLink — trim the seed professionals down to one per specialty.
--
--   seed_demo_pros.sql originally created 5 fake-but-real approved pros so the
--   booking map wasn't empty during early testing: 3 nurses (Fatima Zahra,
--   Youssef Bennani, Nadia El Amrani), 1 physiotherapist (Karim Mansour), 1
--   psychologist (Samira Rifai). Product owner request: keep just one per
--   service until real professionals sign up — 3 having nurses made the map
--   look artificially crowded/fake for the most-used service.
--
--   Kept:    Fatima Zahra (nurse), Karim Mansour (physio), Samira Rifai (psy)
--   Removed: Youssef Bennani, Nadia El Amrani (both nurse — the duplicates)
--
--   Deleting from auth.users cascades → public.profiles → public.professionals
--   → pro_services/pro_documents/bids/ratings (all "on delete cascade").
--   bookings.professional_id is "on delete set null" (0001_schema.sql), so any
--   real booking history involving these test accounts is preserved, just
--   loses the dangling pro reference — nothing else breaks.
--
-- Idempotent (safe to re-run; no-op once already removed).
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================================

delete from auth.users
where id in (
  'a1000000-0000-4000-8000-000000000004', -- Youssef Bennani (nurse, duplicate)
  'a1000000-0000-4000-8000-000000000005'  -- Nadia El Amrani (nurse, duplicate)
);

-- Verify only the 3 kept seed pros remain:
select id, full_name, specialty, verification_status
from public.v_pros_public
where id in (
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000005'
);
