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
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; oauthUrl?: string }>();
  const handled = useRef(false); // prevent double-execution in StrictMode

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const run = async () => {
      try {
        let code: string | null =
          typeof params.code === "string" && params.code.length > 0
            ? params.code
            : null;

        if (!code && typeof params.oauthUrl === "string" && params.oauthUrl.length > 0) {
          const decodedUrl = decodeURIComponent(params.oauthUrl);
          const { queryParams } = Linking.parse(decodedUrl);
          const fromParam = queryParams?.code;
          code = typeof fromParam === "string" && fromParam.length > 0 ? fromParam : null;
        }

        if (!code) {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) {
            const { queryParams } = Linking.parse(initialUrl);
            const fromInitial = queryParams?.code;
            code = typeof fromInitial === "string" && fromInitial.length > 0 ? fromInitial : null;
          }
        }

        if (!code) throw new Error("No code in URL");

        // 1 — exchange the PKCE code for a real session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        // 2 — read which role the user intended before opening Google
        const intendedRole = await AsyncStorage.getItem("carelink_intended_role");
        await AsyncStorage.removeItem("carelink_intended_role");

        // 3 — redirect
        if (intendedRole === "pro") {
          router.replace("/pro");
        } else {
          router.replace("/patient");
        }
      } catch {
        // If code was already exchanged elsewhere, continue with existing session.
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session?.user) {
          const intendedRole = await AsyncStorage.getItem("carelink_intended_role");
          await AsyncStorage.removeItem("carelink_intended_role");
          router.replace(intendedRole === "pro" ? "/pro" : "/patient");
          return;
        }
        router.replace("/auth");
      }
    };

    void run();
  }, [params.code, params.oauthUrl, router]);

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
