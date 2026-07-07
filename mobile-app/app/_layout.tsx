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
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DMSans_400Regular, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { addNotificationTapListener, configureNotifications } from "@/lib/push-native";
import { ToastHost } from "@/components/ToastHost";
import { useAuth } from "@/lib/auth-context";

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

/** Tapping a push opens the relevant booking (role-aware). */
function PushTapHandler() {
  const router = useRouter();
  const { role } = useAuth();

  useEffect(() => {
    const sub = addNotificationTapListener((data) => {
      const bookingId = typeof data?.booking_id === "string" ? data.booking_id : null;
      if (!bookingId) return;
      const base = role === "pro" ? "/pro/tracking" : "/patient/tracking";
      router.push(`${base}/${bookingId}`);
    });
    return () => sub.remove();
  }, [router, role]);

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
      <I18nProvider>
        <SafeAreaProvider>
          {fontsLoaded ? (
            <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="patient" options={{ headerShown: false }} />
                <Stack.Screen name="pro" options={{ headerShown: false }} />
                <Stack.Screen name="admin" options={{ headerShown: false }} />
              </Stack>
            </SafeAreaView>
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
          {/* Routes push-notification taps to the right booking */}
          <PushTapHandler />
          {/* Branded toast notifications (overlays everything) */}
          <ToastHost />
        </SafeAreaProvider>
      </I18nProvider>
    </AuthProvider>
    </GestureHandlerRootView>
  );
}
