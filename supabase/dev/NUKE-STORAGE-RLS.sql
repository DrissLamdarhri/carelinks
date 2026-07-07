-- =====================================================================
-- FINAL FIX: Disable ALL RLS on pro-documents storage
-- Access control at application level (X-Admin-Key on Edge Function)
-- =====================================================================

-- Drop ALL policies
drop policy if exists "pros own files" on storage.objects;
drop policy if exists "admins view all pro docs" on storage.objects;
drop policy if exists "service_role_access" on storage.objects;
drop policy if exists "pros download own docs" on storage.objects;

-- Disable RLS entirely
alter table storage.objects disable row level security;
