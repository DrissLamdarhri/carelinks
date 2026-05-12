/**
 * Root layout — wraps the entire app with:
 *   AuthProvider, I18nProvider, safe-area, fonts, deep-link handler
 */

import "../global.css";

import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import {
  DMSans_400Regular,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFonts } from "expo-font";

import { AuthProvider } from "../../shared/auth-context";
import { I18nProvider } from "../../shared/i18n";
import { supabase } from "../../shared/supabase";

// Prevent the splash screen from auto-hiding before fonts load
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSerifDisplay_400Regular,
  });

  // Hide splash once fonts are ready
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // ── Deep-link handler: exchange OAuth code for session ────────────────────
  useEffect(() => {
    const handleUrl = async (url: string) => {
      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      } catch {
        // malformed URL — ignore
      }
    };

    // Handle the URL that opened the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Handle URL while app is running (warm start)
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <I18nProvider>
        {fontsLoaded ? (
          <Slot />
        ) : (
          <View className="flex-1 items-center justify-center bg-primary">
            <ActivityIndicator size="large" color="#EDE5CC" />
          </View>
        )}
      </I18nProvider>
    </AuthProvider>
  );
}
