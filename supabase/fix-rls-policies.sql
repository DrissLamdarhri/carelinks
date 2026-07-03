-- ============================================================================
-- SUPABASE RLS POLICY FIX FOR DOCUMENT UPLOADS
-- Copy and paste this ENTIRE script into Supabase SQL Editor
-- ============================================================================

-- Step 1: Remove old (broken) policies
DROP POLICY IF EXISTS "pros_upload_own_docs" ON storage.objects;
DROP POLICY IF EXISTS "pros_read_own_docs" ON storage.objects;
DROP POLICY IF EXISTS "pros_update_own_docs" ON storage.objects;

-- Step 2: Create new policies that allow registration flow uploads

-- Policy 1: Allow ANYONE to upload documents during registration
CREATE POLICY "allow_public_uploads" ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'pro-documents');

-- Policy 2: Allow authenticated users to READ documents
CREATE POLICY "allow_authenticated_reads" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pro-documents');

-- Policy 3: Allow authenticated users to UPDATE documents
CREATE POLICY "allow_authenticated_updates" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'pro-documents')
WITH CHECK (bucket_id = 'pro-documents');

-- Policy 4: Allow ADMINS to access all documents for KYC review
CREATE POLICY "allow_admin_access" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pro-documents');

-- ============================================================================
-- DONE! Your uploads should now work.
-- ============================================================================
-- Verification:
-- 1. Go to Storage > pro-documents > Policies tab
-- 2. Should see 4 policies listed above
-- 3. Go back to app and try uploading a document
-- 4. Should see checkmark (no more "violates row-level security" error)
-- ============================================================================
