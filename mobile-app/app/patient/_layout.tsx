/**
 * Patient portal — tab navigator
 * Mirrors web: /app routes (dashboard, request, waiting, offers, etc.)
 */

import { Tabs } from "expo-router";
import { Home, Calendar, MessageCircle, User } from "lucide-react-native";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#0D0870";
const ACCENT = "#5BB8D4";

export default function PatientLayout() {
  const insets = useSafeAreaInsets();
  const tabBottomPadding =
    Platform.OS === "ios" ? Math.max(insets.bottom, 8) : Math.max(insets.bottom, 14);
  const tabBarHeight = 50 + tabBottomPadding;

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
          height: tabBarHeight,
          paddingBottom: tabBottomPadding,
          paddingTop: 4,
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
        name="messages"
        options={{
          title: "Messagerie",
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size} strokeWidth={1.5} />
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
      <Tabs.Screen
        name="request"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="offers/[bookingId]"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="chat/[bookingId]"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="waiting/[bookingId]"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="yoga"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="psychologist"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="provider/[id]"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="tracking/[bookingId]"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="rating/[bookingId]"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="payment/[bookingId]"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}
