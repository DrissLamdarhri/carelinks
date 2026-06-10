/**
 * Patient portal — tab navigator
 * Mirrors web: /app routes (dashboard, request, waiting, offers, etc.)
 */

import { Tabs } from "expo-router";
import { Calendar, Home, MessageCircle, Search, User, MapPin } from "lucide-react-native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapTabProvider, useMapTab } from "@/lib/map-tab-context";

const PRIMARY = "#0D0870";
const INACTIVE = "#B0B0B0";

function PatientTabs() {
  const { showMap } = useMapTab();
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
    tabBarButton: () => null,
    tabBarItemStyle: { display: "none" },
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

      {/* tracking map tab: only visible when showMap is true */}
      <Tabs.Screen
        name="tracking/index"
        options={
          showMap
            ? {
                title: "Localiser",
                tabBarIcon: ({ color, size, focused }) => (
                  <View style={iconWrap(focused)}>
                    <MapPin color={focused ? PRIMARY : color} size={size} strokeWidth={1.6} />
                  </View>
                ),
              }
            : hiddenFullScreenOptions
        }
      />

      <Tabs.Screen name="request" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="offers/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="chat/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="waiting/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="profile-infos" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="patient-policy" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="addresses" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="notifications" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="psychologist" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="provider/[id]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="tracking/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="rating/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="payment/[bookingId]" options={hiddenFullScreenOptions} />

    </Tabs>
  );
}

export default function PatientLayout() {
  return (
    <MapTabProvider>
      <PatientTabs />
    </MapTabProvider>
  );
}
