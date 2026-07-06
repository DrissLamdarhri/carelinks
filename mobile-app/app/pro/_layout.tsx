/**
 * Professional (nurse/provider) portal — tab navigator
 * Mirrors web: /nurse routes (dashboard, schedule, earnings, profile)
 */

import { Tabs } from "expo-router";
import { Home, CalendarDays, Wallet, User } from "lucide-react-native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#0D0870";
const INACTIVE = "#B0B0B0";

export default function ProLayout() {
  const insets = useSafeAreaInsets();
  // Normalize bottom inset: ensure a small minimum and cap to avoid excess space on some Android devices
  const safeInset = Math.min(Math.max(insets.bottom || 0, 8), 18);
  const tabBottomPadding = Platform.OS === "ios" ? Math.max(safeInset, 8) : safeInset;
  const BASE_TAB_HEIGHT = 56; // slightly larger base for better touch targets
  const tabBarHeight = BASE_TAB_HEIGHT + tabBottomPadding;
  const iconWrap = (focused: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: focused ? "#EDE5CC" : "transparent",
  });
  const hiddenTabOptions = {
    href: null,
    tabBarStyle: { display: "none" },
  } as const;
  const hiddenFullScreenOptions = {
      ...hiddenTabOptions,
      tabBarStyle: { display: "none" },
    } as const;
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
              <Home color={focused ? PRIMARY : color} size={size} strokeWidth={1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Missions",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <CalendarDays color={focused ? PRIMARY : color} size={size} strokeWidth={1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Revenus",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <Wallet color={focused ? PRIMARY : color} size={size} strokeWidth={1.8} />
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
        name="bids"
        options={{
          ...hiddenFullScreenOptions,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          ...hiddenFullScreenOptions,
        }}
      />
      <Tabs.Screen
        name="kyc"
        options={{
          ...hiddenFullScreenOptions,
        }}
      />
      <Tabs.Screen name="profile-infos" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="notifications" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="tracking/[bookingId]" options={hiddenFullScreenOptions} />
    </Tabs>
  );
}
