-- =====================================================================
-- Storage RLS for the pro-documents bucket (sensitive ID docs — kept private).
-- Pros access only their own folder; admins can read all; service role reads all.
-- Run once in Supabase → SQL Editor. Idempotent.
-- =====================================================================

-- Clean up any earlier policies (idempotent)
drop policy if exists "pros own files"        on storage.objects;
drop policy if exists "admins view all pro docs" on storage.objects;
drop policy if exists "pros download own docs" on storage.objects;
drop policy if exists "pro_docs_admin_read"   on storage.objects;
drop policy if exists "service_role_admin"    on storage.objects;

-- 1. Professionals: full access to their OWN folder ({uid}/...)
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

-- 2. Admins: read every document in the bucket (KYC review)
create policy "pro_docs_admin_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'pro-documents'
  and public.current_role() = 'admin'
);

-- 3. Service role (Edge Functions): read all (signed-URL generation)
create policy "service_role_admin"
on storage.objects for select to service_role
using (bucket_id = 'pro-documents');
