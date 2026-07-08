import React from "react";
import { View } from "react-native";
import { useI18n } from "@/lib/i18n";
import { LaunchLanguage } from "./LaunchLanguage";

/**
 * Applies the current text direction to the whole app subtree (instant, no
 * restart) and shows the language picker on first launch.
 */
export function LocaleGate({ children }: { children: React.ReactNode }) {
  const { dir, hasChosen, ready } = useI18n();
  if (ready && !hasChosen) return <LaunchLanguage />;
  return <View style={{ flex: 1, direction: dir }}>{children}</View>;
}
