/**
 * Root layout — mirrors web architecture
 * Wraps the entire app with providers (Auth, I18n)
 * Sets up navigation structure based on user role
 */

import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import { DMSans_400Regular, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSerifDisplay_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const handleUrl = async (url: string) => {
      const parsed = Linking.parse(url);
      const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;
      if (!code) return;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("OAuth session exchange failed:", error);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <I18nProvider>
        <SafeAreaProvider>
          {fontsLoaded ? (
            <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
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
            </SafeAreaView>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D0870" }}>
              <ActivityIndicator size="large" color="#EDE5CC" />
            </View>
          )}
        </SafeAreaProvider>
      </I18nProvider>
    </AuthProvider>
  );
}
