## FIX: Admin cannot view pro documents

**Problem:** After professional signup, documents are uploaded to Storage and recorded in `pro_documents` table, but the admin dashboard cannot fetch signed URLs to view them.

**Root Cause:** The RLS policy on the `pro-documents` Storage bucket was too restrictive:
- It checked if `profiles.role = 'admin'` 
- But the admin user might not have `role = 'admin'` in the profiles table

**Solution:** 
1. Run the SQL fix to simplify Storage RLS policies:
   - **Professionals** can still only access their own files (folder-based path check)
   - **Service role** (used by Edge Functions) can read all files (auth already checked at function level)

2. Execute in Supabase SQL Editor:
   ```sql
   -- Copy and run supabase/fix-pro-documents-storage-rls.sql
   ```

3. The admin dashboard will then be able to:
   - Fetch the list of pending professionals with their documents (table-level RLS already allows this)
   - Generate signed URLs via the Edge Function to view documents
   - Approve/reject professionals

**After Fix:**
- Admin refresh the dashboard → Should see "Pending Pro" list
- Click on a pro → Click document links → Documents should open in new tab
- Approve/Reject buttons should work
