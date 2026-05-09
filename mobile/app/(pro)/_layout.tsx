/**
 * Professional portal — bottom tab navigator
 */
import { Tabs } from "expo-router";
import { Layers, FileText, TrendingUp, User } from "lucide-react-native";
import { useAuth } from "../../../shared/auth-context";
import { useRouter } from "expo-router";
import { useEffect } from "react";

const PRIMARY = "#0D0870";
const ACCENT = "#8ECFDF";

export default function ProLayout() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/(auth)/login?role=pro");
    }
  }, [user, loading]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: "#888780",
        tabBarStyle: {
          backgroundColor: PRIMARY,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: "DMSans_400Regular",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Demandes",
          tabBarIcon: ({ color, size }) => (
            <Layers color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-bids"
        options={{
          title: "Mes offres",
          tabBarIcon: ({ color, size }) => (
            <FileText color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Revenus",
          tabBarIcon: ({ color, size }) => (
            <TrendingUp color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      {/* Hidden screens — navigated to programmatically */}
      <Tabs.Screen name="submit-bid/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="kyc" options={{ href: null }} />
    </Tabs>
  );
}
