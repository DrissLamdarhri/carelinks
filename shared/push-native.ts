// /**
//  * CareLink — Expo Push Notifications helper.
//  * Replaces the web-push VAPID approach in src/lib/push.ts.
//  *
//  * Requires in mobile/package.json:
//  *   expo-notifications, expo-device, expo-constants
//  *
//  * Requires SQL (run in Supabase):
//  *   alter table push_subscriptions
//  *     add column if not exists expo_push_token text,
//  *     add column if not exists platform text;
//  */

// import { Platform } from "react-native";
// import { supabase } from "./supabase";

// // Lazy imports — only available in Expo environment
// type NotificationsModule = typeof import("expo-notifications");
// type DeviceModule = typeof import("expo-device");
// type ExpoConstants = {
//   appOwnership?: string | null;
//   executionEnvironment?: string | null;
// };

// let Notifications: NotificationsModule | null = null;
// let Device: DeviceModule | null = null;
// let Constants: ExpoConstants | null = null;

// try {
//   Notifications = require("expo-notifications");
//   Device = require("expo-device");
//   Constants = require("expo-constants").default as ExpoConstants;
// } catch (error) {
//   // Not in Expo env (unit tests, web admin portal, or Expo Go without remote notifications)
//   console.warn(
//     "[push-native] Notifications not available:",
//     error instanceof Error ? error.message : String(error)
//   );
// }

// const isExpoGo =
//   Constants?.appOwnership === "expo" ||
//   Constants?.executionEnvironment === "storeClient";

// /**
//  * Request permission and register the device's Expo push token
//  * in the `push_subscriptions` table.
//  *
//  * Call this once after the user has signed in.
//  */
// export async function registerExpoPushToken(userId: string): Promise<void> {
//   if (isExpoGo) return;
//   if (!Notifications || !Device) return;
//   if (!Device.isDevice) {
//     console.log("Push notifications only work on physical devices.");
//     return;
//   }

//   const { status: existingStatus } =
//     await Notifications.getPermissionsAsync();
//   let finalStatus = existingStatus;

//   if (existingStatus !== "granted") {
//     const { status } = await Notifications.requestPermissionsAsync();
//     finalStatus = status;
//   }

//   if (finalStatus !== "granted") {
//     console.log("Push notification permission denied.");
//     return;
//   }

//   const tokenData = await Notifications.getExpoPushTokenAsync({
//     // Replace with your Expo project ID from app.json → extra.eas.projectId
//     // projectId: Constants.expoConfig?.extra?.eas?.projectId,
//   });

//   const token = tokenData.data;

//   await supabase.from("push_subscriptions").upsert(
//     {
//       user_id: userId,
//       expo_push_token: token,
//       platform: Platform.OS,
//     },
//     { onConflict: "user_id" }
//   );
// }

// /**
//  * Configure notification handling behaviour (call once at app startup).
//  */
// export function configureNotifications() {
//   if (isExpoGo) return;
//   if (!Notifications) return;

//   Notifications.setNotificationHandler({
//     handleNotification: async () => ({
//       shouldPlaySound: true,
//       shouldSetBadge: true,
//       shouldShowBanner: true,
//       shouldShowList: true,
//     }),
//   });
// }
export async function registerExpoPushToken(_userId: string): Promise<void> {}
export function configureNotifications(): void {}