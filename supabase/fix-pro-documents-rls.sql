-- =====================================================================
-- CRITICAL FIX: pro_documents RLS policy blocks inserts during signup
-- =====================================================================

-- Drop the broken policy that uses non-existent function
drop policy if exists "prodocs_owner" on public.pro_documents;

-- Create working policy:
-- 1. Authenticated user can INSERT/UPDATE/DELETE their own documents
-- 2. Service role (for backups/admin) can do anything
create policy "prodocs_user_insert_select"
on public.pro_documents
for insert to authenticated
with check (auth.uid() = professional_id);

create policy "prodocs_user_select_update_delete"
on public.pro_documents
for select, update, delete to authenticated
using (auth.uid() = professional_id);

-- Service role (Edge Functions with X-Admin-Key) can bypass RLS entirely
-- This is handled at the application level, so RLS just needs to not block service_role
create policy "prodocs_service_role_all"
on public.pro_documents
for all to service_role
using (true)
with check (true);

-- Enable RLS on the table
alter table public.pro_documents enable row level security;
