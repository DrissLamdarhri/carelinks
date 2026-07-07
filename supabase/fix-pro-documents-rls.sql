-- =====================================================================
-- pro_documents RLS — owner full access, admin read (KYC review), service role.
-- Postgres policies are ONE command each (or `for all`) — you cannot write
-- `for select, update, delete`. Run once in Supabase → SQL Editor. Idempotent.
-- =====================================================================

alter table public.pro_documents enable row level security;

-- Clean up any earlier / broken policies
drop policy if exists "prodocs_owner"                        on public.pro_documents;
drop policy if exists "prodocs_user_insert_select"           on public.pro_documents;
drop policy if exists "prodocs_user_select_update_delete"    on public.pro_documents;
drop policy if exists "prodocs_owner_all"                    on public.pro_documents;
drop policy if exists "prodocs_admin_read"                   on public.pro_documents;
drop policy if exists "prodocs_service_role_all"             on public.pro_documents;

-- 1. Owner: full access to their own documents (insert / select / update / delete)
create policy "prodocs_owner_all"
on public.pro_documents
for all to authenticated
using (auth.uid() = professional_id)
with check (auth.uid() = professional_id);

-- 2. Admins: read every document (for KYC review in /admin/kyc)
create policy "prodocs_admin_read"
on public.pro_documents
for select to authenticated
using (public.current_role() = 'admin');

-- 3. Service role (Edge Functions) bypasses RLS
create policy "prodocs_service_role_all"
on public.pro_documents
for all to service_role
using (true)
with check (true);
