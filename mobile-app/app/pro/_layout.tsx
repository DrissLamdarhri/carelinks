/**
 * Professional (nurse/provider) portal — tab navigator
 * Mirrors web: /nurse routes (dashboard, schedule, earnings, profile)
 */

import { Tabs } from "expo-router";
import { Layers, FileText, TrendingUp, User } from "lucide-react-native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#0D0870";
const INACTIVE = "#B0B0B0";

export default function ProLayout() {
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
  const hiddenTabOptions = {
    href: null,
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
          title: "Tableau de bord",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <Layers color={focused ? PRIMARY : color} size={size} strokeWidth={1.6} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Calendrier",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <FileText color={focused ? PRIMARY : color} size={size} strokeWidth={1.6} />
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
              <TrendingUp color={focused ? PRIMARY : color} size={size} strokeWidth={1.6} />
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
          ...hiddenTabOptions,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          ...hiddenTabOptions,
        }}
      />
      <Tabs.Screen
        name="kyc"
        options={{
          ...hiddenTabOptions,
        }}
      />
      <Tabs.Screen name="profile-infos" options={hiddenTabOptions} />
      <Tabs.Screen name="notifications" options={hiddenTabOptions} />
    </Tabs>
  );
}
