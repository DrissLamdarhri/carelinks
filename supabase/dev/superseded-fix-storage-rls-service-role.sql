-- =====================================================================
-- Fix Storage RLS to allow service_role (Edge Functions) access
-- =====================================================================

-- Remove old restrictive admin policy
drop policy if exists "admins view all pro docs" on storage.objects;

-- Add service_role policy (for Edge Functions with X-Admin-Key)
create policy "service_role_access"
on storage.objects for all to service_role
using (bucket_id = 'pro-documents')
with check (bucket_id = 'pro-documents');

-- Keep professional ownership policy
drop policy if exists "pros own files" on storage.objects;
create policy "pros own files"
on storage.objects for all to authenticated
using (
  bucket_id = 'pro-documents' 
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'pro-documents' 
  and (storage.foldername(name))[1] = auth.uid()::text
);
