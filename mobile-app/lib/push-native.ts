// /**
//  * CareLink — Expo Push Notifications helper for React Native
//  * Handles push tokens, permissions, notification configuration
//  */

// import Constants from "expo-constants";
// import { Platform } from "react-native";
// import { supabase } from "./supabase";

// type NotificationsModule = typeof import("expo-notifications");
// type DeviceModule = typeof import("expo-device");

// const isExpoGo =
//   Constants.appOwnership === "expo" ||
//   Constants.executionEnvironment === "storeClient";

// async function loadNotificationsModules() {
//   if (isExpoGo) {
//     return null;
//   }

//   try {
//     const Notifications = require("expo-notifications") as NotificationsModule;
//     const Device = require("expo-device") as DeviceModule;
//     return { Notifications, Device };
//   } catch (error) {
//     console.warn(
//       "[push-native] Notifications not available:",
//       error instanceof Error ? error.message : String(error)
//     );
//     return null;
//   }
// }

// export async function registerExpoPushToken(userId: string): Promise<void> {
//   const modules = await loadNotificationsModules();
//   if (!modules) return; // Expo Go / module unavailable

//   const { Notifications, Device } = modules;
//   if (!Device.isDevice) return; // emulator — no push

//   try {
//     const { status: existingStatus } =
//       await Notifications.getPermissionsAsync();
//     let finalStatus = existingStatus;

//     if (existingStatus !== "granted") {
//       const { status } = await Notifications.requestPermissionsAsync();
//       finalStatus = status;
//     }

//     if (finalStatus !== "granted") {
//       console.log("Push notification permission denied.");
//       return;
//     }

//     // EAS builds require the projectId to mint a push token.
//     const projectId =
//       (Constants.expoConfig?.extra as any)?.eas?.projectId ??
//       (Constants as any)?.easConfig?.projectId;
//     const tokenData = await Notifications.getExpoPushTokenAsync(
//       projectId ? { projectId } : undefined
//     );
//     const token = tokenData.data;

//     const { error } = await supabase.from("push_subscriptions").upsert({
//       user_id: userId,
//       expo_push_token: token,
//       platform: Platform.OS,
//       updated_at: new Date().toISOString(),
//     } as any);
//     if (error) console.warn("[push] token upsert failed:", error.message);
//     else console.log("[push] notifications registered ✓");
//   } catch (error) {
//     console.warn("[push] register FAILED:", error instanceof Error ? error.message : String(error));
//   }
// }

// /** Fires when the user taps a push notification. Returns the notification's data payload. */
// export function addNotificationTapListener(
//   handler: (data: Record<string, unknown>) => void
// ): { remove: () => void } {
//   if (isExpoGo) return { remove: () => {} };
//   try {
//     const Notifications = require("expo-notifications") as NotificationsModule;
//     const sub = Notifications.addNotificationResponseReceivedListener((response) => {
//       handler((response?.notification?.request?.content?.data ?? {}) as Record<string, unknown>);
//     });
//     return sub;
//   } catch {
//     return { remove: () => {} };
//   }
// }

// export function configureNotifications() {
//   if (isExpoGo) return;

//   void loadNotificationsModules().then((modules) => {
//     if (!modules) return;

//     try {
//       modules.Notifications.setNotificationHandler({
//         handleNotification: async () => ({
//           shouldPlaySound: true,
//           shouldSetBadge: true,
//           shouldShowAlert: true,
//           shouldShowBanner: true,
//           shouldShowList: true,
//         }),
//       });
//     } catch (error) {
//       console.warn("Failed to configure notifications:", error);
//     }
//   });
// }
/**
 * CareLink — Expo Push Notifications helper for React Native
 * Handles push tokens, permissions, notification configuration
 */

import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

type NotificationsModule = typeof import("expo-notifications");
type DeviceModule = typeof import("expo-device");

const isExpoGo =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";

async function loadNotificationsModules() {
  if (isExpoGo) {
    return null;
  }

  try {
    const Notifications = require("expo-notifications") as NotificationsModule;
    const Device = require("expo-device") as DeviceModule;
    return { Notifications, Device };
  } catch (error) {
    console.warn(
      "[push-native] Notifications not available:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function registerExpoPushToken(userId: string): Promise<void> {
  const modules = await loadNotificationsModules();
  if (!modules) return; // Expo Go / module unavailable

  const { Notifications, Device } = modules;
  if (!Device.isDevice) return; // emulator — no push

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission denied.");
      return;
    }

    // EAS builds require the projectId to mint a push token.
    const projectId =
      (Constants.expoConfig?.extra as any)?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;

    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    } as any);
    if (error) console.warn("[push] token upsert failed:", error.message);
    else console.log("[push] notifications registered ✓");
  } catch (error) {
    console.warn("[push] register FAILED:", error instanceof Error ? error.message : String(error));
  }
}

/** Fires when the user taps a push notification. Returns the notification's data payload. */
export function addNotificationTapListener(
  handler: (data: Record<string, unknown>) => void
): { remove: () => void } {
  if (isExpoGo) return { remove: () => {} };
  try {
    const Notifications = require("expo-notifications") as NotificationsModule;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handler((response?.notification?.request?.content?.data ?? {}) as Record<string, unknown>);
    });
    return sub;
  } catch {
    return { remove: () => {} };
  }
}

export function configureNotifications() {
  if (isExpoGo) return;

  void loadNotificationsModules().then((modules) => {
    if (!modules) return;

    try {
      modules.Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch (error) {
      console.warn("Failed to configure notifications:", error);
    }
  });
}

// ─── Professional demand notifications ────────────────────────────────────────

const SPECIALTY_LABELS: Record<string, string> = {
  nurse: "Infirmier(ère)",
  physiotherapist: "Kinésithérapeute",
  psychologist: "Psychologue",
  yoga_instructor: "Coach Yoga",
};

/**
 * Fires an immediate local push when a new demand arrives matching the pro's
 * specialty. Works while the app is in the foreground (trigger: null = instant).
 * For background delivery, pair with the Supabase Edge Function
 * `supabase/functions/notify-pro-demand` that calls the Expo Push API directly.
 */
export async function scheduleLocalDemandNotification(specialty: string): Promise<void> {
  const modules = await loadNotificationsModules();
  if (!modules) return;
  const { Notifications } = modules;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📋 Nouvelle demande",
        body: `Un(e) ${SPECIALTY_LABELS[specialty] ?? specialty} est demandé(e) près de vous`,
        data: { type: "new_demand", specialty },
        sound: true,
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.warn(
      "[push] scheduleLocalDemandNotification failed:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Inserts a row into the `notifications` table so the NotificationBell
 * displays the new demand even after the foreground alert is dismissed.
 */
export async function insertProDemandNotification(
  userId: string,
  bookingId: string,
  specialty: string
): Promise<void> {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      kind: "new_demand",
      title: "Nouvelle demande",
      body: `Un patient cherche un(e) ${SPECIALTY_LABELS[specialty] ?? specialty} — Répondez maintenant`,
      data: { booking_id: bookingId, specialty },
    } as any);
    if (error) console.warn("[push] insertProDemandNotification failed:", error.message);
  } catch (error) {
    console.warn(
      "[push] insertProDemandNotification error:",
      error instanceof Error ? error.message : String(error)
    );
  }
}