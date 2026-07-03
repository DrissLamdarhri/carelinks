# 🎯 Document Upload Error - Fixed! ✅

## Problem
Users were getting upload errors when trying to upload documents/selfies:
- **"StorageUnknownError: Network request failed"**
- **"StorageApiError: Bucket not found"**

---

## Root Cause
The upload code was configured to use **`kyc-documents` bucket**, but your Supabase project uses **`pro-documents` bucket** (case-sensitive).

---

## Solution Applied ✅

### Files Updated:

1. **`mobile-app/lib/hooks/useDocumentPicker.ts`**
   - Changed bucket name: `kyc-documents` → `pro-documents` (line 68)
   - Added intelligent error detection
   - Improved error messages for users

2. **`mobile-app/lib/hooks/useCameraPicker.ts`**
   - Changed bucket name: `kyc-documents` → `pro-documents` (line 68)
   - Added intelligent error detection
   - Improved error messages for users

3. **`mobile-app/app/auth/pro-registration.tsx`**
   - Fixed step validation for psychologists (don't require services to be selected)

---

## Changes Made

### Before (❌ Broken):
```typescript
export async function uploadDocumentToSupabase(
  userId: string,
  documentUri: string,
  documentName: string,
  documentType: string,
  bucket: string = "kyc-documents"  // ❌ Wrong bucket
): Promise<string | null> {
  // ... 
  const { data, error } = await supabase.storage
    .from("kyc-documents")  // ❌ Wrong bucket
    .upload(fileName, bytes, { ... });
  
  if (error) {
    console.error("Upload error:", error);
    showToast("Erreur lors de l'upload du document.");  // ❌ Generic message
    return null;
  }
}
```

### After (✅ Fixed):
```typescript
export async function uploadDocumentToSupabase(
  userId: string,
  documentUri: string,
  documentName: string,
  documentType: string,
  bucket: string = "pro-documents"  // ✅ Correct bucket
): Promise<string | null> {
  // ...
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, bytes, { ... });
  
  if (error) {
    console.error("Upload error:", error);
    
    // ✅ Smart error detection
    if (error.message?.includes("Bucket not found")) {
      showToast("Le bucket de stockage n'existe pas. Veuillez contacter le support.");
    } else if (error.message?.includes("Network")) {
      showToast("Erreur réseau. Vérifiez votre connexion internet.");
    } else {
      showToast("Erreur lors de l'upload du document.");
    }
    return null;
  }
}
```

---

## What You Need To Do

### 1️⃣ Verify Supabase Bucket (Required)

In **Supabase Dashboard** → **Storage** tab:

**Check:**
- [ ] Bucket named `pro-documents` exists
- [ ] Bucket is **NOT PUBLIC** (private/protected)
- [ ] Files are stored in structure: `{user-uuid}/{filename}`

**If bucket doesn't exist, run this SQL:**
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pro-documents', 'pro-documents', false)
ON CONFLICT (id) DO NOTHING;
```

### 2️⃣ Set Up RLS Policies (Required)

Run these in **Supabase SQL Editor** (one at a time):

```sql
-- Policy 1: Allow upload
CREATE POLICY "pros_upload_own_docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pro-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow read
CREATE POLICY "pros_read_own_docs" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pro-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow update
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
```

### 3️⃣ Check Environment Variables (Required)

In your mobile app `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://wjhzrovmktekfcjohhrw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_actual_key_here
```

**Get your Anon Key from:**
1. Supabase Dashboard
2. **Settings** → **API**
3. Copy **Anon/Public Key** (NOT Service Role Key)
4. Update `.env` file

### 4️⃣ Test the Upload

1. Run the mobile app: `pnpm -C mobile-app start`
2. Go to: **Pro Registration** → **Step 2 (Documents)**
3. Click: **"Télécharger Diplôme"**
4. Select: Any PDF/JPG/PNG file (< 5MB)
5. Check: Should see ✓ checkmark when done
6. Verify: File appears in Supabase Storage under `pro-documents/`

---

## Error Messages (Now Smart!)

| Message | Meaning | Fix |
|---------|---------|-----|
| "Le bucket de stockage n'existe pas..." | Bucket not found in Supabase | Run SQL to create bucket |
| "Erreur réseau. Vérifiez votre connexion..." | Network connectivity issue | Check WiFi/internet, disable VPN |
| "Erreur lors de l'upload du document." | Other upload error | Check RLS policies, file size |

---

## Test Cases

### ✅ Test 1: Diploma Upload
- Go to Pro Registration Step 2
- Click "Télécharger Diplôme"
- Select any PDF file
- Expected: ✓ Success message, file in Supabase

### ✅ Test 2: CIN Upload
- Click "Télécharger CIN"
- Select any JPG/PNG file
- Expected: ✓ Success message, file in Supabase

### ✅ Test 3: Selfie Upload
- Click "Prendre Selfie"
- Camera opens, take photo
- Expected: ✓ Success message, file in Supabase

### ✅ Test 4: Psychologist Registration
- Select "Psychologue" as profession
- No services dropdown (not required)
- "Continuer" button becomes active
- Can proceed to step 2

### ✅ Test 5: Network Error Message
- Disable internet
- Try to upload file
- Expected: "Erreur réseau..." message

---

## Verification Checklist

Before considering this fixed, verify:

- [ ] All 3 SQL policies created in Supabase
- [ ] `pro-documents` bucket exists and is private
- [ ] `.env` has correct `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Can successfully upload a test document
- [ ] File appears in Supabase Storage → pro-documents
- [ ] Psychologist registration doesn't require services
- [ ] Error messages are helpful when errors occur

---

## Support

If uploads still fail after setup:

1. **Check Expo console** (DevTools) for detailed error logs
2. **Verify Supabase bucket** exists in dashboard
3. **Test internet connection** - open any website
4. **Check file size** - must be < 5MB
5. **Check file type** - must be PDF, JPG, or PNG

Share console logs if you need help debugging! 🚀

---

## Reference Documents

- 📖 `DOCUMENT_UPLOAD_FIX.md` - Complete technical guide
- 📖 `SUPABASE_BUCKET_SETUP.md` - Setup checklist with SQL
- 📖 Supabase Docs: https://supabase.com/docs/guides/storage

---

**Status:** ✅ Fixed and ready for testing!
