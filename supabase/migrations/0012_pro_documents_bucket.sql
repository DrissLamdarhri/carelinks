-- =====================================================================
-- CareLink — Create pro-documents storage bucket with admin access
-- Run in Supabase SQL Editor
-- =====================================================================

-- 1. Create the pro-documents bucket (non-public; only authenticated users can access)
insert into storage.buckets (id, name, public)
values ('pro-documents', 'pro-documents', false)
on conflict (id) do update
set public = excluded.public;

-- 2. RLS Policy: Professionals can access their own documents (upload, view, delete)
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

-- 3. RLS Policy: Admins can view all professional documents for KYC verification
drop policy if exists "admins view all pro docs" on storage.objects;
create policy "admins view all pro docs"
on storage.objects for select to authenticated
using (
  bucket_id = 'pro-documents'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

