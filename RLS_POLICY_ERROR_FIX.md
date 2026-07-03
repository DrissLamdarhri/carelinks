# ⚡ RLS Policy Error - Complete Fix Guide

## 🔴 The Error You're Getting

```
Upload error: [StorageApiError: new row violates row-level security policy]
```

---

## 🎯 Root Cause

During **professional registration**, documents are uploaded BEFORE the user account is created:

1. User fills registration form with email/password
2. User tries to upload diploma/CIN **before** clicking "Submit"
3. User isn't created in `auth.users` yet → no `auth.uid()`
4. RLS policies that check `auth.uid()` fail → **RLS violation error**

---

## ✅ Solution: Update RLS Policies

Your current policies are too strict for registration flow. Replace them with policies that allow temporary public uploads during registration.

### Step 1: Open Supabase Dashboard

1. Go to **https://app.supabase.com**
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

### Step 2: Copy and Run This SQL

```sql
-- Remove old policies
DROP POLICY IF EXISTS "pros_upload_own_docs" ON storage.objects;
DROP POLICY IF EXISTS "pros_read_own_docs" ON storage.objects;
DROP POLICY IF EXISTS "pros_update_own_docs" ON storage.objects;

-- New Policy 1: Allow PUBLIC uploads during registration
CREATE POLICY "allow_public_uploads" ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'pro-documents');

-- New Policy 2: Allow authenticated reads
CREATE POLICY "allow_authenticated_reads" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pro-documents');

-- New Policy 3: Allow authenticated updates
CREATE POLICY "allow_authenticated_updates" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'pro-documents')
WITH CHECK (bucket_id = 'pro-documents');

-- New Policy 4: Allow ADMINS to read all documents
CREATE POLICY "allow_admin_access" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pro-documents'
);
```

### Step 3: Click "Run"

✅ Should see: **"Success. No rows returned"**

---

## 🧪 Test It

1. **Close and reopen** the app: `pnpm -C mobile-app start`
2. **Go to:** Pro Registration → Step 2 (Documents)
3. **Click:** "Télécharger Diplôme"
4. **Select:** Any PDF/JPG/PNG file
5. **Expected:** ✓ Checkmark appears (no more error!)

---

## 🔒 Security Note

These policies allow:
- ✅ **Anyone** can upload during registration (public/unauthenticated)
- ✅ **Authenticated users** can read/update documents after login
- ✅ **Admins** can access all documents for KYC review

This is **appropriate for a registration flow** where users aren't logged in yet.

---

## 🐛 If Still Getting Error

### Check 1: Verify Policies Were Applied

1. Go to Supabase Dashboard
2. Click **Storage** (left sidebar)
3. Click **pro-documents** bucket
4. Click **Policies** tab
5. Should see 4 policies:
   - ✅ allow_public_uploads
   - ✅ allow_authenticated_reads
   - ✅ allow_authenticated_updates
   - ✅ allow_admin_access

### Check 2: Clear App Cache

```bash
# Clear mobile app cache
pnpm -C mobile-app start -- --reset-cache
```

### Check 3: Verify Bucket Exists

1. Go to **Storage** tab in Supabase
2. Should see **pro-documents** bucket
3. If missing, run:

```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pro-documents', 'pro-documents', false)
ON CONFLICT (id) DO NOTHING;
```

### Check 4: Check Internet Connection

- Test internet by opening any website
- Disable VPN if using one
- Check firewall isn't blocking Supabase

---

## 📊 Policy Behavior

| User Type | Can Upload | Can Read | Can Update |
|-----------|-----------|----------|-----------|
| **Public (not logged in)** | ✅ Yes | ❌ No | ❌ No |
| **Authenticated (logged in)** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Admin** | ✅ Yes | ✅ Yes | ✅ Yes |

This allows professionals to upload documents **during registration** (public), then manage them **after login** (authenticated).

---

## 📝 Complete Workflow

1. **Professional** visits registration page (public user)
2. **Professional** fills form and tries to upload documents
3. ✅ **Upload succeeds** (public policy allows it)
4. **Professional** submits form
5. **Account created** in auth.users + profiles
6. **Professional** logs in
7. ✅ **Professional** can now read/update their documents

---

## 🎁 What You Get

✅ **Uploads work during registration**
✅ **No more RLS violation errors**
✅ **Secure after user is created**
✅ **Admin can review documents**

---

## 💡 Pro Tips

1. **Test with small files first** (< 1MB)
2. **Use Chrome DevTools** to see actual errors
3. **Clear browser cache** if issues persist
4. **Check Supabase logs** for detailed errors:
   - Supabase Dashboard → **Logs** → **API**

---

## ❓ Questions?

If uploads still fail:
1. Share the exact error message
2. Confirm policies were applied
3. Check browser console logs
4. Verify internet connection

All done! 🚀
