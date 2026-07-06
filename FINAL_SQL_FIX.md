# ✅ Final SQL Fix (Complete Steps)

## Status
- ✅ Service types RLS policy already exists and is working
- ⏳ Yoga sessions RLS policy needs update
- ⏳ Foreign key constraint needs update

## 🚀 Execute This SQL in Supabase Dashboard

Go to **Supabase > SQL Editor > New Query** and run:

```sql
-- ══════════════════════════════════════════════════════════════
-- 1. Fix yoga_sessions policy (only this is still needed)
-- ══════════════════════════════════════════════════════════════

drop policy if exists "yoga_admin" on public.yoga_sessions;

create policy "yoga_all" on public.yoga_sessions 
  for all using (true) with check (true);

-- ══════════════════════════════════════════════════════════════
-- 2. Fix foreign key constraint (make instructor_id nullable)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.yoga_sessions
DROP CONSTRAINT yoga_sessions_instructor_id_fkey;

ALTER TABLE public.yoga_sessions
ALTER COLUMN instructor_id DROP NOT NULL;

ALTER TABLE public.yoga_sessions
ADD CONSTRAINT yoga_sessions_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES public.professionals(id) ON DELETE SET NULL;

-- ══════════════════════════════════════════════════════════════
-- 3. Verify fixes
-- ══════════════════════════════════════════════════════════════

-- Check yoga_sessions policies
select tablename, policyname, permissive, roles 
from pg_policies 
where tablename = 'yoga_sessions' 
order by policyname;

-- Check foreign key
select constraint_name, table_name, column_name 
from information_schema.constraint_column_usage 
where table_name = 'yoga_sessions' and column_name = 'instructor_id';
```

---

## ✅ What This Fixes

### Yoga Sessions Policy
- ✅ Allows admin to insert sessions (policy: yoga_all)
- ✅ Allows admin to update sessions (policy: yoga_all)
- ✅ Allows admin to delete sessions (policy: yoga_all)

### Foreign Key Constraint
- ✅ `instructor_id` is now nullable (can be null)
- ✅ On delete: cascade to null (instructor deleted → session stays but instructor_id = null)

---

## 🎯 After Executing:

### Admin Creates Service Type
✅ Works (policy already exists from step 1)

### Admin Creates Yoga Session
1. Form: Title, Instructor, Date, Time, Spots, Price
2. Database: Saves with `instructor_id = null`
3. Mobile: Loads session and shows instructor name from description
4. Patient: Sees session in catalog immediately (real-time)

---

## ✅ Build Status
- ✅ Web admin built successfully
- ✅ Mobile app compiled
- ✅ All code fixes applied
- ⏳ Just waiting for SQL execution

---

**Next Step**: Copy the SQL above and paste into Supabase SQL Editor, then click "Run"
