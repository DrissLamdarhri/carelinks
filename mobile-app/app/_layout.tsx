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
import { LocaleGate } from "@/components/LocaleGate";
import { useAuth } from "@/lib/auth-context";
import { YogaReminderModalHost } from "@/components/YogaReminderModal";
import { showYogaReminderPopup } from "@/lib/yoga-reminder-popup";
import { AppAlertHost } from "@/components/AppAlertHost";
import { TermsGate } from "@/components/TermsGate";
import { syncPendingAcceptance } from "@/lib/terms";
import { useI18n } from "@/lib/i18n";
import { reconcileLiveLocationOnStartup } from "@/lib/live-location";
import { DevBenchLauncher } from "@/components/DevBenchLauncher";

SplashScreen.preventAutoHideAsync();
configureNotifications();
// Importing this module registers the background location task. It MUST happen
// at the app entry, not inside a screen: the OS can relaunch the app headless
// straight into the task, with no component ever mounting.
void reconcileLiveLocationOnStartup();

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

/**
 * The launch gate runs before anyone is signed in, so acceptance can only be
 * written to the device at that point. This carries it into the database the
 * moment a session exists — otherwise the only proof of consent would live on
 * the user's phone, which is exactly where it is no use in a dispute.
 */
function TermsSync() {
  const { user, role } = useAuth();
  const { locale } = useI18n();
  useEffect(() => {
    if (!user?.id) return;
    void syncPendingAcceptance(locale, role);
  }, [user?.id, role, locale]);
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
      // The yoga class reminder (migration 0042) has no pro en route to
      // track — a live map is the wrong destination for it. Show the recap
      // popup instead of navigating into a tracking screen that doesn't
      // apply.
      if (data?.type === "yoga_class_reminder") {
        showYogaReminderPopup(bookingId);
        return;
      }
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
            <LocaleGate>
              {/* Inside LocaleGate so the terms render RTL in Arabic, and above
                  the Stack so there is no route that reaches around them. */}
              <TermsGate>
                <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="auth" options={{ headerShown: false }} />
                    <Stack.Screen name="patient" options={{ headerShown: false }} />
                    <Stack.Screen name="pro" options={{ headerShown: false }} />
                    <Stack.Screen name="admin" options={{ headerShown: false }} />
                  </Stack>
                </SafeAreaView>
                <TermsSync />
              </TermsGate>
            </LocaleGate>
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
          {/* Dev-only entry to /dev/bench. Renders null in release builds. */}
          <DevBenchLauncher />
          {/* Handles deep-links when app is already running in background */}
          <DeepLinkHandler />
          {/* Routes push-notification taps to the right booking */}
          <PushTapHandler />
          {/* Branded toast notifications (overlays everything) */}
          <ToastHost />
          {/* "Your class starts soon" popup, opened from a reminder push tap */}
          <YogaReminderModalHost />
          {/* Styled replacement for Alert.alert — every confirm/info popup */}
          <AppAlertHost />
        </SafeAreaProvider>
      </I18nProvider>
    </AuthProvider>
    </GestureHandlerRootView>
  );
}
