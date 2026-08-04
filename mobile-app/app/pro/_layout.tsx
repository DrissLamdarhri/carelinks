/**
 * Professional (nurse/provider) portal — tab navigator
 * Mirrors web: /nurse routes (dashboard, schedule, earnings, profile)
 */

import { Tabs, useRouter, useSegments } from "expo-router";
import { Home, CalendarDays, Wallet, User, MessageCircle } from "lucide-react-native";
import { Platform, View } from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { supabase } from "@/lib/supabase";
import { useMissionAccepted } from "@/lib/hooks/useMissionAccepted";

const PRIMARY = "#0D0870";
const INACTIVE = "#B0B0B0";

export default function ProLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  // A patient accepting a bid opens the mission map from wherever the pro is —
  // the tracking screen is what broadcasts GPS to the waiting patient.
  useMissionAccepted();

  // ── Verification gate ──────────────────────────────────────────────────────
  // A pro cannot use the portal until an admin approves their KYC. We track the
  // status live (realtime) and keep unapproved pros pinned to /pro/pending,
  // then release them to /pro the moment they're approved. RLS (migration 0008)
  // already blocks bidding — this closes the UX hole so they never see the
  // working dashboard before validation.
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const onPending = segments[segments.length - 1] === "pending";
  const [verif, setVerif] = useState<string | undefined>(undefined); // undefined = still loading

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const read = async () => {
      const pro = await db.pros.get(user.id).catch(() => null);
      if (alive) setVerif(pro?.verification_status ?? "pending");
    };
    void read();
    const ch = supabase
      .channel(`verif-gate-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "professionals", filter: `id=eq.${user.id}` },
        (payload: { new?: { verification_status?: string } }) => {
          if (alive) setVerif(payload.new?.verification_status ?? "pending");
        },
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [user?.id]);

  useEffect(() => {
    if (verif === undefined) return; // wait until we know the real status
    if (verif !== "approved" && !onPending) router.replace("/pro/pending");
    else if (verif === "approved" && onPending) router.replace("/pro");
  }, [verif, onPending, router]);
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
  // `href: null` alone was not enough: `report/[bookingId]` still rendered as a
  // sixth tab (labelled "report/[bo…", with a missing-glyph icon) on a real
  // build. Whatever the resolution quirk is, a screen that has no button and no
  // item box cannot appear in the bar under any router version — so we state it
  // three ways rather than trust one.
  const hiddenTabOptions = {
    href: null,
    tabBarButton: () => null,
    tabBarItemStyle: { display: "none" },
    tabBarStyle: { display: "none" },
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
              <Home color={focused ? PRIMARY : color} size={size} strokeWidth={1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t("missions"),
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
          title: t("revenue"),
          tabBarIcon: ({ color, size, focused }) => (
            <View style={iconWrap(focused)}>
              <Wallet color={focused ? PRIMARY : color} size={size} strokeWidth={1.8} />
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
              <MessageCircle color={focused ? PRIMARY : color} size={size} strokeWidth={1.8} />
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
      <Tabs.Screen name="pending" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="payout-method" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="profile-infos" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="notifications" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="tracking/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="chat/[bookingId]" options={hiddenFullScreenOptions} />
      <Tabs.Screen name="report/[bookingId]" options={hiddenFullScreenOptions} />
    </Tabs>
  );
}
