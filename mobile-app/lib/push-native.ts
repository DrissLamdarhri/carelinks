/**
 * CareLink — Expo Push Notifications helper for React Native
 * Handles push tokens, permissions, notification configuration
 */

import { Platform } from "react-native";
import { supabase } from "./supabase";

type NotificationsModule = typeof import("expo-notifications");
type DeviceModule = typeof import("expo-device");

let Notifications: NotificationsModule | null = null;
let Device: DeviceModule | null = null;

try {
  Notifications = require("expo-notifications");
  Device = require("expo-device");
} catch (error) {
  console.warn(
    "[push-native] Notifications not available:",
    error instanceof Error ? error.message : String(error)
  );
}

const isExpoGo =
  typeof global !== "undefined" &&
  global.navigator &&
  typeof global.navigator.userAgent === "string";

export async function registerExpoPushToken(userId: string): Promise<void> {
  if (isExpoGo || !Notifications || !Device) return;
  if (!Device.isDevice) {
    console.log("Push notifications only work on physical devices.");
    return;
  }

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

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
    } as any);
  } catch (error) {
    console.warn("Failed to register push token:", error);
  }
}

export function configureNotifications() {
  if (isExpoGo || !Notifications) return;

  try {
    Notifications.setNotificationHandler({
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
}
