import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

let makeRedirectUri: typeof import("expo-auth-session").makeRedirectUri | null =
  null;

if (Platform.OS !== "web") {
  try {
    makeRedirectUri = require("expo-auth-session").makeRedirectUri;
  } catch {
    // expo-auth-session not available in unit test context
  }
}

const fallbackRedirect = "ma.carelink.app://auth/callback";

export function getOAuthRedirectUrl(): string {
  if (!makeRedirectUri) return fallbackRedirect;
  if (Platform.OS === "web") {
    return makeRedirectUri({ path: "auth/callback" });
  }

  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (isExpoGo) {
    return makeRedirectUri({ path: "auth/callback", preferLocalhost: false });
  }

  return makeRedirectUri({
    native: fallbackRedirect,
    scheme: "ma.carelink.app",
    path: "auth/callback",
    preferLocalhost: false,
  });
}

const resetFallback = "ma.carelink.app://auth/reset-password";

/** Deep link the password-reset email should open (→ app/auth/reset-password). */
export function getPasswordResetRedirectUrl(): string {
  if (!makeRedirectUri) return resetFallback;
  if (Platform.OS === "web") return makeRedirectUri({ path: "auth/reset-password" });
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (isExpoGo) return makeRedirectUri({ path: "auth/reset-password", preferLocalhost: false });
  return makeRedirectUri({
    native: resetFallback,
    scheme: "ma.carelink.app",
    path: "auth/reset-password",
    preferLocalhost: false,
  });
}
