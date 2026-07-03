# ✅ Supabase Storage Bucket Verification Checklist

## 🚀 Quick Fix (Copy-Paste These in Supabase SQL Editor)

### Step 1: Create the bucket (if it doesn't exist)

```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pro-documents', 'pro-documents', false)
ON CONFLICT (id) DO NOTHING;
```

---

### Step 2: Set up RLS Policies

Copy and paste these ONE BY ONE in your Supabase SQL Editor:

**Policy 1 - Allow Upload:**
```sql
CREATE POLICY "pros_upload_own_docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pro-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Policy 2 - Allow Read:**
```sql
CREATE POLICY "pros_read_own_docs" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pro-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Policy 3 - Allow Update:**
```sql
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

---

### Step 3: Verify in Supabase Dashboard

**Go to:** Supabase Dashboard → **Storage** (left sidebar)

Check:
- [ ] You see a bucket called **`pro-documents`**
- [ ] Bucket is set to **NOT PUBLIC** (private)
- [ ] Files are organized in user folders: `{uuid}/{filename}`

---

## 🔍 Verify Environment Variables

In your mobile app `.env` file, ensure:

```env
EXPO_PUBLIC_SUPABASE_URL=https://wjhzrovmktekfcjohhrw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_actual_key_here_with_40_chars
```

To find your Anon Key:
1. Go to **Supabase Dashboard**
2. Click **Settings** → **API**
3. Copy the **Anon/Public Key** (NOT the Service Role Key)
4. Paste it into your `.env` file

---

## ✨ Test It

1. **Run mobile app:** `pnpm -C mobile-app start`
2. **Go to:** Pro Registration → Step 2 (Documents)
3. **Click:** "Télécharger Diplôme"
4. **Select:** Any PDF or image file
5. **Wait:** Should see ✓ checkmark
6. **Check:** Supabase Storage should show the file in `pro-documents/` bucket

---

## 🐛 If Upload Still Fails

Check these in order:

1. **Internet Connection** - Open any website, then retry
2. **Supabase URL** - Verify `https://wjhzrovmktekfcjohhrw.supabase.co` is correct
3. **Anon Key** - Should be 40+ characters, starting with `eyJ...`
4. **Bucket exists** - Search "pro-documents" in Storage tab
5. **RLS policies** - Check policies tab shows your policies
6. **File size** - Is file < 5MB?
7. **File type** - Is file PDF, JPG, or PNG?

---

## 📝 Console Logs to Check

Open Expo DevTools (Terminal showing: `exp://...`), look for:

```
✅ If success:
"Diplôme téléchargé avec succès."

❌ If bucket missing:
"Le bucket de stockage n'existe pas. Veuillez contacter le support."

❌ If network error:
"Erreur réseau. Vérifiez votre connexion internet."

❌ If file too large:
"Le fichier est trop volumineux (max 5MB)."
```

---

## 🔗 Reference

- **Supabase Storage Docs:** https://supabase.com/docs/guides/storage
- **RLS Policies:** https://supabase.com/docs/guides/storage/security/row-level-security
- **Upload Guide:** https://supabase.com/docs/guides/storage/uploads/file

All done! Your uploads should now work. 🚀
