# 🔧 Document Upload Fix - Complete Guide

## Issues Fixed ✅

1. **"StorageUnknownError: Network request failed"** - Network connectivity issue
2. **"StorageApiError: Bucket not found"** - Incorrect bucket name

---

## Root Cause

The upload code was trying to upload to **`kyc-documents` bucket**, but your Supabase project has **`pro-documents` bucket**.

### Files Changed:
- `mobile-app/lib/hooks/useDocumentPicker.ts` - Now uses `pro-documents` bucket
- `mobile-app/lib/hooks/useCameraPicker.ts` - Now uses `pro-documents` bucket
- Both files now have **improved error messages** for better debugging

---

## Setup Requirements

### 1️⃣ Supabase Bucket Configuration

Ensure the bucket exists in your Supabase project:

```sql
-- Run in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pro-documents', 'pro-documents', false)
ON CONFLICT DO NOTHING;
```

### 2️⃣ Enable RLS Policies

Add these policies to allow professionals to upload their own documents:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "pros_upload_own_docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pro-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own files
CREATE POLICY "pros_update_own_docs" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'pro-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'pro-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own files
CREATE POLICY "pros_read_own_docs" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pro-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### 3️⃣ Environment Variables

Ensure your mobile app has the correct Supabase credentials in `.env` or `eas.json`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://wjhzrovmktekfcjohhrw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ACTUAL_ANON_KEY_HERE
```

Replace `YOUR_ACTUAL_ANON_KEY_HERE` with your actual Supabase anonymous public key from:
- **Supabase Dashboard** → **Settings** → **API** → **Anon/Public Key**

### 4️⃣ Network Connectivity

If you still see **"Network request failed"** errors:

1. **Check Internet Connection** - Ensure device has stable internet
2. **Check Firewall/VPN** - May block Supabase URLs
3. **Verify Supabase URL** - Should be `https://wjhzrovmktekfcjohhrw.supabase.co`
4. **Check CORS** - Supabase should allow your app origin

---

## How Document Upload Works Now

### When Professional Uploads Document:

1. **Select** document/photo from device
2. **Validate** file type (PDF, JPG, PNG) and size (< 5MB)
3. **Read** file as base64
4. **Convert** to bytes array
5. **Upload** to `pro-documents` bucket in folder: `{user_id}/{timestamp}-{filename}`
6. **Get** public URL for the document
7. **Store** URL in database

### Error Messages (Improved):

- **"Erreur réseau. Vérifiez votre connexion internet."** = Network issue
- **"Le bucket de stockage n'existe pas..."** = Bucket missing
- **"Erreur lors de l'upload du document."** = Generic error

---

## Testing

### ✅ Test Document Upload

1. Go to **Professional Registration** → **Step 2 (Documents)**
2. Click **"Télécharger Diplôme"**
3. Select a PDF, JPG, or PNG file (< 5MB)
4. Wait for upload to complete
5. Should see ✓ checkmark when done

### ✅ Test Selfie Upload

1. Click **"Prendre Selfie"**
2. Camera should open
3. Take photo
4. Should upload automatically
5. Should see ✓ checkmark when done

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Network request failed" | No internet or firewall blocks Supabase | Check connection, disable VPN |
| "Bucket not found" | Wrong bucket name or bucket doesn't exist | Use `pro-documents` bucket (case-sensitive) |
| "Permission denied" | RLS policies not set correctly | Run the SQL policies above |
| "File too large" | File exceeds 5MB limit | Use smaller file (compress image/PDF) |
| "Invalid file type" | Wrong file format | Use PDF, JPG, or PNG only |

---

## File Changes Summary

### `mobile-app/lib/hooks/useDocumentPicker.ts`
- ✅ Changed bucket from `kyc-documents` → `pro-documents` (line 68)
- ✅ Added network error detection
- ✅ Added bucket error detection
- ✅ Improved error messages

### `mobile-app/lib/hooks/useCameraPicker.ts`
- ✅ Changed bucket from `kyc-documents` → `pro-documents` (line 68)
- ✅ Added network error detection
- ✅ Added bucket error detection
- ✅ Improved error messages

### `mobile-app/app/auth/pro-registration.tsx`
- ✅ Fixed step validation for psychologists (don't require services)

---

## Next Steps

1. **Apply SQL fixes** in your Supabase dashboard
2. **Verify bucket exists** in Supabase Storage section
3. **Check environment variables** are set correctly
4. **Test document upload** with a small PDF/image file
5. **Monitor console logs** for detailed error messages if issues persist

---

## Questions?

Check the console logs (Expo DevTools) for detailed error messages. They'll show:
- Exact error type
- Why the upload failed
- Bucket name and permissions issue

Share these logs if you need further debugging help! 🚀
