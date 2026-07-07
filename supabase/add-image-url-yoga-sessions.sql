-- =====================================================================
-- CareLink — Add image_url column to yoga_sessions if missing
-- Run in Supabase SQL Editor
-- =====================================================================

-- Add image_url column if it doesn't exist
ALTER TABLE public.yoga_sessions
ADD COLUMN IF NOT EXISTS image_url text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_yoga_sessions_created ON public.yoga_sessions(created_at DESC);
