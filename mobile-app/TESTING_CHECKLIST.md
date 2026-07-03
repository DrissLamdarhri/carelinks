# CareLink Mobile App - Client Testing Checklist

## Build & Installation
- [ ] APK successfully built (via EAS or local)
- [ ] APK installed on Android device (API 30+)
- [ ] App launches without crashes
- [ ] All permissions granted on first launch

---

## Authentication & Profile
- [ ] **Sign Up Works**
  - [ ] Email signup completes
  - [ ] Google OAuth sign-in works
  - [ ] Profile created with default avatar
  - [ ] User can see their profile

- [ ] **Avatar Upload**
  - [ ] Can upload from gallery
  - [ ] Can take new photo from camera
  - [ ] Avatar displays on profile immediately
  - [ ] Avatar persists after app restart
  - [ ] Google users see Google profile pic as fallback

- [ ] **Profile Edit**
  - [ ] Can edit full name
  - [ ] Can edit phone number
  - [ ] Can view profile completeness

---

## Booking Flow
- [ ] **Create Booking**
  - [ ] Select service type (Nurse, Physiotherapist, etc.)
  - [ ] Choose date and time
  - [ ] Enter service address or use GPS
  - [ ] Set budget range
  - [ ] Add notes/special requests
  - [ ] Booking created successfully

- [ ] **View Available Professionals**
  - [ ] Map displays pros near location
  - [ ] Pro profiles show name, rating, price
  - [ ] Can select/deselect pro from list
  - [ ] Pros display profile avatars

- [ ] **Book a Professional**
  - [ ] Can select a pro from map or list
  - [ ] Booking transitions to "Waiting for acceptance"
  - [ ] Receives confirmation

---

## Tracking (Live Delivery)
- [ ] **Tracking Screen Loads**
  - [ ] Map displays with green background
  - [ ] Pro avatar shows on map
  - [ ] Patient ("Vous") label visible
  - [ ] Purple dashed route line appears
  - [ ] ETA displays at top

- [ ] **Live Movement**
  - [ ] Pro moves smoothly along the route
  - [ ] Route is realistic (follows streets via OSRM)
  - [ ] ETA counts down in sync with distance
  - [ ] Distance updates in real-time

- [ ] **Bottom Sheet**
  - [ ] Sheet is scrollable
  - [ ] Can see all info: pro name, price, address
  - [ ] Can scroll to see action buttons
  - [ ] "Appeler" (Call) button works
  - [ ] "Message" button opens chat
  - [ ] "Terminer" (Complete) shows when arrived

- [ ] **Pro Pin Animation**
  - [ ] Pro pin floats up/down smoothly
  - [ ] Purple rim visible on pro avatar
  - [ ] Pulsing rings animate around pro

- [ ] **Visual Polish**
  - [ ] No text overlaps
  - [ ] Buttons are properly spaced
  - [ ] Icons render clearly
  - [ ] Colors match Figma design
  - [ ] Shadows and elevations look good

---

## Map & Location
- [ ] **Map Interaction**
  - [ ] Map displays Fès region correctly
  - [ ] Route polyline visible (faint purple line)
  - [ ] Patient pin shows "Vous" label
  - [ ] Close button (X) closes tracking
  - [ ] All elements visible without scroll

- [ ] **Real Route**
  - [ ] Route fetched from OSRM (real streets)
  - [ ] Not just straight line
  - [ ] Route center properly calculated
  - [ ] Route visible on map

---

## Performance
- [ ] **App Speed**
  - [ ] Launches in < 3 seconds
  - [ ] Profile loads instantly
  - [ ] Booking form responds quickly
  - [ ] Tracking screen loads < 2 seconds
  - [ ] Route fetches in ~2 seconds

- [ ] **Memory**
  - [ ] No memory leaks (app doesn't get slower after use)
  - [ ] Smooth animations (60 FPS)
  - [ ] No stuttering during tracking

- [ ] **Battery**
  - [ ] App doesn't drain battery excessively
  - [ ] GPS usage is reasonable

---

## Error Handling
- [ ] **Network Errors**
  - [ ] Graceful message if no internet
  - [ ] Retry buttons work
  - [ ] Doesn't crash on network failure

- [ ] **Input Validation**
  - [ ] Invalid email shows error
  - [ ] Empty address shows warning
  - [ ] Negative prices blocked

- [ ] **Edge Cases**
  - [ ] Very long names handled
  - [ ] Special characters in notes work
  - [ ] App survives device rotation
  - [ ] Resume from background works

---

## Device Compatibility
- [ ] **Screen Sizes**
  - [ ] Works on small phones (5-6")
  - [ ] Works on large phones (6.5-7")
  - [ ] Landscape mode works (if supported)
  - [ ] All text readable

- [ ] **Android Versions**
  - [ ] Android 11 (API 30): Works
  - [ ] Android 12 (API 31): Works
  - [ ] Android 13 (API 33): Works
  - [ ] Android 14 (API 34): Works

- [ ] **Permissions**
  - [ ] Location permission request shown
  - [ ] Camera permission for photos works
  - [ ] File access works
  - [ ] App functions if some permissions denied

---

## Bugs Found

### Critical (Blocks Usage)
- [ ] _
- [ ] _

### High (Affects Experience)
- [ ] _
- [ ] _

### Medium (Minor Issues)
- [ ] _
- [ ] _

### Low (Polish)
- [ ] _
- [ ] _

---

## Feedback & Suggestions

### What Works Well
1. _
2. _
3. _

### What Needs Improvement
1. _
2. _
3. _

### Feature Requests
1. _
2. _
3. _

### UI/UX Feedback
- [ ] Colors are appealing
- [ ] Typography is readable
- [ ] Buttons are easy to tap
- [ ] Navigation is intuitive
- [ ] Icons are clear

---

## General Comments

_

---

## Tested By
- **Name:** _
- **Device:** _ (Model, Android Version)
- **Date:** _
- **Time Spent:** _ minutes

---

## Sign-Off
- [ ] Testing complete
- [ ] All critical issues resolved or logged
- [ ] Ready for production release

---

**Next Steps:**
1. Submit this checklist back to dev team
2. Log any bugs in GitHub issues
3. Include device model and Android version in bug reports
4. Provide videos of issues if possible

**Questions?** Contact support@carelink.app
