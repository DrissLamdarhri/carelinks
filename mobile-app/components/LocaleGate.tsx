import React from "react";
import { View } from "react-native";
import { useI18n } from "@/lib/i18n";

/**
 * Applies the current text direction to the whole app subtree (instant, no
 * restart). The app defaults to French; there is no first-launch language
 * screen — language is switched from the button on the very first auth screen,
 * so a dedicated picker screen would be redundant.
 */
export function LocaleGate({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();
  return <View style={{ flex: 1, direction: dir }}>{children}</View>;
}
