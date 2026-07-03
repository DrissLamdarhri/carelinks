DROP POLICY IF EXISTS "allow_public_uploads" ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_reads" ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_updates" ON storage.objects;
DROP POLICY IF EXISTS "allow_admin_access" ON storage.objects;
DROP POLICY IF EXISTS "pros_upload_own_docs" ON storage.objects;
DROP POLICY IF EXISTS "pros_read_own_docs" ON storage.objects;
DROP POLICY IF EXISTS "pros_update_own_docs" ON storage.objects;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
