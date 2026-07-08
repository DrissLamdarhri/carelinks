-- Diagnostic: Admin User & Bookings RLS Check
-- Run this in Supabase SQL Editor to diagnose why admin can't see bookings

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Check if admin@carelink.ma exists in auth.users
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  id, 
  email, 
  created_at
FROM auth.users 
WHERE email = 'admin@carelink.ma'
LIMIT 1;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Check if admin user has a profile with role='admin'
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  id, 
  role, 
  full_name, 
  email, 
  created_at
FROM public.profiles 
WHERE email = 'admin@carelink.ma' OR role = 'admin'
LIMIT 10;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Count total bookings in the table (should be > 0 if bookings exist)
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_bookings,
  COUNT(CASE WHEN status = 'matched' THEN 1 END) as matched_bookings,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_bookings,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings
FROM public.bookings;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Check RLS policies on bookings table
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'bookings'
ORDER BY policyname;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Check if bookings table has RLS enabled
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'bookings' AND schemaname = 'public';

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Try to fetch bookings as a regular query (no RLS filters)
-- NOTE: This will show ALL bookings. Comment out LIMIT to see the structure.
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  id,
  patient_id,
  professional_id,
  specialty,
  status,
  urgency,
  scheduled_at,
  created_at
FROM public.bookings
ORDER BY created_at DESC
LIMIT 10;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Check booking triggers exist
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'bookings'
ORDER BY trigger_name;
