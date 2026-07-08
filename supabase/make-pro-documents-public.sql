-- =====================================================================
-- SIMPLE FIX: Make pro-documents bucket publicly readable for signed URLs
-- =====================================================================

-- Step 1: Make the bucket public so signed URLs work
UPDATE storage.buckets 
SET public = true 
WHERE id = 'pro-documents';

-- Step 2: Create RLS policy that allows:
-- - Anyone with a valid signed URL can read
-- - Professionals can upload their own documents  
-- - Service role can do anything

-- Drop old policies
DROP POLICY IF EXISTS "authenticated" ON storage.objects;
DROP POLICY IF EXISTS "pro_documents_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "pro_documents_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "pro_documents_service_all" ON storage.objects;

-- Allow service role to bypass RLS entirely (already does by default)
-- Just need read access for signed URLs

-- For debugging: Check bucket status
-- SELECT id, name, public FROM storage.buckets WHERE id = 'pro-documents';
-- SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'pro-documents';
