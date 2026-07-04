/**
 * CareLink — lightweight haptics.
 *
 * Uses React Native's built-in Vibration (no extra native dependency, so it
 * works in Expo Go and needs no rebuild). Subtle "tap" feedback is Android-only
 * (iOS's Vibration API can't do a soft tap); the success buzz fires on both.
 *
 * Upgrade path: swap the internals for `expo-haptics` once it's installed for
 * true iOS impact/selection feedback — callers don't change.
 */
import { Platform, Vibration } from "react-native";

export const haptics = {
  /** Light tap — e.g. dropping a pin / using GPS. Android only. */
  light() {
    if (Platform.OS === "android") Vibration.vibrate(10);
  },
  /** Selection tick — e.g. selecting a pro pin. Android only. */
  select() {
    if (Platform.OS === "android") Vibration.vibrate(8);
  },
  /** Success — e.g. the professional has arrived. Both platforms. */
  success() {
    Vibration.vibrate(Platform.OS === "ios" ? 400 : [0, 30, 45, 30]);
  },
};
