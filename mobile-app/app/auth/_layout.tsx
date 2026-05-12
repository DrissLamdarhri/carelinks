/**
 * Authentication flows — onboarding, patient/pro login, split registration
 */

import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
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
      <Stack.Screen
        name="pro-registration"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
