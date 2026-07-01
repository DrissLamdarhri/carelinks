/**
 * CareLink — Auth Callback Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Google redirects back to  ma.carelink.app://auth/callback?code=xxxx
 * Expo Router matches that deep-link to THIS file.
 *
 * What we do here:
 *  1. Parse `code` from the URL
 *  2. Call supabase.auth.exchangeCodeForSession(code)
 *  3. Supabase fires onAuthStateChange → AuthProvider sets user + profile
 *  4. We read the intended role the user chose BEFORE hitting Google,
 *     then redirect them to /patient or /pro
 *  5. On any error → back to /auth (onboarding)
 */

import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const handled = useRef(false); // prevent double-execution in StrictMode

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const run = async () => {
      try {
        // 1 — get the URL that launched this screen
        const url = await Linking.getInitialURL();
        if (!url) throw new Error("No callback URL");

        // 2 — pull the `code` query param out
        const { queryParams } = Linking.parse(url);
        const code = queryParams?.code;
        if (!code || typeof code !== "string") throw new Error("No code in URL");

        // 3 — exchange the PKCE code for a real session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        // 4 — read which role the user intended before opening Google
        const intendedRole = await AsyncStorage.getItem("carelink_intended_role");
        await AsyncStorage.removeItem("carelink_intended_role");

        // 5 — redirect
        if (intendedRole === "pro") {
          router.replace("/pro");
        } else {
          router.replace("/patient");
        }
      } catch {
        // anything goes wrong → back to onboarding, never stuck on this screen
        router.replace("/auth");
      }
    };

    void run();
  }, [router]);

  return (
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
  );
}
