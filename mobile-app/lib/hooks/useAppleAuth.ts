import { useCallback } from "react";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { getOAuthRedirectUrl } from "@/lib/auth-redirect";
import { tr } from "../i18n";

let WebBrowser: typeof import("expo-web-browser") | null = null;
if (Platform.OS !== "web") {
  try {
    WebBrowser = require("expo-web-browser");
    WebBrowser?.maybeCompleteAuthSession?.();
  } catch {
    // expo packages not installed — running in unit test context
  }
}

export function useAppleAuth() {
  const signInWithApple = useCallback(async () => {
    const redirectTo = getOAuthRedirectUrl();
    const shouldSkipRedirect = Platform.OS !== "web";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo,
        skipBrowserRedirect: shouldSkipRedirect,
      },
    });
    if (error) throw error;

    if (!shouldSkipRedirect) return;

    if (data.url && WebBrowser) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") {
        throw new Error(tr("cmp_apple_cancelled"));
      }
    }
  }, []);

  return { signInWithApple };
}
