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
