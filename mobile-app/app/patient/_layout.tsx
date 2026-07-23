/**
 * Patient portal — tab navigator
 * Mirrors web: /app routes (dashboard, request, waiting, offers, etc.)
 */

import { Tabs } from "expo-router";
import { Calendar, Home, MessageCircle, Search, User } from "lucide-react-native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/lib/i18n";

const PRIMARY = "#0D0870";
const INACTIVE = "#B0B0B0";

function PatientTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
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
    tabBarButton: () => null,
    tabBarItemStyle: { display: "none" },
  } as const;
  const hiddenFullScreenOptions = {
    ...hiddenTabOptions,
    tabBarStyle: { display: "none" },
  } as const;

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        // Stop inactive tabs from re-rendering in the background — switching
        // between bottom-bar tabs becomes instant instead of re-running work.
        freezeOnBlur: true,
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
          title: t("home"),
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
          title: t("explore"),
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
          title: t("my_appointments"),
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
          title: t("chat"),
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
          title: t("profile"),
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <User color={focused ? PRIMARY : color} size={size} strokeWidth={1.6} />
            </View>
          ),
        }}
      />


      <Tabs.Screen name="request" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="kine" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="urgent" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="offers/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="chat/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="waiting/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="profile-infos" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="patient-policy" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="addresses" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="notifications" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="psychologist" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="psychologists" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="psychologist-profile" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="provider/[id]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="tracking/index" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="tracking/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="rating/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="payment/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="appointment/[bookingId]" options={hiddenFullScreenOptions} />

    </Tabs>
  );
}

export default function PatientLayout() {
  return <PatientTabs />;
}
