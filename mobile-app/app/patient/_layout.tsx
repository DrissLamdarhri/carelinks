/**
 * Patient portal — tab navigator
 * Mirrors web: /app routes (dashboard, request, waiting, offers, etc.)
 */

import { Tabs } from "expo-router";
import { Calendar, Home, MessageCircle, Search, User } from "lucide-react-native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#0D0870";
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
        name="yoga"
        options={{
          title: "Explorer",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <Search color={focused ? PRIMARY : color} size={size} strokeWidth={1.6} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Mes RDV",
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
          title: "Chat",
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
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="offers/[bookingId]"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="chat/[bookingId]"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="waiting/[bookingId]"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="psychologist"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="provider/[id]"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="tracking"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="tracking/[bookingId]"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="rating/[bookingId]"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="payment/[bookingId]"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
      />
    </Tabs>
  );
}
