/**
 * Professional (nurse/provider) portal — tab navigator
 * Mirrors web: /nurse routes (dashboard, schedule, earnings, profile)
 */

import { Tabs } from "expo-router";
import { Layers, FileText, TrendingUp, User } from "lucide-react-native";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#0D0870";
const ACCENT = "#8ECFDF";

export default function ProLayout() {
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
          title: "Tableau de bord",
          tabBarIcon: ({ color, size }) => (
            <Layers color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Calendrier",
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
      <Tabs.Screen
        name="bids"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="kyc"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}
