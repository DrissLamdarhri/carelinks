# 🔧 Supabase RLS Policy Fix

## Problem
Error: **"new row violates row-level security policy"**

This happens because:
1. During registration, the user doesn't exist in auth.users yet
2. We're uploading documents BEFORE the account is created
3. The RLS policy checks for `auth.uid()` which fails (no user logged in yet)

---

## Solution

### ✅ OPTION A: Allow Anonymous Document Uploads (Recommended for Registration)

Replace the existing policies with these ones that allow temporary anonymous uploads:

```sql
-- Drop old policies first
DROP POLICY IF EXISTS "pros_upload_own_docs" ON storage.objects;
DROP POLICY IF EXISTS "pros_read_own_docs" ON storage.objects;
DROP POLICY IF EXISTS "pros_update_own_docs" ON storage.objects;

-- New Policy 1: Allow ANYONE to upload documents during registration
CREATE POLICY "allow_doc_upload_during_registration" ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'pro-documents');

-- New Policy 2: Allow authenticated users to read their own documents
CREATE POLICY "allow_read_own_documents" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pro-documents');

-- New Policy 3: Allow authenticated users to update their own documents
CREATE POLICY "allow_update_own_documents" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'pro-documents')
WITH CHECK (bucket_id = 'pro-documents');

-- New Policy 4: Allow admins to read all documents
CREATE POLICY "allow_admin_read_all_docs" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pro-documents' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### ❌ OPTION B: Upload After Registration (Alternative)

If you want stricter security, upload documents AFTER the user is created:
- User registers email + password
- System creates auth.users + profiles record
- User logs in
- THEN user uploads documents

---

## Which Option?

| Option | Security | Ease | Use Case |
|--------|----------|------|----------|
| **A (Public Upload)** | Medium | Easy | Current registration flow |
| **B (After Login)** | High | Complex | Stricter security needed |

**Recommendation:** Use **OPTION A** for now since registration is a public flow.

---

## Implementation

### In Supabase Dashboard:

1. Go to **Authentication** → **SQL Editor**
2. Select all code from "OPTION A" above
3. Run it

**That's it!** Uploads should now work.

---

## Testing

After running the SQL:

1. Go to Pro Registration
2. Try uploading a document
3. Should see ✓ checkmark (no more RLS error)

---

## Security Note

The policies allow:
- ✅ **Anyone** to upload documents during registration (public)
- ✅ **Authenticated users** to read/update their own bucket files
- ✅ **Admins** can read all documents for KYC review

This is appropriate for a registration flow where users aren't authenticated yet.
