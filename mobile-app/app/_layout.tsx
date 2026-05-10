/**
 * Root layout — mirrors web architecture
 * Wraps the entire app with providers (Auth, I18n)
 * Sets up navigation structure based on user role
 */

import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { DMSans_400Regular, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { configureNotifications } from "@/lib/push-native";

SplashScreen.preventAutoHideAsync();
configureNotifications();

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
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="patient" options={{ headerShown: false }} />
            <Stack.Screen name="pro" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D0870" }}>
            <ActivityIndicator size="large" color="#EDE5CC" />
          </View>
        )}
      </I18nProvider>
    </AuthProvider>
  );
}
