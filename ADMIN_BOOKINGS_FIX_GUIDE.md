# Fix: Admin Panel Not Showing Bookings — Complete Diagnosis & Solution

## Problem
The admin panel shows "0 réservations" even though bookings exist in the database, visible on the mobile patient app.

## Root Cause
The RLS (Row Level Security) policy `bookings_admin` checks if the current admin user has `role = 'admin'` in the `public.profiles` table. If this profile doesn't exist or the role is incorrect, all booking queries are blocked.

## Quick Fix: 3 Steps

### Step 1: Check if Admin User Exists
Open **Supabase Dashboard > SQL Editor** and run:

```sql
SELECT id, email, created_at FROM auth.users WHERE email = 'admin@carelink.ma' LIMIT 1;
```

**Expected Result:** One row with admin's user ID

**If Empty:** You need to create the admin user first:
1. Go to **Authentication > Users**
2. Click **"Add user"**
3. Email: `admin@carelink.ma`
4. Password: `CareLinkAdmin2024!`
5. Auto-confirm email
6. Create user
7. Come back to SQL Editor and re-run the query above

---

### Step 2: Create Admin Profile
Run this in **Supabase SQL Editor**:

```sql
INSERT INTO public.profiles (
  id,
  role,
  full_name,
  email,
  created_at,
  updated_at
)
SELECT
  id,
  'admin'::user_role,
  'CareLink Admin',
  email,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'admin@carelink.ma'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin'::user_role,
  updated_at = NOW();
```

**Expected Result:** 1 row inserted or updated

---

### Step 3: Verify
Run this to confirm everything is set up correctly:

```sql
SELECT 
  p.id, 
  p.role, 
  p.full_name, 
  p.email,
  COUNT(b.id) as booking_count
FROM public.profiles p
LEFT JOIN public.bookings b ON TRUE
WHERE p.email = 'admin@carelink.ma'
GROUP BY p.id, p.role, p.full_name, p.email;
```

**Expected Result:**
```
id      | role  | full_name     | email                | booking_count
───────────────────────────────────────────────────────────────────────
uuid... | admin | CareLink Admin| admin@carelink.ma    | (count > 0)
```

---

## How to Verify the Fix Works

### From Web Admin Panel

1. **Clear browser cache:**
   ```
   DevTools → Application → Clear storage → Clear all
   ```

2. **Logout from admin panel** (if logged in)

3. **Re-login:**
   - Email: `admin@carelink.ma`
   - Password: `CareLinkAdmin2024!`

4. **Navigate to "Réservations" tab**

5. **Expected:** Bookings should now appear with:
   - Total count > 0
   - List of patient names, services, dates, prices
   - Real-time updates when patients create new bookings

### From Browser Console

Open **DevTools (F12) → Console** and look for:

```
[Admin Bookings] Current user: { id: '...', role: 'admin', name: 'CareLink Admin' }
[Admin Bookings] Reloading all bookings from realtime change
[Admin Bookings] Raw count from DB: X bookings
[Admin Bookings] Formatted X bookings for display
```

If you see `role: null` or `role: undefined`, the profile wasn't found.

---

## Diagnostic Script (Full Diagnosis)

If the quick fix doesn't work, run this comprehensive diagnostic in **Supabase SQL Editor** to identify the exact problem:

```sql
-- 1. Is the admin user in auth.users?
SELECT id, email FROM auth.users WHERE email = 'admin@carelink.ma';

-- 2. Does the admin profile exist with role='admin'?
SELECT id, role, full_name, email FROM public.profiles WHERE email = 'admin@carelink.ma';

-- 3. Are there bookings in the table?
SELECT COUNT(*) FROM public.bookings;

-- 4. Are RLS policies correctly configured?
SELECT policyname, permissive, qual FROM pg_policies WHERE tablename = 'bookings';

-- 5. Is RLS enabled on bookings?
SELECT rowsecurity FROM pg_tables WHERE tablename = 'bookings' AND schemaname = 'public';
```

---

## If Issue Persists: Advanced Troubleshooting

### Issue A: "Raw count: 0" in Console
The bookings table is empty — no bookings created yet.
- **Solution:** Create a test booking from mobile app and refresh admin panel

### Issue B: Auth Error in Console
`Error: 'id' is not a valid identifier`
- **Solution:** You're looking at a booking without an ID (corrupt data). Run:
```sql
DELETE FROM public.bookings WHERE id IS NULL;
```

### Issue C: RLS Policy Blocking Access
`Error: row level security policy... violation`
- **Solution:** Check that `public.current_role()` function exists and works:
```sql
-- Test the function as admin user
SELECT public.current_role();
-- Should return: admin
```

If it returns NULL, the profile lookup failed. Go back to Step 2 above.

### Issue D: Realtime Subscription Not Working
Bookings created but admin panel doesn't update in real-time (need to refresh after 30 seconds)
- **Solution:** Check that `public.bookings` is in realtime publication:
```sql
SELECT tablename FROM pg_publication_tables 
WHERE publication = 'supabase_realtime' AND tablename = 'bookings';
-- Should return: bookings
```

If empty, run:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
```

---

## What Was Changed in Code

### AdminPanel.tsx (src/app/components/AdminPanel.tsx)
Added enhanced console logging to help diagnose RLS and auth issues:

```typescript
// Check current user role
const { data: userProfile } = await supabase
  .from("profiles")
  .select("id,role,full_name")
  .eq("id", user?.id ?? "")
  .single();

console.log("[Admin Bookings] Current user:", { 
  id: user?.id?.slice(0, 8), 
  role: userProfile?.role,
  name: userProfile?.full_name 
});
```

This helps identify if the RLS policy is the issue.

---

## Testing Checklist

- [ ] Admin user exists in `auth.users`
- [ ] Admin user has profile in `public.profiles`
- [ ] Admin profile has `role = 'admin'`
- [ ] Console shows `role: admin` when admin logs in
- [ ] At least one booking exists in database
- [ ] Bookings appear in admin panel Réservations tab
- [ ] Creating a new booking from mobile immediately shows it in admin (no page refresh)

---

## Emergency Bypass (If RLS Cannot Be Fixed)

If the RLS policy is irreparably broken, you can temporarily disable it:

```sql
-- WARNING: This disables security on the bookings table!
-- Only use as emergency measure, re-enable after fixing RLS.

-- DISABLE RLS:
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- ENABLE RLS (when fixed):
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
```

⚠️ **DO NOT** leave RLS disabled in production. Use only to verify bookings display works, then re-enable and debug the RLS policy.

---

## Files Created for Reference

1. **supabase/ensure-admin-profile.sql** — Auto-create admin profile
2. **supabase/diagnose-admin-bookings.sql** — Full diagnostic queries
3. **BOOKING_ADMIN_SYNC_FIX.md** — Original implementation guide
4. **BOOKING_ADMIN_SYNC_TESTING.md** — Testing procedures

---

**Status:** Ready for testing and deployment  
**Updated:** 2025-04-29  
**Contact:** See session checkpoint 003 for full context
