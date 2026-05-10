/**
 * Authentication flows — onboarding, login, registration
 * Mirrors web routes: /auth/patient, /auth/pro, /register
 */

import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="onboarding"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="patient-login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="pro-login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="registration"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
