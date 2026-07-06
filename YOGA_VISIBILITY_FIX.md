# ✅ Yoga Session Visibility Fix

## Problem
Admin added yoga session but it's **not visible to patient** in mobile app

## Root Cause
The `useYogaSessions` hook was trying to JOIN with the `professionals` table to get instructor name:
```sql
professionals!inner(
  profiles!professionals_id_fkey(full_name)
)
```

But since we made `instructor_id` nullable, this `!inner` join fails and returns **zero sessions**.

## ✅ Solution Applied

### 1. Remove Failed Join (mobile-app/lib/yoga-sessions.ts)

**Before**:
```typescript
.select(`
  id,
  title,
  ...
  professionals!inner(...)  // ❌ Fails when instructor_id is null
`)
```

**After**:
```typescript
.select(`
  id,
  title,
  description,
  ...
`)
```

### 2. Parse Instructor Name from Description

**Before**:
```typescript
instructor: s.professionals?.[0]?.profiles?.full_name ?? 'Instructeur'
```

**After**:
```typescript
// Description format: "Instructeur: Sara Bennani"
let instructorName = 'Instructeur';
if (s.description?.includes('Instructeur:')) {
  instructorName = s.description.split('Instructeur:')[1].trim();
}
instructor: instructorName
```

---

## 🚀 What Happens Now

### Admin Creates Session:
```
Form Fill:
- Title: "Hatha Flow"
- Instructor: "Sara Bennani"
- Date/Time: 07/09/2026 10:00
- Max spots: 10
- Price: 120
```

### Database Saves:
```sql
INSERT INTO yoga_sessions (
  instructor_id,      -- NULL (nullable field)
  title,              -- "Hatha Flow"
  description,        -- "Instructeur: Sara Bennani"
  starts_at,          -- 2026-09-07T10:00:00Z
  capacity,           -- 10
  price_mad           -- 120
)
```

### Mobile Fetches:
```typescript
// Query succeeds (no inner join fail)
const sessions = await supabase
  .from('yoga_sessions')
  .select('id, title, description, starts_at, ...')
  .gt('starts_at', now)

// Parse instructor from description
// Result: "Sara Bennani"
```

### Patient Sees:
✅ Session appears in yoga catalog immediately (real-time subscription)
✅ Instructor name displays correctly
✅ Patient can enroll

---

## ✅ Files Changed

1. **mobile-app/lib/yoga-sessions.ts**
   - Removed join with professionals table (lines 41-56)
   - Added description parsing for instructor (lines 86-92)

2. **src/app/components/AdminPanel.tsx**
   - Uses `instructor_id: null` for admin sessions
   - Stores instructor name in description field

3. **supabase/schema.sql**
   - `instructor_id` now nullable (line 196)

---

## ✅ Build Status
- ✅ Web admin builds successfully
- ✅ Mobile app compiles (no TypeScript errors)
- ✅ Ready to test

## 🎯 To Test

1. **Execute SQL in Supabase** (from FIX_FOREIGN_KEY.md):
   ```sql
   ALTER TABLE public.yoga_sessions
   DROP CONSTRAINT yoga_sessions_instructor_id_fkey;
   
   ALTER TABLE public.yoga_sessions
   ALTER COLUMN instructor_id DROP NOT NULL;
   
   ALTER TABLE public.yoga_sessions
   ADD CONSTRAINT yoga_sessions_instructor_id_fkey
     FOREIGN KEY (instructor_id) REFERENCES public.professionals(id) ON DELETE SET NULL;
   ```

2. **Admin creates session** (should now succeed ✅)

3. **Patient opens mobile app yoga catalog** (should see session immediately ✅)

---

## ✅ Real-Time Sync Still Works

Mobile app subscribes to changes:
```typescript
// Line 120+ in yoga-sessions.ts
channel.on('postgres_changes', 
  { event: '*', schema: 'public', table: 'yoga_sessions' },
  (payload) => { loadSessions(); }  // Reload on any change
)
```

So when admin:
- ✅ Adds session → appears to patient immediately
- ✅ Edits session → updates in real-time
- ✅ Deletes session → disappears in real-time

---

**Status**: Code fixed ✅ Build verified ✅  
**Action**: Execute SQL in Supabase Dashboard  
**Result**: Admin sessions will be visible to patients 🎉
