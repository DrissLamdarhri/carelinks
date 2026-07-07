-- =====================================================================
-- NUCLEAR FIX: Disable RLS on pro_documents completely
-- Access control handled at Edge Function level (X-Admin-Key, auth token)
-- =====================================================================

-- Drop ALL policies on pro_documents
drop policy if exists "prodocs_owner" on public.pro_documents;
drop policy if exists "prodocs_user_insert_select" on public.pro_documents;
drop policy if exists "prodocs_user_select_update_delete" on public.pro_documents;
drop policy if exists "prodocs_service_role_all" on public.pro_documents;

-- DISABLE RLS entirely - access control at app level
alter table public.pro_documents disable row level security;
