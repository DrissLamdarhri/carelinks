# Testing Guide — Booking Admin Real-Time Sync

## Quick Start

### Prerequisites
- ✅ Supabase project configured and running
- ✅ Mobile app and web admin can access the same Supabase instance
- ✅ Admin user created with `role = 'admin'` in profiles table

### Step 1: Start the Web Admin Panel
```bash
cd C:\carelink
pnpm dev
# Access at http://localhost:5175 (or next available port)
```

### Step 2: Start the Mobile App
```bash
cd C:\carelink\mobile-app
pnpm start
# Choose: a (Android) or i (iOS)
# Or: Expo Go on physical device
```

### Step 3: Login to Both Apps
**Web Admin:**
- URL: `http://localhost:5175/admin`
- Username/Email: `admin@carelink.ma`
- Password: `CareLinkAdmin2024!`

**Mobile Patient App:**
- Login as any patient account
- Or create new account with email and SMS verification

---

## Test Scenarios

### Test 1: Create a Nurse Booking (Standard Flow)

**Step A: Mobile Patient App**
1. Go to "Demander un soin"
2. Select "Infirmier" (Nurse)
3. Enter details:
   - Location: Your address or "Marrakech, Maroc"
   - Date/Time: Today + 2 hours
   - Estimated Price: 250 MAD
   - Urgency: "Normal"
   - Notes: "Test booking for admin sync"
4. Tap "Demander le soin"
5. **Expected:** Navigates to waiting screen

**Step B: Check Admin Panel**
1. Refresh web admin page (or keep it open)
2. Navigate to "Réservations" tab
3. **Expected Results:**
   - ✅ Booking count changes from "0" to "1" (or higher)
   - ✅ New booking appears in the list with:
     - Patient name (your account name)
     - Service: "Infirmier"
     - Price: "250 MAD"
     - Status: "En attente" (En attente = Waiting)
     - Address: The address you entered
   - ✅ Appears within 1-2 seconds of submission

**Step C: Monitor Console for Realtime Events**
1. Open browser DevTools: F12 → Console tab
2. Create another booking from mobile
3. **Expected Console Output:**
```
[Admin Bookings] Reloading all bookings from realtime change
[Admin Bookings] Raw count from DB: 2 bookings
[Admin Bookings] Formatted 2 bookings for display
[Admin Bookings] postgres_changes event received on bookings table
```

---

### Test 2: Create a Psychologist Booking (Urgent)

**Step A: Mobile Patient App**
1. Go to "Demander un soin"
2. Select "Psychologue" (Psychologist)
3. Set Urgency: "Urgent" or "Urgence"
4. Fill other details and submit

**Step B: Check Admin Panel**
1. **Expected Results:**
   - ✅ Booking appears in list
   - ✅ Visual indicator shows high priority (check color/styling)
   - ✅ Alert level: "high" or "critical"
   - ✅ Appears in top of list (sorted by alert level)

---

### Test 3: Yoga Session Enrollment

**Step A: Admin Creates Yoga Session**
1. Admin Panel → "Yoga" tab
2. Click "+ Ajouter une séance"
3. Fill form:
   - Title: "Hatha Flow"
   - Instructor: Select a yoga instructor
   - Date/Time: Tomorrow
   - Duration: 60 minutes
   - Capacity: 10
   - Price: 150 MAD
4. Click "Créer une séance"
5. **Expected:** Session appears in list

**Step B: Patient Enrolls in Session**
1. Mobile App → "Yoga" tab
2. Find the session you just created
3. Tap "Réserver" (Reserve)
4. Confirm enrollment

**Step C: Check Admin Panel**
1. Refresh "Réservations" tab (or wait for realtime)
2. **Expected:**
   - ✅ New yoga booking appears with service: "Yoga"
   - ✅ Shows patient name and session details
   - ✅ Status: "Confirmé" (Confirmed)

---

### Test 4: Real-Time Status Update

**Step A: Create a Booking (from Test 1)**
1. Admin Panel showing the booking with status "En attente"

**Step B: Change Status**
1. Click on the booking in admin panel
2. Change status from "En attente" to "Confirmé"
3. Confirm change

**Step C: Check Mobile Patient App**
1. Go to "Mes rendez-vous" (My Appointments)
2. **Expected:**
   - ✅ Status updates from "En attente" to "Confirmé" within 2 seconds
   - ✅ No need to refresh manually

---

### Test 5: Offline Realtime (Connection Recovery)

**Step A: Simulate Network Issue**
1. Admin Panel open in browser
2. Open browser DevTools → Network tab
3. Click "Offline" checkbox to simulate disconnection

**Step B: Create Booking from Mobile**
1. Patient creates booking
2. Admin panel will NOT show it (offline)
3. **Expected:** Console shows no realtime events

**Step C: Restore Connection**
1. DevTools → Uncheck "Offline"
2. Wait 2 seconds for reconnection
3. **Expected:**
   - ✅ Realtime channel reconnects (check console)
   - ✅ Bookings appear after connection restored
   - Fallback: Wait 30 seconds for polling to update

---

## Diagnostic Checks

### Check 1: Admin Is Authenticated
**Console Command:**
```javascript
// Open DevTools Console and run:
localStorage.getItem('auth_token')
```
**Expected:** Returns JWT token (not null/empty)

### Check 2: Realtime Channel Is Active
**Console Command:**
```javascript
// Check for subscription messages
// Should see: "channel subscribed" or similar
// Search console for: "admin:bookings:changes"
```

### Check 3: Verify Booking in Database
**Supabase SQL Editor:**
```sql
SELECT id, patient_id, specialty, status, created_at 
FROM public.bookings 
ORDER BY created_at DESC 
LIMIT 10;
```
**Expected:** Shows recently created bookings

### Check 4: Verify Admin Role
**Supabase SQL Editor:**
```sql
SELECT id, full_name, role 
FROM public.profiles 
WHERE role = 'admin';
```
**Expected:** Returns admin user(s)

### Check 5: Verify Realtime Publication
**Supabase SQL Editor:**
```sql
SELECT tablename 
FROM pg_publication_tables 
WHERE publication = 'supabase_realtime'
ORDER BY tablename;
```
**Expected:** Includes `public.bookings`

---

## Troubleshooting

### Issue: "0 réservations" (No Bookings Shown)

**Cause 1: Admin Not Authenticated**
- Solution: Check admin login, verify role = 'admin' in profiles

**Cause 2: Bookings Exist But Not Loading**
- Check: Open browser console, search for `[Admin Bookings]` logs
- If no logs: Admin login failed or app didn't mount
- If logs show "Raw count: 0": No bookings in database (create one first)

**Cause 3: Realtime Not Working (Static UI)**
- Check: Create booking, see if it appears after 30 seconds
- If yes: Realtime is down, using 30-second polling fallback
- If no: Check Realtime publication in Supabase (see Diagnostic Check 5)

### Issue: Booking Appears Late (> 5 seconds)

**Cause 1: Network Latency**
- Normal for slow connections, should be < 2 seconds on good network

**Cause 2: Realtime Subscription Lag**
- Monitor console logs to measure time between submission and load
- If consistently > 2s, check Supabase project health

**Cause 3: Browser JavaScript Performance**
- Check browser DevTools → Performance tab
- Look for long-running scripts

### Issue: Status Update Not Syncing

**Mobile App Shows Old Status:**
- Mobile might not have realtime subscription for bookings
- Workaround: Restart app to refresh
- Check: Mobile app has realtime subscription hook for bookings (future improvement)

---

## Expected Console Output (Normal Operation)

```
[Admin Bookings] Reloading all bookings from realtime change
[Admin Bookings] Raw count from DB: 3 bookings
[Admin Bookings] Formatted 3 bookings for display
[Admin Bookings] postgres_changes event received on bookings table
[Admin Bookings] Reloading all bookings from realtime change
[Admin Bookings] Raw count from DB: 4 bookings
[Admin Bookings] Formatted 4 bookings for display
```

---

## Performance Expectations

| Metric | Expected | Good | Poor |
|--------|----------|------|------|
| Initial Load | < 2 sec | < 1 sec | > 5 sec |
| Realtime Update | < 2 sec | < 500 ms | > 5 sec |
| Status Change Sync | < 2 sec | < 1 sec | > 5 sec |
| Polling Fallback | 30 sec | 30 sec | > 60 sec |
| Console Output | Immediate | Immediate | Missing |

---

## Reporting Issues

If tests fail, collect:
1. **Console output** (Right-click → Copy visible console output)
2. **Network tab** (DevTools → Network → Create booking, take screenshot)
3. **Database state** (Run diagnostic checks above)
4. **Environment** (Browser, OS, mobile device)
5. **Timestamp** (When did the issue occur?)

---

**Last Updated:** 2025-04-29  
**Tested On:** Chrome 124+, Firefox 124+, Safari 17+
