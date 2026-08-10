import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function AppIndex() {
  const router = useRouter();
  const { loading, user, role } = useAuth();
  const [routing, setRouting] = useState(false);

  // Role gate — MFA removed (client did not want it): pros go straight to /pro.
  useEffect(() => {
    if (loading || routing) return;
    setRouting(true);
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (role === "pro") {
      router.replace("/pro");
      return;
    }
    // Mobile admin is temporarily disabled (product owner request — testing
    // is focused on patient/pro right now). An admin-role session used to
    // land straight in /admin from here; now it's kicked back to /auth
    // instead, same as the guard in app/admin/_layout.tsx for any direct
    // navigation there. The web admin is unaffected.
    if (role === "admin") {
      router.replace("/auth");
      return;
    }
    router.replace("/patient");
  }, [loading, role, router, routing, user]);

  return (
    <View style={{ flex: 1, backgroundColor: "white", alignItems: "center", justifyContent: "center" }}>
      {loading ? <ActivityIndicator size="small" color="#2d6cdf" /> : null}
    </View>
  );
}
