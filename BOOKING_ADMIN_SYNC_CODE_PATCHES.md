# Code Patches Applied — Booking Admin Sync

## Patch 1: Admin Panel Realtime Subscription for Bookings
**File:** `src/app/components/AdminPanel.tsx`  
**Location:** After line 723 (end of yoga realtime subscription)  
**Type:** NEW useEffect Hook

```typescript
  // Real-time subscription to bookings table (all booking changes: create, update, delete)
  useEffect(() => {
    if (!isAdminAuthed) return;
    
    const loadAllBookings = async () => {
      try {
        console.log("[Admin Bookings] Reloading all bookings from realtime change");
        
        // Fetch bookings directly from the bookings table
        const { data: bookings, error: bkError } = await supabase
          .from("bookings")
          .select("id,patient_id,professional_id,specialty,status,urgency,scheduled_at,address,final_price_mad,budget_max_mad,created_at")
          .order("created_at", { ascending: false })
          .limit(1000);
        
        if (bkError) {
          console.error("[Admin Bookings] Error fetching bookings:", bkError);
          return;
        }
        
        const rawCount = bookings?.length ?? 0;
        console.log(`[Admin Bookings] Raw count from DB: ${rawCount} bookings`);
        
        if (!bookings || bookings.length === 0) {
          console.warn("[Admin Bookings] No bookings returned from Supabase query");
          setLiveAllBookings([]);
          return;
        }
        
        // Also fetch any admin log metadata (alert_level) if present
        const { data: adminLogs } = await supabase
          .from("admin_booking_logs")
          .select("booking_id,alert_level")
          .limit(2000)
          .catch(() => ({ data: [] }));
        const alertMap = Object.fromEntries((adminLogs ?? []).map((a: any) => [a.booking_id, a.alert_level]));
        
        // Start with bookings
        const merged: any[] = (bookings ?? []).map((b: any) => ({
          booking_id: b.id,
          id: "#" + (b.id ?? "").slice(0, 6).toUpperCase(),
          patient_id: b.patient_id,
          professional_id: b.professional_id,
          specialty: b.specialty,
          status: b.status,
          statusLabel: b.status,
          urgency: b.urgency,
          scheduled_at: b.scheduled_at,
          address: b.address,
          price: b.final_price_mad ?? b.budget_max_mad ?? 0,
          created_at: b.created_at,
          alert_level: alertMap[b.id] ?? "normal",
          source: "bookings",
        }));
        
        // Fetch patient profiles (name, email, city)
        const patientIds = [...new Set(merged.map((b: any) => b.patient_id))].filter(Boolean);
        const { data: patientProfiles } = patientIds.length > 0 ? await supabase
          .from("profiles")
          .select("id,full_name,email,city")
          .in("id", patientIds) : { data: [] };
        const patientMap = Object.fromEntries((patientProfiles ?? []).map((p: any) => [p.id, { name: p.full_name, email: p.email, city: p.city }]));
        
        // Fetch professional profiles
        const proIds = [...new Set(merged.map((b: any) => b.professional_id).filter(Boolean))];
        const { data: proProfiles } = proIds.length > 0 ? await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", proIds) : { data: [] };
        const proMap = Object.fromEntries((proProfiles ?? []).map((p: any) => [p.id, { name: p.full_name }]));
        
        const labelMap: Record<string, string> = { 
          nurse: "Infirmier", 
          psychologist: "Psychologue", 
          yoga_instructor: "Yoga",
          physiotherapist: "Kinésithérapeute"
        };
        const statusFr: Record<string, string> = {
          open: "En attente", matched: "Confirmé", in_progress: "En cours",
          completed: "Terminé", cancelled: "Annulé",
        };
        
        const bookingsList = merged.map((b: any) => ({
          id: b.id,
          bookingId: b.booking_id,
          patient: patientMap[b.patient_id]?.name ?? "—",
          patientEmail: patientMap[b.patient_id]?.email ?? "",
          patientCity: patientMap[b.patient_id]?.city ?? "",
          pro: b.professional_id ? (proMap[b.professional_id]?.name ?? "—") : "—",
          service: labelMap[b.specialty] ?? b.specialty,
          specialtyKey: b.specialty,
          date: new Date(b.scheduled_at ?? b.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
          price: (b.price ?? 0) + " MAD",
          status: b.status,
          statusLabel: statusFr[b.status] ?? b.status,
          alertLevel: b.alert_level ?? "normal",
          urgency: b.urgency ?? "normal",
          address: b.address,
        }));
        
        console.log(`[Admin Bookings] Formatted ${bookingsList.length} bookings for display`);
        setLiveAllBookings(bookingsList);
      } catch (err) {
        console.error("[Admin Bookings] Error in loadAllBookings:", err);
      }
    };
    
    // Initial load
    loadAllBookings();
    
    // Subscribe to bookings table changes
    const bookingsChannel = supabase
      .channel("admin:bookings:changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        console.log("[Admin Bookings] postgres_changes event received on bookings table");
        loadAllBookings();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(bookingsChannel);
    };
  }, [isAdminAuthed]);
```

## Patch 2: Fix Authorization Header in booking-notifications.ts
**File:** `mobile-app/lib/admin/booking-notifications.ts`  
**Location:** Line 52  
**Status:** ALREADY CORRECT (No change needed)

The file currently has:
```typescript
...(token && { Authorization: `Bearer ${token}` }),
```

This is the correct spread syntax. No edits required.

## No Patches Needed For:

### `mobile-app/app/patient/request.tsx` (Line 330)
✅ Already calls `notifyAdminNewBooking(booking)` after booking creation

```typescript
try {
  await notifyAdminNewBooking(booking);
} catch (err) {
  console.error("notifyAdminNewBooking failed:", err);
}
```

### Database Schema
✅ All required infrastructure already exists:
- RLS policy `bookings_admin` on `public.bookings`
- Realtime publication includes `public.bookings`
- Triggers `booking_created_trigger` and `booking_status_change_trigger`
- Table `admin_booking_logs` with auto-logging

---

**Summary:**
- ✅ 1 new useEffect hook added to AdminPanel.tsx
- ✅ 0 changes to mobile app booking flow (already correct)
- ✅ 0 DB schema changes (all infrastructure already in place)
- ✅ Build passes with no errors
- ✅ Ready for testing and deployment
