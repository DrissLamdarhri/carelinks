# ✅ Foreign Key Constraint Fix

## Problem
Admin cannot create yoga sessions because:
- Code tried to use placeholder UUID `00000000-0000-0000-0000-000000000000`
- But this UUID doesn't exist in `professionals` table
- Foreign key constraint failed

## Solution
Make `instructor_id` **nullable** so admin can create sessions without an instructor:

```sql
-- Allows sessions to be created without requiring an instructor
ALTER TABLE public.yoga_sessions
ALTER COLUMN instructor_id DROP NOT NULL;

-- Update foreign key to cascade to null instead of delete
ALTER TABLE public.yoga_sessions
DROP CONSTRAINT yoga_sessions_instructor_id_fkey;

ALTER TABLE public.yoga_sessions
ADD CONSTRAINT yoga_sessions_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES public.professionals(id) ON DELETE SET NULL;
```

## 🚀 Execute in Supabase Dashboard

Go to **Supabase > SQL Editor > New Query** and paste:

```sql
-- Drop old constraint
ALTER TABLE public.yoga_sessions
DROP CONSTRAINT yoga_sessions_instructor_id_fkey;

-- Make instructor_id nullable
ALTER TABLE public.yoga_sessions
ALTER COLUMN instructor_id DROP NOT NULL;

-- Add new constraint that cascades to null
ALTER TABLE public.yoga_sessions
ADD CONSTRAINT yoga_sessions_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES public.professionals(id) ON DELETE SET NULL;

-- Verify
select constraint_name, table_name, column_name 
from information_schema.constraint_column_usage 
where table_name = 'yoga_sessions' and column_name = 'instructor_id';
```

## ✅ Code Changes

Updated `src/app/components/AdminPanel.tsx`:
- Changed from: `instructor_id: "00000000-0000-0000-0000-000000000000"`
- Changed to: `instructor_id: null`

This allows admin to create yoga sessions with the instructor field empty, which can be assigned/updated later.

## 🎯 After Fix

1. Admin creates yoga session with any instructor name (stored in `description` field)
2. `instructor_id` is `null` (no foreign key conflict)
3. Session appears to patients in real-time ✅
4. Later, can assign actual instructor if needed

## ✅ Schema Updated
- `supabase/schema.sql` line 196: `instructor_id` now nullable

---

**Status**: Code ready ✅ Schema ready ✅  
**Action**: Execute SQL in Supabase Dashboard  
**Result**: Admin can create yoga sessions 🎉
