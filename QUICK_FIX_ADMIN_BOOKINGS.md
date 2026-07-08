# QUICK FIX: Admin Bookings Not Showing

## TL;DR — 3 Steps

### 1️⃣ Run This in Supabase SQL Editor
```sql
INSERT INTO public.profiles (id, role, full_name, email, created_at, updated_at)
SELECT id, 'admin'::user_role, 'CareLink Admin', email, NOW(), NOW()
FROM auth.users
WHERE email = 'admin@carelink.ma'
ON CONFLICT (id) DO UPDATE SET role = 'admin'::user_role, updated_at = NOW();
```

### 2️⃣ Clear Browser Cache & Re-login
- **Clear:** DevTools → Application → Clear all storage
- **Logout** from admin panel
- **Login:** admin@carelink.ma / CareLinkAdmin2024!

### 3️⃣ Check Console (F12)
Should see:
```
[Admin Bookings] Current user: { role: 'admin' }
[Admin Bookings] Raw count from DB: X bookings
```

✅ **Done!** Bookings should now appear in Réservations tab.

---

## If Still Not Working

### Check #1: Admin User Exists?
```sql
SELECT id, email FROM auth.users WHERE email = 'admin@carelink.ma';
```
- **No result?** Create user in Auth > Users first
- **Has result?** Continue to Check #2

### Check #2: Admin Profile Has role='admin'?
```sql
SELECT id, role FROM public.profiles WHERE email = 'admin@carelink.ma';
```
- **role = admin?** ✅ Good, continue to Check #3
- **role ≠ admin or NULL?** Run Step 1 above
- **No result?** Run Step 1 above

### Check #3: Bookings Exist?
```sql
SELECT COUNT(*) FROM public.bookings;
```
- **> 0?** Continue to Check #4
- **= 0?** Create a test booking from mobile app

### Check #4: Console Shows Error?
**Open browser DevTools (F12) → Console tab**

Look for error like:
```
[Admin Bookings] Error: row level security policy... violation
```
→ See ADMIN_BOOKINGS_FIX_GUIDE.md for RLS fix

---

## Test It Works

1. Keep admin panel open
2. From mobile app: "Demander un soin" → Fill form → Submit
3. **Expected:** Booking appears in admin within 2 seconds
4. **Console shows:** `[Admin Bookings] postgres_changes event received`

✅ **Success!** Real-time sync is working.

---

## File Reference

| For | See |
|-----|-----|
| Detailed fix | `ADMIN_BOOKINGS_FIX_GUIDE.md` |
| Full verification | `COMPLETE_ADMIN_BOOKINGS_FIX_SUMMARY.md` |
| Troubleshooting | `SESSION_CHECKPOINT_004.md` |
| SQL diagnostics | `supabase/diagnose-admin-bookings.sql` |

---

⏱️ **Estimated time:** 5 minutes
