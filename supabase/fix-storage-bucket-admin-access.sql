-- =====================================================================
-- FIX: Allow admin users to access pro-documents bucket in Storage
-- =====================================================================

-- First, check current bucket status
-- SELECT id, name, public, created_at FROM storage.buckets WHERE id = 'pro-documents';

-- Drop existing overly-restrictive RLS policies on pro-documents bucket
DROP POLICY IF EXISTS "authenticated" ON storage.objects;
DROP POLICY IF EXISTS "pro_select_own_uploads" ON storage.objects;
DROP POLICY IF EXISTS "pro_update_own_uploads" ON storage.objects;
DROP POLICY IF EXISTS "admin_all_pro_documents" ON storage.objects;

-- Create new RLS policies for pro-documents bucket storage
-- Policy 1: Professionals can read/write only their own documents (path = professional_id/...)
CREATE POLICY "professionals_access_own_storage" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'pro-documents'
    AND (
      -- Professional accessing their own documents
      (auth.uid())::text = (string_to_array(name, '/'))[1]
      OR
      -- Admin accessing any documents
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'pro-documents'
    AND (auth.uid())::text = (string_to_array(name, '/'))[1]
  );

-- Policy 2: Service role (Edge Functions) can do everything
-- (Service role already bypasses RLS, but being explicit for clarity)
CREATE POLICY "service_role_all_storage" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'pro-documents'
    AND (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  );

-- Make sure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.objects TO service_role;
