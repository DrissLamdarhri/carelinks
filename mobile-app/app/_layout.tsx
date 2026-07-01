/**
 * CareLink — Root Layout
 * ─────────────────────────────────────────────────────────────────────────────
 * Added vs old version:
 *   • Linking.addEventListener("url", ...) — handles the case where the app
 *     is ALREADY open when Google redirects back. Without this, the deep-link
 *     fires but nothing navigates to /auth/callback and the user is stuck.
 *   • When the URL matches our OAuth callback pattern we push /auth/callback
 *     so the callback screen does the code-exchange.
 */

import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { DMSans_400Regular, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { configureNotifications } from "@/lib/push-native";

SplashScreen.preventAutoHideAsync();
configureNotifications();

function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // Case A: app was CLOSED, opened via deep-link (handled by callback screen itself)
    // Case B: app was OPEN in background — we need to push the callback screen
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (url.includes("auth/callback")) {
        // Push to callback with the incoming URL so code exchange works reliably
        router.push({
          pathname: "/auth/callback",
          params: { oauthUrl: encodeURIComponent(url) },
        });
      }
    });

    return () => subscription.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSerifDisplay_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  return (
    <AuthProvider>
      <I18nProvider>
        {fontsLoaded ? (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="patient" options={{ headerShown: false }} />
            <Stack.Screen name="pro" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0D0870",
            }}
          >
            <ActivityIndicator size="large" color="#EDE5CC" />
          </View>
        )}
        {/* Handles deep-links when app is already running in background */}
        <DeepLinkHandler />
      </I18nProvider>
    </AuthProvider>
  );
}
