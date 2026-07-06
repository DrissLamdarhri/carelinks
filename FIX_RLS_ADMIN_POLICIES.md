# 🔐 Fix RLS Policies for Admin Access

## Problem
Admin cannot create yoga sessions or service types due to RLS policy violations:
1. **yoga_sessions**: Policy only allows instructor to modify (not admin)
2. **service_types**: Policy checks for admin role but user isn't in profiles table

## Solution
Add admin policies that allow admins to create/edit/delete without being the instructor/owner.

## SQL Fixes

Run these queries in Supabase SQL Editor:

### 1. Add Admin Policy for Yoga Sessions

```sql
-- Allow admin to manage all yoga sessions
drop policy if exists "yoga_admin" on public.yoga_sessions;
create policy "yoga_admin" on public.yoga_sessions
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');
```

### 2. Verify Service Types Policy

```sql
-- Check if admin policy exists
select * from pg_policies where tablename = 'service_types';

-- If service_types_insert doesn't exist, create it:
drop policy if exists "service_types_insert" on public.service_types;
create policy "service_types_insert" on public.service_types
  for insert with check (public.current_role() = 'admin');

-- Verify admin can read
drop policy if exists "service_types_read" on public.service_types;
create policy "service_types_read" on public.service_types
  for select using (true);
```

### 3. Test Admin Access

After running the SQL, these operations should work:

```sql
-- Test service types insert
INSERT INTO public.service_types (name, category) 
VALUES ('Pansement', 'Infirmier');

-- Test yoga sessions insert (use a valid professional UUID)
INSERT INTO public.yoga_sessions (instructor_id, title, starts_at, capacity, price_mad)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Hatha Flow',
  now() + interval '1 day',
  10,
  80
);
```

## How It Works

The `public.current_role()` function checks the authenticated user's role in the profiles table:

```sql
-- In schema.sql
create or replace function public.current_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
```

So when admin creates a session:
1. Admin is authenticated with Supabase auth token
2. `auth.uid()` returns the admin's user ID
3. `public.current_role()` looks up their role in profiles table
4. If role = 'admin', policy allows the operation ✅

## If Admin Still Can't Create

If the admin isn't in the profiles table, you need to either:

**Option A: Register admin in profiles table**
```sql
INSERT INTO public.profiles (id, role, full_name)
VALUES (auth.uid(), 'admin', 'Admin User')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

**Option B: Use anon key with RLS disabled** (not recommended for production)
- Go to Supabase > Settings > API
- Use `serviceRoleSecret` instead of `anonKey`
- This bypasses all RLS policies

**Option C: Modify policy to use auth.role()** (if available)
```sql
-- Alternative for some Supabase setups
create policy "yoga_admin_alt" on public.yoga_sessions
  for all using (auth.jwt() ->> 'role' = 'authenticated');
```

## Files to Update

After running SQL, update schema.sql to reflect the changes:

Add to the yoga_sessions policies section (around line 392):
```sql
create policy "yoga_admin"  on public.yoga_sessions for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
```

## Verification Checklist

- [ ] Run SQL in Supabase > SQL Editor
- [ ] Test creating service type in admin panel
- [ ] Test creating yoga session in admin panel
- [ ] Verify sessions appear for patients in real-time
- [ ] Commit schema.sql changes

## Status
🔧 **Requires SQL execution in Supabase dashboard**

Once SQL is executed:
✅ Admin can create yoga sessions
✅ Admin can create/edit service types
✅ All operations sync in real-time
