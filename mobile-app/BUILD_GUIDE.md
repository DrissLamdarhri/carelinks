# CareLink Mobile App - Build & Installation Guide for Clients

## Overview
This document provides step-by-step instructions to build and install the CareLink mobile app on Android devices for testing and feedback.

## Prerequisites

### Option 1: Build via Expo Application Services (EAS) - Recommended, Cloud-Based
This is the easiest approach as it doesn't require Android SDK installation.

**Requirements:**
- Node.js 16+ installed
- npm or pnpm
- GitHub account (for Expo)
- ~15-30 minutes build time

**Steps:**
1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```

2. Authenticate with Expo (one-time):
   ```bash
   eas login
   # Follow the prompts to log in or create an Expo account
   ```

3. Build the preview APK:
   ```bash
   cd mobile-app
   eas build --platform android --profile preview
   ```

4. The command will output a URL. Open it in your browser to:
   - Monitor the build progress
   - Download the APK once build completes (~15-30 min)

5. Transfer the APK to your Android device and install:
   ```bash
   adb install app-release.apk
   # Or: manually transfer the APK file and tap to install
   ```

---

### Option 2: Local Build - Fast, Requires Android SDK

**Requirements:**
- Node.js 16+
- Java JDK 17+
- Android SDK (API 31+)
- 5-10 GB disk space
- ~10 minutes build time

**Environment Setup:**
```bash
# Set Android SDK path (add to ~/.bashrc or ~/.zshrc for persistence)
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/tools/bin:$ANDROID_HOME/platform-tools
```

**Build Steps:**
1. Navigate to mobile-app directory:
   ```bash
   cd mobile-app
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Prebuild Android native code:
   ```bash
   npx expo prebuild --platform android --clean
   ```

4. Build the release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

5. The APK will be generated at:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

6. Install on device:
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```

---

## Installation Methods

### Method A: Using ADB (Android Debug Bridge)
```bash
# Install APK
adb install path/to/app-release.apk

# Verify installation
adb shell pm list packages | grep carelink
```

### Method B: Manual Installation
1. Transfer the APK file to your Android device (via USB, email, cloud storage)
2. Open the file manager on the device
3. Locate and tap the APK file
4. Follow the installation prompts
5. Grant necessary permissions (location, files, etc.)

### Method C: Via Android Studio
1. Open Android Studio
2. Go to **Run → Select Device Configuration → Install APK**
3. Browse and select the APK file
4. Choose your device and click Install

---

## First Launch & Testing

### Required Permissions
On first launch, the app will request:
- **Location (GPS)** - For booking location and tracking
- **Photo/File Access** - For profile picture upload
- **Camera** - For photo capture during profile setup

**Grant these permissions for full functionality.**

### Demo Flow (Testing)
1. **Sign up/Login** via Google OAuth or email
2. **Create a booking** - Select service (Nurse, Physiotherapist, etc.) and location
3. **View available pros** - See nurses/pros on the map
4. **Book a pro** - Select a provider and confirm
5. **Tracking** - Watch real-time tracking with animated route and ETA

### Real Features Tested
✓ Profile sync (name, avatar, role)  
✓ Avatar upload from gallery/camera  
✓ Google OAuth avatar fallback  
✓ Live tracking with real OSRM routing  
✓ Speed-based ETA calculation  
✓ Smooth map interaction  
✓ Scrollable booking sheet  

---

## Troubleshooting

### Build Issues

**"React Native is not installed"**
```bash
cd mobile-app
pnpm install
```

**Gradle timeout during download**
- Check internet connection
- Retry: `./gradlew clean && ./gradlew assembleRelease`
- Or use a VPN if services are blocked

**Java version mismatch**
```bash
java -version  # Should be 11+
# If not, install JDK 17:
# Ubuntu: sudo apt-get install openjdk-17-jdk
# macOS: brew install openjdk@17
```

### Installation Issues

**"App installation failed"**
- Ensure Android 10+ (API 30+)
- Check disk space on device (>100MB free)
- Try: `adb install -r app-release.apk` (force replace)

**"Cannot connect to Supabase"**
- Ensure internet connection
- Check if Supabase project is active
- Verify API keys in `/lib/supabase.ts`

**"Location permission denied"**
- Go to Settings → Apps → CareLink → Permissions → Location
- Enable "Allow only while using the app"

---

## Server Setup (Supabase)

Before testing real features:

### 1. Create Avatars Storage Bucket
Run this SQL in Supabase SQL editor:
```sql
-- Block 6: Create avatars bucket and policies
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Avatar upload policy" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar read policy" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
```

### 2. Create Profiles RLS Policy
```sql
CREATE POLICY "profiles_self_write" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id)
  FOR UPDATE USING (auth.uid() = id);
```

### 3. Database Tables
Ensure these exist in Supabase:
- `profiles` - User profiles with avatars
- `bookings` - Booking records with location
- `professionals` - Pro info
- `locations` - Geo data (via RPC)

---

## Performance Notes

- First app launch: ~2 seconds (cold start)
- Route fetching: ~2 seconds (OSRM API)
- ETA updates: Every 1 second (live sync)
- Avatar load: ~500ms (with cache-busting)

---

## Feedback

Please report issues to the development team with:
- Device model and Android version
- Steps to reproduce the issue
- Screenshots/videos if applicable
- Console logs (via `adb logcat`)

---

## Support

For questions or issues, contact:
- **Email:** support@carelink.app
- **Issues:** GitHub repo issues section
- **Documentation:** See PROJECT_SUMMARY.md

---

**Version:** 1.0.0  
**Last Updated:** July 1, 2026  
**Build Date:** 2026-07-01
