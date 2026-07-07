-- =====================================================================
-- CareLink — Fix yoga_sessions table schema
-- Run in Supabase SQL Editor
-- =====================================================================

-- Add missing columns to yoga_sessions if they don't exist
ALTER TABLE public.yoga_sessions
ADD COLUMN IF NOT EXISTS level text DEFAULT 'Tous niveaux',
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS duration_min int DEFAULT 60,
ADD COLUMN IF NOT EXISTS capacity int DEFAULT 10,
ADD COLUMN IF NOT EXISTS price_mad numeric(10,2),
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS meeting_url text,
ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_yoga_upcoming ON public.yoga_sessions(starts_at);
CREATE INDEX IF NOT EXISTS idx_yoga_instructor ON public.yoga_sessions(instructor_id);

-- Verify the table structure
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'yoga_sessions' AND table_schema = 'public';
