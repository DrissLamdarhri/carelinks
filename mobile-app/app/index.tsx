import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { getAssuranceLevel } from "@/lib/hooks/useMfa";
import { showToast } from "@/lib/toast";

export default function AppIndex() {
  const router = useRouter();
  const { loading, user, role, mfaEnabled } = useAuth();
  const mfaToastShown = useRef(false);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const route = async () => {
      if (loading || routing) return;

      if (!user) {
        setRouting(true);
        router.replace("/auth");
        return;
      }

      if (role === "pro") {
        if (!mfaEnabled) {
          if (!mfaToastShown.current) {
            showToast("Compte pro détecté. Activez l'authentificateur pour continuer.");
            mfaToastShown.current = true;
          }
          setRouting(true);
          router.replace({ pathname: "/auth/mfa-setup", params: { next: "/pro" } });
          return;
        }

        const assurance = await getAssuranceLevel();
        if (!mounted) return;
        if (assurance.currentLevel !== "aal2") {
          setRouting(true);
          router.replace({ pathname: "/auth/mfa-challenge", params: { role: "pro" } });
          return;
        }

        setRouting(true);
        router.replace("/pro");
        return;
      }

      setRouting(true);
      if (role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/patient");
      }
    };

    void route();
    return () => {
      mounted = false;
    };
  }, [loading, mfaEnabled, role, router, routing, user]);

  return (
    <View style={{ flex: 1, backgroundColor: "white", alignItems: "center", justifyContent: "center" }}>
      {loading ? <ActivityIndicator size="small" color="#2d6cdf" /> : null}
    </View>
  );
}
