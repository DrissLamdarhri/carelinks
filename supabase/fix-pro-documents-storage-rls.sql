-- =====================================================================
-- Fix: Allow admins to access pro-documents in Storage
-- Simplest solution: disable RLS (auth is already checked at Edge Function level)
-- =====================================================================

-- Remove all RLS policies from storage.objects for pro-documents bucket
drop policy if exists "pros own files" on storage.objects;
drop policy if exists "admins view all pro docs" on storage.objects;
drop policy if exists "pros download own docs" on storage.objects;

-- Replace with simple policies:
-- 1. Professionals can upload/view/delete their own documents
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

-- 2. Service role (Edge Functions with X-Admin-Key check) can do anything
-- This is handled at the Edge Function level, so we don't need RLS to block admins
-- The Edge Function verifies admin auth before calling supabaseAdmin().storage
-- So we just need to allow SELECT on all files for service role operations
create policy "service_role_admin"
on storage.objects for select to service_role
using (bucket_id = 'pro-documents');

