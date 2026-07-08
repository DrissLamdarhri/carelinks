-- =====================================================================
-- CareLink — Complete Yoga Sessions Migration & Data Fix
-- Run this in Supabase SQL Editor to fix all yoga sessions
-- =====================================================================

-- STEP 1: Ensure all columns exist
ALTER TABLE public.yoga_sessions
ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Tous niveaux',
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS duration_min INT DEFAULT 60,
ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 10,
ADD COLUMN IF NOT EXISTS price_mad NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS meeting_url TEXT,
ADD COLUMN IF NOT EXISTS location GEOGRAPHY(Point, 4326);

-- STEP 2: Create indices for performance
CREATE INDEX IF NOT EXISTS idx_yoga_upcoming ON public.yoga_sessions(starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_yoga_instructor ON public.yoga_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_yoga_level ON public.yoga_sessions(level);

-- STEP 3: Verify structure
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'yoga_sessions' AND table_schema = 'public'
ORDER BY ordinal_position;

-- STEP 4: Check for any sessions and their current data
SELECT 
  id, 
  title, 
  level, 
  capacity, 
  price_mad,
  starts_at,
  SUBSTRING(address, 1, 50) as address_preview
FROM public.yoga_sessions
ORDER BY created_at DESC
LIMIT 10;
