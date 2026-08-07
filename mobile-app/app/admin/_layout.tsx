/**
 * Admin panel — mirrors web: /admin routes.
 *
 * TEMPORARILY DISABLED on mobile at the product owner's request: testing is
 * focused on the patient/pro flows right now, and an admin-role account
 * landing straight in this section (via the root role gate) was crowding
 * that out. The web admin (src/app/components/AdminPanel.tsx) is unaffected
 * — this only gates the separate, parallel mobile admin implementation.
 * Re-enable by removing this effect once admin testing resumes on mobile.
 */

import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { showToast } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";

export default function AdminLayout() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    showToast(t("admin_mobile_disabled"));
    router.replace("/auth");
  }, [router, t]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="metrics" />
      <Stack.Screen name="kyc" />
    </Stack>
  );
}
