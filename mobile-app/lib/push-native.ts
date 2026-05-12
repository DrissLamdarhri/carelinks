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
  if (!modules) return;

  const { Notifications, Device } = modules;
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
