# FIX: Documents not showing in admin panel

## Root Cause
The RLS policy on `pro_documents` table used `public.current_role()` which doesn't exist:
```sql
create policy "prodocs_owner" on public.pro_documents for all 
  using (auth.uid() = professional_id or public.current_role() = 'admin');
```

This causes:
- ❌ **INSERT fails silently** during pro signup (documents never recorded)
- ❌ **SELECT fails** when admin tries to fetch documents

## Solution
Run this SQL in Supabase Dashboard > SQL Editor:

```bash
cat supabase/fix-pro-documents-rls.sql | copy
# Then paste and execute in SQL Editor
```

What it does:
- ✅ Fixes INSERT: Professionals can insert their own documents during signup
- ✅ Fixes SELECT: Professionals can view their own documents
- ✅ Keeps admin access via service_role (Edge Functions)

## Steps to Verify
1. Run the SQL fix above
2. Refresh admin panel > Developer Console (F12)
3. Look for console logs starting with `[KycModerationQueue]`
4. You should see:
   - `Found X pending professionals`
   - `Documents for [pro_id]: [...]` with actual documents

4. If documents still empty, the signup insert was blocked before. Have users retry registration.

## Testing
- New pro signup → uploads should succeed now
- Check mobile console: `✅ Recorded diploma in pro_documents` etc
- Admin panel → Documents should appear
