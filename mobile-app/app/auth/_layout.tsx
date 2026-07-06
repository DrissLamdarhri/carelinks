/**
 * Authentication flows — onboarding, login, registration, OAuth callback
 */

import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack>
      {/*
        The onboarding screen lives at app/auth/index.tsx.
        Expo Router maps the `index` file to the root of this segment,
        so we declare it as name="index" — NOT "onboarding".
        (Declaring "onboarding" while the file is "index.tsx" caused a
        second unmatched-route when navigating back from login screens.)
      */}
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="patient-login"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="pro-login"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="registration"
        options={{ headerShown: false }}
      />

      {/*
        This is the screen Google redirects back to after authentication.
        Deep-link: ma.carelink.app://auth/callback?code=xxxx
        Without this declaration Expo Router has no match → "Unmatched Route".
      */}
      <Stack.Screen
        name="callback"
        options={{ headerShown: false }}
      />

      {/* Password-reset landing — deep link: ma.carelink.app://auth/reset-password?code=xxxx */}
      <Stack.Screen
        name="reset-password"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
