/**
 * Patient portal — tab navigator
 * Mirrors web: /app routes (dashboard, request, waiting, offers, etc.)
 */

import { Tabs } from "expo-router";
import { Home, Calendar, MessageCircle, User } from "lucide-react-native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#0D0870";
const ACCENT = "#5BB8D4";
const INACTIVE = "#B0B0B0";

export default function PatientLayout() {
  const insets = useSafeAreaInsets();
  const tabBottomPadding =
    Platform.OS === "ios" ? Math.max(insets.bottom, 8) : Math.max(insets.bottom, 14);
  const tabBarHeight = 50 + tabBottomPadding;
  const iconWrap = (focused: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: focused ? "#EDE5CC" : "transparent",
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: "white",
          borderTopWidth: 1,
          borderTopColor: "#EFEFEF",
          elevation: 0,
          shadowOpacity: 0,
          height: tabBarHeight + 2,
          paddingBottom: tabBottomPadding,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: 2,
        },
      }}
    >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <Home color={focused ? PRIMARY : color} size={size} strokeWidth={1.6} />
            </View>
          ),
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            title: "Réservations",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <Calendar color={focused ? PRIMARY : color} size={size} strokeWidth={1.6} />
            </View>
          ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messagerie",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <MessageCircle color={focused ? PRIMARY : color} size={size} strokeWidth={1.6} />
            </View>
          ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <User color={focused ? PRIMARY : color} size={size} strokeWidth={1.6} />
            </View>
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
