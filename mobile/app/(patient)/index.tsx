/**
 * Patient Dashboard — service picker + upcoming bookings overview.
 * Mirrors PatientDashboard.tsx (web) adapted for React Native.
 */

import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Activity,
  Brain,
  Heart,
  Dumbbell,
  ChevronRight,
  Bell,
} from "lucide-react-native";

import { useAuth } from "../../../shared/auth-context";
import { useI18n } from "../../../shared/i18n";
import { usePatientBookings, useUserNotifications } from "../../../shared/db/realtime";
import type { ProSpecialty } from "../../../shared/db/types";

// ── Service catalogue ─────────────────────────────────────────────────────────
const SERVICES: {
  specialty: ProSpecialty;
  labelKey: string;
  Icon: any;
  color: string;
  bg: string;
}[] = [
  {
    specialty: "nurse",
    labelKey: "nurse",
    Icon: Activity,
    color: "#0D0870",
    bg: "#EDE5CC",
  },
  {
    specialty: "psychologist",
    labelKey: "psychologist",
    Icon: Brain,
    color: "#5BB8D4",
    bg: "#EFF8FB",
  },
  {
    specialty: "physiotherapist",
    labelKey: "physio",
    Icon: Heart,
    color: "#0D0870",
    bg: "#EDE5CC",
  },
  {
    specialty: "yoga_instructor",
    labelKey: "yoga",
    Icon: Dumbbell,
    color: "#5BB8D4",
    bg: "#EFF8FB",
  },
];

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  open: "#F59E0B",
  matched: "#5BB8D4",
  in_progress: "#10B981",
  completed: "#6B7280",
  cancelled: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  open: "En attente",
  matched: "Confirmé",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
};

export default function PatientDashboard() {
  const { user, profile, signOut } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const { upcoming, past, loading } = usePatientBookings(user?.id ?? null);
  const { unreadCount } = useUserNotifications(user?.id ?? null);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="bg-primary px-5 pt-4 pb-6">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text
              className="text-surface/70 text-sm"
              style={{ fontFamily: "DMSans_400Regular" }}
            >
              Bonjour,
            </Text>
            <Text
              className="text-surface text-xl"
              style={{ fontFamily: "DMSerifDisplay_400Regular" }}
            >
              {profile?.firstName || "Patient"}
            </Text>
          </View>
          <TouchableOpacity className="relative p-2">
            <Bell color="#EDE5CC" size={22} strokeWidth={1.5} />
            {unreadCount > 0 && (
              <View className="absolute top-1 right-1 bg-red-500 rounded-full w-4 h-4 items-center justify-center">
                <Text className="text-white text-xs">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Service grid */}
        <Text
          className="text-surface/70 text-sm mb-3"
          style={{ fontFamily: "DMSans_400Regular" }}
        >
          Quel soin recherchez-vous ?
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {SERVICES.map((svc) => (
            <TouchableOpacity
              key={svc.specialty}
              className="flex-1 min-w-[44%] rounded-2xl p-4 items-center"
              style={{ backgroundColor: svc.bg }}
              onPress={() =>
                router.push({
                  pathname: "/(patient)/new-booking",
                  params: { specialty: svc.specialty },
                })
              }
            >
              <View
                className="w-12 h-12 rounded-full items-center justify-center mb-2"
                style={{ backgroundColor: svc.color + "20" }}
              >
                <svc.Icon color={svc.color} size={22} strokeWidth={1.5} />
              </View>
              <Text
                className="text-center text-sm"
                style={{ color: svc.color, fontFamily: "DMSans_500Medium" }}
              >
                {t(svc.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Upcoming bookings */}
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <View className="flex-row justify-between items-center mb-4">
          <Text
            className="text-primary text-lg"
            style={{ fontFamily: "DMSerifDisplay_400Regular" }}
          >
            Réservations actives
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(patient)/bookings")}
          >
            <Text
              className="text-mid text-sm"
              style={{ fontFamily: "DMSans_400Regular" }}
            >
              Voir tout
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#0D0870" className="mt-8" />
        ) : upcoming.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 items-center mt-2">
            <Text
              className="text-muted text-center"
              style={{ fontFamily: "DMSans_400Regular" }}
            >
              Aucune réservation active.{"\n"}Commencez par choisir un soin !
            </Text>
          </View>
        ) : (
          upcoming.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              className="bg-white rounded-2xl p-4 mb-3 flex-row items-center shadow-sm"
              onPress={() =>
                booking.status === "open"
                  ? router.push({
                      pathname: "/(patient)/waiting-offers/[bookingId]",
                      params: { bookingId: booking.id },
                    })
                  : router.push({
                      pathname: "/(patient)/chat/[bookingId]",
                      params: { bookingId: booking.id },
                    })
              }
            >
              <View className="flex-1">
                <Text
                  className="text-primary capitalize text-base mb-1"
                  style={{ fontFamily: "DMSans_500Medium" }}
                >
                  {booking.specialty.replace("_", " ")}
                </Text>
                <Text
                  className="text-muted text-sm"
                  style={{ fontFamily: "DMSans_400Regular" }}
                >
                  {booking.address || "Adresse non précisée"}
                </Text>
                {booking.budget_max_mad && (
                  <Text
                    className="text-mid text-sm mt-1"
                    style={{ fontFamily: "DMSans_400Regular" }}
                  >
                    Budget : {booking.budget_min_mad}–{booking.budget_max_mad}{" "}
                    MAD
                  </Text>
                )}
              </View>
              <View className="items-end gap-2">
                <View
                  className="px-3 py-1 rounded-full"
                  style={{
                    backgroundColor:
                      (STATUS_COLORS[booking.status] ?? "#888") + "20",
                  }}
                >
                  <Text
                    className="text-xs"
                    style={{
                      color: STATUS_COLORS[booking.status] ?? "#888",
                      fontFamily: "DMSans_500Medium",
                    }}
                  >
                    {STATUS_LABELS[booking.status] ?? booking.status}
                  </Text>
                </View>
                <ChevronRight color="#888780" size={16} />
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
