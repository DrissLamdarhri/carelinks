/**
 * Patient portal — bottom tab navigator
 */
import { Tabs } from "expo-router";
import { Home, Calendar, MessageCircle, User } from "lucide-react-native";
import { useAuth } from "../../../shared/auth-context";
import { useRouter } from "expo-router";
import { useEffect } from "react";

const PRIMARY = "#0D0870";
const ACCENT = "#5BB8D4";
const SURFACE = "#EDE5CC";

export default function PatientLayout() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/(auth)/login?role=patient");
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
          title: "Accueil",
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Réservations",
          tabBarIcon: ({ color, size }) => (
            <Calendar color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat/[bookingId]"
        options={{
          title: "Messagerie",
          href: null, // hidden from tabs — navigate programmatically with bookingId
        }}
      />
      <Tabs.Screen
        name="waiting-offers/[bookingId]"
        options={{
          href: null, // hidden — navigate programmatically
        }}
      />
      <Tabs.Screen
        name="new-booking"
        options={{
          href: null, // modal — not in tabs
        }}
      />
      <Tabs.Screen
        name="yoga"
        options={{
          title: "Yoga",
          tabBarIcon: ({ color, size }) => (
            <Calendar color={color} size={size} strokeWidth={1.5} />
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
    </Tabs>
  );
}
