-- Debug query to test professionals data
-- Run this in Supabase SQL editor to check data

-- 1. Check if professionals exist
SELECT COUNT(*) as total_professionals FROM public.professionals;

-- 2. Check all professionals with their status
SELECT id, specialty, verification_status, created_at FROM public.professionals ORDER BY created_at DESC LIMIT 10;

-- 3. Check specific professional with profile join
SELECT 
  p.id,
  p.specialty,
  p.verification_status,
  pr.full_name,
  pr.email
FROM public.professionals p
LEFT JOIN public.profiles pr ON p.id = pr.id
LIMIT 5;

-- 4. Test the exact query the component uses
SELECT 
  p.id,
  p.specialty,
  p.verification_status,
  p.rejection_reason,
  p.verified_at,
  p.years_experience,
  p.rating_avg,
  p.rating_count,
  p.created_at,
  p.bio,
  json_build_object(
    'full_name', pr.full_name,
    'email', pr.email,
    'phone', pr.phone,
    'city', pr.city,
    'avatar_url', pr.avatar_url
  ) as profiles
FROM public.professionals p
LEFT JOIN public.profiles pr ON p.id = pr.id
ORDER BY p.created_at DESC;

-- 5. Check RLS - can admin see professionals?
-- (This should be run as admin user or in RLS bypass mode)
SELECT COUNT(*) FROM public.professionals WHERE public.current_role() = 'admin' OR auth.uid() = id OR verification_status = 'approved';

-- 6. Check if profiles table has data
SELECT COUNT(*) as total_profiles FROM public.profiles;

-- 7. Check for professionals without profile matches
SELECT p.id, p.specialty FROM public.professionals p
WHERE NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p.id);
