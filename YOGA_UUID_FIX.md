# 🔧 Yoga Sessions UUID Fix

## Problem
Error when patient tried to reserve a yoga session:
```
ERROR [YogaCatalog] Erreur lors de l'inscription: 
[Error: Erreur lors de l'inscription: invalid input syntax for type uuid: "s2"]
```

## Root Cause
The fallback mock data had session IDs like `"s1"`, `"s2"`, `"s3"` (strings), but Supabase `yoga_enrollments` table requires `session_id` to be a valid UUID.

When the database was empty or loading, the app showed fallback sessions. If a patient tried to enroll in a fallback session, it would fail because:
```typescript
// Mock data (invalid for Supabase)
const fallbackSessions = [
  { id: "s1", name: "Hatha Flow", ... },  // ❌ Not a UUID
  { id: "s2", name: "Vinyasa", ... },     // ❌ Not a UUID
];

// Enrollment attempt
await supabase
  .from("yoga_enrollments")
  .insert({ session_id: "s2", ... })  // ❌ Supabase rejects "s2"
```

## Solution
**Only show sessions from the database** - completely removed fallback mock sessions from enrollment.

### Changes in `mobile-app/app/patient/yoga.tsx`:

#### Before:
```typescript
const sessions = yogaSessions.length > 0 
  ? yogaSessions.map(...)  // Database sessions
  : fallbackSessions;      // ❌ Shows invalid mock data
```

#### After:
```typescript
const sessions = yogaSessions.length > 0 
  ? yogaSessions.map(...)  // Database sessions (valid UUIDs)
  : [];                    // ✅ Empty array, not fallback
```

### Updated UI Messages:
- **Loading**: "Chargement des séances..."
- **Error**: "❌ Erreur lors du chargement des séances"
- **Empty**: "📋 Aucune séance disponible - Revenez bientôt!"

## How It Works Now

### Normal Flow (Database Available):
1. Admin adds yoga session in panel → Saves to Supabase with UUID
2. `useYogaSessions()` hook fetches from database
3. Sessions have valid UUIDs (e.g., `"123e4567-e89b-12d3-a456-426614174000"`)
4. Patient reserves session → Enrollment succeeds ✅

### If Database Unavailable:
1. `useYogaSessions()` shows loading state
2. After timeout/error, shows "Aucune séance disponible"
3. Patient sees clear message, no broken sessions
4. No confusing errors ✅

## Benefits

✅ **Type Safe** - Only real UUIDs from database can be enrolled  
✅ **No Invalid Data** - Fallback sessions can't cause Supabase errors  
✅ **Better UX** - Clear messages instead of cryptic errors  
✅ **Future Proof** - Encourages using real database sessions  
✅ **Real-Time Sync** - Database sessions sync instantly to admin  

## Testing

### Before Fix (Would Fail):
```
1. Yoga database is empty
2. App shows fallback sessions with IDs: s1, s2, s3
3. Patient clicks "Réserver" on "Hatha Flow"
4. Error: "invalid input syntax for type uuid: s2" ❌
```

### After Fix (Works):
```
1. Yoga database is empty
2. App shows "Aucune séance disponible"
3. Patient sees clear message ✅
4. Admin adds session
5. Session appears immediately to all patients ✅
6. Patient reserves → Success! ✅
```

## Database Sessions (Real UUIDs)

When admin creates a session in the panel:
```typescript
const { data } = await supabase
  .from("yoga_sessions")
  .insert({
    instructor_id: "550e8400-e29b-41d4-a716-446655440000",  // UUID
    title: "Hatha Flow",
    starts_at: "2026-07-15T09:00:00Z",
    ...
  })
  .select()
  .single();

// Returns with valid UUID:
// {
//   id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",  // ✅ Valid UUID
//   title: "Hatha Flow",
//   ...
// }
```

Patient can now safely reserve this session ✅

## Fallback Strategy Going Forward

**Old Approach** (Removed):
- Show mock sessions with invalid IDs
- Lead to confusing errors

**New Approach** (Implemented):
- Show empty state with helpful message
- Encourages users to check back
- No invalid data reaches Supabase

## Files Changed
- `mobile-app/app/patient/yoga.tsx`
  - Line 74-81: Removed fallback, use empty array
  - Line 85: Updated "Aucune séance disponible" message
  - Line 86-90: Better error/empty messages

## Status
✅ **Fixed** - No more UUID errors  
✅ **Tested** - Build passes  
✅ **Ready** - Deploy to production

---

**Key Takeaway**: Only database sessions with valid UUIDs can be enrolled. Fallback data is purely for UI reference, never for operations.
