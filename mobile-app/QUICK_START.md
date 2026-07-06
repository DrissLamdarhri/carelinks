# CareLink Mobile App - Quick Start for Testing

## 📱 What You're Testing

A React Native mobile app with:
- ✅ Real-time tracking with animated pro movement
- ✅ Live profile sync (name, avatar, role)
- ✅ Google OAuth integration
- ✅ Location-based booking
- ✅ OSRM routing (real streets, not just points)
- ✅ Speed-based ETA calculation
- ✅ Smooth animations and map interaction

---

## 🚀 Quick Start (Choose One Method)

### Option A: Cloud Build (Easiest) - ~30 min total
Perfect if you don't have Android SDK installed.

```bash
# 1. Install EAS globally (one-time)
npm install -g eas-cli

# 2. Authenticate with Expo (one-time)
eas login

# 3. Build the APK
cd mobile-app
eas build --platform android --profile preview

# 4. Download APK from link in console
# 5. Transfer to phone and install
```

### Option B: Automated Script
```bash
cd mobile-app
./build.sh
# Follow the prompts (script will auto-detect best method)
```

### Option C: Local Build (Fastest, needs Android SDK)
```bash
cd mobile-app
pnpm install
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
adb install app-release.apk
```

---

## 📋 Testing Flows (5-10 min each)

### Flow 1: Profile & Avatar (5 min)
1. Sign up with email or Google
2. See default avatar initially
3. Upload a custom photo from gallery
4. Verify avatar persists after app restart
5. If signed with Google, check avatar loads from Google

**Expected:** Avatar displays correctly, updates live, persists.

### Flow 2: Create Booking (5 min)
1. Tap "Publier ma demande" (New booking)
2. Select service (e.g., "Infirmière")
3. Pick date/time
4. Use GPS to get location OR enter address
5. Set budget (80-200 MAD)
6. Tap "Publier"

**Expected:** Booking created, redirects to waiting screen.

### Flow 3: Book a Pro & Track (8 min)
1. From booking screen, see pros on map
2. Tap a pro to expand their card
3. Tap "Réserver" to confirm booking
4. See tracking map with:
   - Real route (purple dashed line)
   - Pro moving along streets
   - "Vous" patient pin with label
   - ETA countdown
   - Pro avatar with purple rim
5. Scroll bottom sheet to see pro info
6. Tap "Appeler" or "Message"
7. When ETA=0, "Terminer" button appears

**Expected:** Smooth movement, realistic routing, live ETA sync.

---

## 🎯 Key Things to Test

### Must Work
- [ ] App doesn't crash on launch
- [ ] Profile avatar uploads and displays
- [ ] Bookings create successfully
- [ ] Tracking map loads and pro moves
- [ ] ETA updates in real-time
- [ ] Bottom sheet is scrollable
- [ ] No memory leaks (app stays fast)

### Should Work Smoothly
- [ ] Pro moves without jerking
- [ ] Route is realistic (curves, not straight line)
- [ ] Avatar loads quickly (<1s)
- [ ] Map pans/zooms smoothly
- [ ] Bottom sheet scrolls without lag

### Polish Items
- [ ] Text doesn't overlap
- [ ] Buttons are easy to tap
- [ ] Icons are clear
- [ ] Colors look professional
- [ ] Shadows and spacing are balanced

---

## ⚠️ Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "App won't install" | Ensure Android 10+ (API 30+), ~100MB free space |
| "Network timeout" | Check internet, try again, or use VPN |
| "GPS location stuck" | Grant location permission: Settings → Apps → CareLink → Permissions |
| "Avatar doesn't load" | Check internet, restart app, check Supabase bucket exists |
| "Tracking doesn't move" | Wait ~2s for OSRM route fetch, check network |
| "Bottom sheet doesn't scroll" | Swipe up from bottom; should scroll content |
| "ETA doesn't change" | Demo pro moves every 1s; ETA updates as distance decreases |

---

## 📸 What to Screenshot/Record

When reporting issues:
1. **Screenshots of the problem**
   - Full screen, not cropped
   - Include timestamp if possible

2. **Videos of crashes**
   - 10-15 seconds, shows what you did before crash
   - Save as MP4

3. **Device info**
   - Model (e.g., Samsung Galaxy S21)
   - Android version (Settings → About Phone)

4. **Logs**
   - If you know how: `adb logcat > log.txt`
   - Or just describe steps to reproduce

---

## 📝 Report Template

When you find an issue, use this format:

```
## Issue: [Brief title]

**Device:** [Model] Android [Version]

**Severity:** [ ] Critical [ ] High [ ] Medium [ ] Low

**Steps to reproduce:**
1. 
2. 
3. 

**Expected:** 

**Actual:** 

**Screenshot/Video:** [Attach file]

**Notes:** 

```

---

## ✅ Sign-Off Checklist

After testing, fill out:
- [ ] Used BUILD_GUIDE.md to build
- [ ] Installed on physical Android device
- [ ] Completed at least 1 full flow (profile → booking → tracking)
- [ ] Filled TESTING_CHECKLIST.md
- [ ] Reported any bugs with device info
- [ ] Device model & Android version noted

---

## 🔧 System Requirements

### Minimum
- Android 10 (API 30)
- 150 MB free storage
- 2GB RAM (4GB recommended)
- Stable internet connection

### Recommended
- Android 12+ (API 31+)
- 500 MB free storage
- 4GB+ RAM
- WiFi connection

---

## 📞 Support

**Issues?**
- Check BUILD_GUIDE.md for detailed troubleshooting
- Email: dev@carelink.app
- Include device model + Android version + screenshot

**Want to see logs?**
```bash
adb logcat -c  # Clear logs
# Reproduce issue
adb logcat > carelink_logs.txt  # Save logs
```

---

## 🎉 You're Ready!

1. Build the app (Option A/B/C above)
2. Install on your Android device
3. Test the flows above
4. Report findings using the template
5. Fill out TESTING_CHECKLIST.md
6. Send feedback to dev team

**Estimated time: 30 min (build) + 20 min (testing) = 50 min total**

---

**App Version:** 1.0.0  
**Build Date:** July 1, 2026  
**Status:** Beta (Ready for Client Testing)
