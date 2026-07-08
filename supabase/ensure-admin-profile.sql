-- Migration: Ensure admin user profile exists with correct role
-- This ensures that admin@carelink.ma has role='admin' in profiles table
-- Run this if admin bookings are not visible in the admin panel (RLS issue)

-- First, find the auth.users ID for admin@carelink.ma
-- If it doesn't exist, you'll need to create it via Supabase Auth UI

-- Insert or update the admin profile with role='admin'
INSERT INTO public.profiles (
  id,
  role,
  full_name,
  email,
  created_at,
  updated_at
)
SELECT
  id,
  'admin'::user_role,
  'CareLink Admin',
  email,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'admin@carelink.ma'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin'::user_role,
  updated_at = NOW();

-- Verify the profile was created/updated
SELECT id, role, full_name, email FROM public.profiles
WHERE email = 'admin@carelink.ma';

-- If the above returns no rows, the auth.users entry doesn't exist.
-- Create it from Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Click "Add user"
-- 3. Email: admin@carelink.ma
-- 4. Password: CareLinkAdmin2024!
-- 5. Then run the INSERT statement again
