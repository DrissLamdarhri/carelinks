# CareLink — Web → React Native Migration Guide

> **Target repo:** `https://github.com/incaresupport-creator/inCare.git`  
> **Bundle ID:** `ma.carelink.app`  
> **Stack:** Expo SDK 53 · expo-router v4 · NativeWind v4 · Supabase JS v2

---

## 0. Monorepo layout after migration

```
inCare/
├── src/                          # ← existing web app (admin portal — UNTOUCHED)
├── supabase/                     # ← SQL + Edge Functions (shared)
├── shared/                       # ← NEW: framework-agnostic logic
│   ├── package.json
│   ├── supabase.ts               # RN-safe Supabase client (AsyncStorage)
│   ├── auth-context.tsx          # RN-safe AuthProvider
│   ├── i18n.ts                   # RN-safe i18n (AsyncStorage)
│   └── db/
│       ├── types.ts              # copy of src/lib/db/types.ts (pure TS)
│       ├── dal.ts                # copy of src/lib/db/dal.ts (pure Supabase JS)
│       └── realtime.ts           # copy of src/lib/db/realtime.ts (React hooks only)
├── mobile/                       # ← NEW: Expo app
│   ├── app.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── tailwind.config.js
│   ├── global.css
│   └── app/
│       ├── _layout.tsx           # Root: AuthProvider + I18nProvider
│       ├── (auth)/
│       │   ├── _layout.tsx
│       │   └── login.tsx         # Google + email/password side-by-side
│       ├── (patient)/
│       │   ├── _layout.tsx       # Bottom tab navigator
│       │   ├── index.tsx         # PatientDashboard
│       │   ├── new-booking.tsx   # Booking flow (specialty → budget → schedule)
│       │   ├── waiting-offers/
│       │   │   └── [bookingId].tsx  # Real-time bids feed
│       │   ├── chat/
│       │   │   └── [bookingId].tsx  # Live chat
│       │   ├── profile.tsx
│       │   └── yoga.tsx          # Yoga catalog + enrollment
│       └── (pro)/
│           ├── _layout.tsx       # Bottom tab navigator
│           ├── index.tsx         # ProDashboard (open bookings feed)
│           ├── open-bookings.tsx # Specialty-filtered feed
│           ├── submit-bid/
│           │   └── [bookingId].tsx
│           ├── my-bids.tsx
│           ├── earnings.tsx
│           ├── kyc.tsx           # Document upload (expo-image-picker)
│           └── profile.tsx
├── pnpm-workspace.yaml           # updated to include shared + mobile
└── package.json                  # root (unchanged)
```

---

## 1. Update `pnpm-workspace.yaml`

```yaml
packages:
  - '.'
  - 'shared'
  - 'mobile'
```

---

## 2. Key differences — Web vs React Native

| Concern | Web (`src/`) | Mobile (`mobile/`) |
|---|---|---|
| Storage | `localStorage` | `AsyncStorage` / `expo-secure-store` |
| Routing | `react-router` | `expo-router` (file-based) |
| Styling | Tailwind CSS v4 | NativeWind v4 (same classes, RN primitives) |
| Auth redirect | `window.location.origin` | `makeRedirectUri({ scheme })` |
| Session detect | `detectSessionInUrl: true` | `detectSessionInUrl: false` |
| RTL | `document.dir = 'rtl'` | `I18nManager.forceRTL(true)` |
| Push | Web Push API / VAPID | `expo-notifications` + APNs/FCM |
| Maps | `leaflet` / `google-maps-js` | `react-native-maps` |
| File upload | `<input type="file">` | `expo-image-picker` + `expo-document-picker` |
| Animations | CSS / Motion | `react-native-reanimated` |
| Charts | `recharts` | `victory-native` or `react-native-gifted-charts` |
| Google OAuth | `supabase.auth.signInWithOAuth` (redirect) | `expo-auth-session` + `WebBrowser` |

---

## 3. Supabase — What changes

### `shared/supabase.ts` (replaces `src/lib/supabase.ts`)

```ts
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,          // ← key change
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,       // ← key change
      flowType: "pkce",
    },
  }
);
```

Create `mobile/.env` (gitignored):
```
EXPO_PUBLIC_SUPABASE_URL=https://wjhzrovmktekfcjohhrw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 4. Google OAuth in React Native

```tsx
// In shared/auth-context.tsx
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession(); // call at module level

const signInWithGoogle = async (role: "patient" | "pro" = "patient") => {
  const redirectTo = makeRedirectUri({ scheme: "ma.carelink.app" });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
  // open the URL in system browser
  if (data.url) await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
};
```

**`app.json` scheme** must match:
```json
{ "expo": { "scheme": "ma.carelink.app" } }
```

**Supabase Dashboard → Auth → URL Configuration:**
- Add `ma.carelink.app://` to Redirect URLs

---

## 5. Deep-link handler in `mobile/app/_layout.tsx`

```tsx
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { supabase } from "../../shared/supabase";

// Inside root layout component:
useEffect(() => {
  const sub = Linking.addEventListener("url", async ({ url }) => {
    await supabase.auth.exchangeCodeForSession(
      new URL(url).searchParams.get("code") ?? ""
    );
  });
  return () => sub.remove();
}, []);
```

---

## 6. Navigation structure (expo-router)

### Patient tabs
```
(patient)/
  _layout.tsx   → <Tabs> with 4 tabs: Home | Bookings | Chat | Profile
  index.tsx     → service picker + nearby pros
  new-booking   → multi-step form
  waiting-offers/[bookingId] → live bids
  chat/[bookingId] → live chat
  profile       → edit profile + language picker
  yoga          → yoga catalog
```

### Pro tabs
```
(pro)/
  _layout.tsx   → <Tabs> with 4 tabs: Feed | Bids | Earnings | Profile
  index.tsx     → open bookings feed (real-time)
  submit-bid/[bookingId] → bid form
  my-bids       → pending/accepted bids
  earnings      → earnings summary
  kyc           → document upload
  profile       → pro profile + availability toggle
```

---

## 7. NativeWind setup

### `mobile/tailwind.config.js`
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "../../shared/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary:    "#0D0870",
        "primary-light": "#1A1585",
        surface:    "#EDE5CC",
        mid:        "#5BB8D4",
        accent:     "#8ECFDF",
        muted:      "#888780",
      },
      borderRadius: { xl: "16px" },
      fontFamily: {
        sans:   ["DMSans_400Regular"],
        serif:  ["DMSerifDisplay_400Regular"],
      },
    },
  },
  plugins: [],
};
```

### `mobile/global.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### `mobile/babel.config.js`
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

### `mobile/metro.config.js`
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

---

## 8. Expo Notifications (replaces Web Push)

```ts
// shared/push-native.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { supabase } from "./supabase";

export async function registerPushToken(userId: string) {
  if (!Device.isDevice) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await supabase.from("push_subscriptions").upsert({
    user_id: userId,
    expo_push_token: token,
    platform: Platform.OS,
  });
}
```

**SQL addition needed** in `supabase/push.sql`:
```sql
alter table push_subscriptions
  add column if not exists expo_push_token text,
  add column if not exists platform text;
```

---

## 9. KYC Document Upload (replaces `KycUploader.tsx`)

```tsx
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

const pickAndUpload = async (docType: string) => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
  });
  if (result.canceled) return;
  const file = result.assets[0];
  const path = `kyc/${userId}/${docType}_${Date.now()}.${file.name.split(".").pop()}`;
  const { error } = await supabase.storage
    .from("pro-documents")
    .upload(path, { uri: file.uri, type: file.mimeType, name: file.name });
  if (error) throw error;
  await db.proDocuments.create({ professional_id: userId, doc_type: docType, storage_path: path });
};
```

---

## 10. Maps — `react-native-maps`

```tsx
import MapView, { Marker, Circle } from "react-native-maps";

// Replace BookingMap.tsx's Leaflet map with:
<MapView
  style={{ flex: 1 }}
  initialRegion={{
    latitude: 33.589886,   // Casablanca default
    longitude: -7.603869,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }}
>
  <Marker coordinate={{ latitude, longitude }} />
  <Circle center={{ latitude, longitude }} radius={serviceRadius * 1000} />
</MapView>
```

Config in `app.json`:
```json
{
  "expo": {
    "plugins": [
      ["react-native-maps", {
        "googleMapsApiKey": "YOUR_GOOGLE_MAPS_API_KEY"
      }]
    ]
  }
}
```

---

## 11. RTL (Arabic) support

```ts
// In shared/i18n.ts — replace document.dir with:
import { I18nManager } from "react-native";

// When locale changes to 'ar':
I18nManager.forceRTL(true);
// Requires app restart → use expo-updates to reload
import * as Updates from "expo-updates";
await Updates.reloadAsync();
```

---

## 12. Fonts

```ts
// mobile/app/_layout.tsx
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSerifDisplay_400Regular,
  });
  // hide splash when ready
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);
  if (!fontsLoaded) return null;
  // ...
}
```

Additional packages needed:
```bash
npx expo install @expo-google-fonts/dm-sans @expo-google-fonts/dm-serif-display
```

---

## 13. Complete `mobile/package.json` dependencies

```json
{
  "dependencies": {
    "@expo-google-fonts/dm-sans": "^0.2.3",
    "@expo-google-fonts/dm-serif-display": "^0.2.3",
    "@react-native-async-storage/async-storage": "^2.1.2",
    "@supabase/supabase-js": "^2.105.1",
    "expo": "~53.0.0",
    "expo-auth-session": "^6.0.3",
    "expo-constants": "~17.0.7",
    "expo-crypto": "~14.0.2",
    "expo-device": "~7.0.3",
    "expo-document-picker": "~13.0.3",
    "expo-font": "~13.3.1",
    "expo-image-picker": "~16.1.4",
    "expo-linking": "~7.0.5",
    "expo-location": "~18.1.5",
    "expo-notifications": "~0.29.14",
    "expo-router": "~4.0.17",
    "expo-secure-store": "~14.0.1",
    "expo-splash-screen": "~0.29.22",
    "expo-status-bar": "~2.2.3",
    "expo-updates": "~0.26.13",
    "expo-web-browser": "~14.0.2",
    "lucide-react-native": "^0.475.0",
    "nativewind": "^4.1.23",
    "react": "18.3.2",
    "react-native": "0.76.9",
    "react-native-maps": "^1.20.1",
    "react-native-reanimated": "~3.16.1",
    "react-native-safe-area-context": "4.14.0",
    "react-native-screens": "~4.4.0",
    "react-native-svg": "15.10.1",
    "tailwindcss": "^3.4.17"
  }
}
```

---

## 14. EAS Build configuration

```bash
npm install -g eas-cli
cd mobile
eas init --id ma.carelink.app
eas build:configure
```

`mobile/eas.json`:
```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## 15. Step-by-step execution checklist

```
[ ] 1. git clone https://github.com/incaresupport-creator/inCare.git
[ ] 2. Update pnpm-workspace.yaml (add shared + mobile)
[ ] 3. Copy shared/ scaffold → `pnpm install` from repo root
[ ] 4. Copy mobile/ scaffold → `cd mobile && npx expo install`
[ ] 5. Create mobile/.env with Supabase URL + anon key
[ ] 6. Add ma.carelink.app:// to Supabase Auth redirect URLs
[ ] 7. Configure Google OAuth → add ma.carelink.app:// as redirect in GCP Console
[ ] 8. Run: `cd mobile && npx expo start --clear`
[ ] 9. Test on iOS Simulator + Android Emulator
[  ] 10. Run `eas build --platform all --profile development` for device testing
[ ] 11. For production → `eas build --platform all --profile production`
[ ] 12. Submit → `eas submit`
```

---

## 16. Shared types compatibility

The following files are **100% compatible** with React Native as-is (pure TypeScript / pure Supabase JS calls):

- `src/lib/db/types.ts` → copy to `shared/db/types.ts`
- `src/lib/db/dal.ts` → copy to `shared/db/dal.ts` (update supabase import path)
- `src/lib/db/realtime.ts` → copy to `shared/db/realtime.ts` (update supabase import path)

Only change: update the import at the top of each file:
```ts
// Before (web):
import { supabase } from "../supabase";

// After (shared):
import { supabase } from "../supabase"; // points to shared/supabase.ts
```

---

## 17. Screen → component mapping

| Web component | Mobile screen | Notes |
|---|---|---|
| `PatientDashboard.tsx` | `(patient)/index.tsx` | Service grid → 2-col FlatList |
| `NurseDashboard.tsx` | `(pro)/index.tsx` | FlatList feed |
| `WaitingOffers.tsx` | `(patient)/waiting-offers/[id].tsx` | Same realtime hook |
| `ChatScreen.tsx` | `(patient)/chat/[id].tsx` | FlatList + TextInput |
| `NurseBooking.tsx` | `(pro)/submit-bid/[id].tsx` | Form |
| `NurseOffers.tsx` | `(pro)/my-bids.tsx` | FlatList |
| `NurseEarnings.tsx` | `(pro)/earnings.tsx` | ScrollView + stats |
| `KycUploader.tsx` | `(pro)/kyc.tsx` | expo-document-picker |
| `RatingForm.tsx` | `(patient)/rate/[bookingId].tsx` | Star picker |
| `YogaCatalog.tsx` | `(patient)/yoga.tsx` | FlatList |
| `ProfileScreen.tsx` | `(patient)/profile.tsx` | Form |
| `NurseProfile.tsx` | `(pro)/profile.tsx` | Form + avatar |
| `BookingMap.tsx` | Inline in booking screens | react-native-maps |
| `LiveChat.tsx` | Reuse hook in chat screen | Same realtime hook |
| `Onboarding.tsx` | `(auth)/onboarding.tsx` | PagerView slides |
| `PatientAuth.tsx` | `(auth)/login.tsx` | Google + email |
| `ProLogin.tsx` | `(auth)/login.tsx` | Same screen, role param |

---

*The scaffold code for all files listed above is in `shared/` and `mobile/` directories of this repo.*
