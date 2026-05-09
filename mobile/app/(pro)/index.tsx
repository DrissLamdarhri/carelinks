/**
 * Pro Dashboard — real-time feed of open bookings filtered by specialty.
 * Mirrors NurseDashboard.tsx (web).
 */

import { View, Text, FlatList, TouchableOpacity, Switch, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MapPin, Clock, DollarSign, ChevronRight } from "lucide-react-native";
import { useState } from "react";

import { useAuth } from "../../../shared/auth-context";
import { useOpenBookingsBySpecialty, useUserNotifications } from "../../../shared/db/realtime";
import { db } from "../../../shared/db/dal";
import type { Booking, ProSpecialty } from "../../../shared/db/types";

const URGENCY_COLORS: Record<string, string> = {
  normal: "#10B981",
  urgent: "#F59E0B",
  emergency: "#EF4444",
};

const URGENCY_LABELS: Record<string, string> = {
  normal: "Normal",
  urgent: "Urgent",
  emergency: "Urgence",
};

export default function ProDashboard() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [available, setAvailable] = useState(true);

  // Use the professional's specialty from their profile
  // Fallback to 'nurse' — in a real app this would come from db.pros.get()
  const specialty: ProSpecialty = "nurse";

  const { bookings, loading, refresh } = useOpenBookingsBySpecialty(
    available ? specialty : null
  );
  const { unreadCount } = useUserNotifications(user?.id ?? null);

  const toggleAvailability = async (val: boolean) => {
    setAvailable(val);
    if (user) {
      await db.pros.upsert({
        id: user.id,
        specialty,
        is_available: val,
      });
    }
  };

  const renderBooking = ({ item }: { item: Booking }) => (
    <TouchableOpacity
      className="bg-white rounded-2xl p-5 mb-3 shadow-sm"
      onPress={() =>
        router.push({
          pathname: "/(pro)/submit-bid/[bookingId]",
          params: { bookingId: item.id },
        })
      }
    >
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 mr-3">
          <Text
            className="text-primary text-base capitalize"
            style={{ fontFamily: "DMSans_500Medium" }}
          >
            {item.specialty.replace("_", " ")}
          </Text>
          {item.address && (
            <View className="flex-row items-center gap-1 mt-1">
              <MapPin color="#888780" size={12} strokeWidth={1.5} />
              <Text
                className="text-muted text-sm"
                style={{ fontFamily: "DMSans_400Regular" }}
                numberOfLines={1}
              >
                {item.address}
              </Text>
            </View>
          )}
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{
            backgroundColor: (URGENCY_COLORS[item.urgency] ?? "#888") + "20",
          }}
        >
          <Text
            className="text-xs"
            style={{
              color: URGENCY_COLORS[item.urgency] ?? "#888",
              fontFamily: "DMSans_500Medium",
            }}
          >
            {URGENCY_LABELS[item.urgency] ?? item.urgency}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-1">
          <DollarSign color="#5BB8D4" size={14} strokeWidth={1.5} />
          <Text
            className="text-mid text-sm"
            style={{ fontFamily: "DMSans_500Medium" }}
          >
            {item.budget_min_mad ?? "?"} – {item.budget_max_mad ?? "?"} MAD
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Clock color="#888780" size={12} strokeWidth={1.5} />
          <Text
            className="text-muted text-xs"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            {new Date(item.created_at).toLocaleTimeString("fr-MA", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <ChevronRight color="#888780" size={14} strokeWidth={1.5} />
        </View>
      </View>

      {item.notes && (
        <Text
          className="text-muted text-sm mt-3 italic"
          style={{ fontFamily: "DMSans_400Regular" }}
          numberOfLines={2}
        >
          "{item.notes}"
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="bg-primary px-5 pt-4 pb-5">
        <View className="flex-row justify-between items-center mb-4">
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
              {profile?.firstName || "Professionnel"}
            </Text>
          </View>
          {/* Availability toggle */}
          <View className="flex-row items-center gap-2">
            <Text
              className={available ? "text-green-400" : "text-surface/50"}
              style={{ fontFamily: "DMSans_400Regular", fontSize: 12 }}
            >
              {available ? "Disponible" : "Indisponible"}
            </Text>
            <Switch
              value={available}
              onValueChange={toggleAvailability}
              trackColor={{ false: "#1A1585", true: "#5BB8D4" }}
              thumbColor={available ? "#EDE5CC" : "#888780"}
            />
          </View>
        </View>

        {/* Live counter */}
        <View className="bg-primary-light rounded-2xl px-4 py-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="w-2 h-2 rounded-full bg-green-400" />
            <Text
              className="text-surface text-sm"
              style={{ fontFamily: "DMSans_400Regular" }}
            >
              Demandes en temps réel
            </Text>
          </View>
          <Text
            className="text-accent text-lg"
            style={{ fontFamily: "DMSerifDisplay_400Regular" }}
          >
            {bookings.length}
          </Text>
        </View>
      </View>

      {/* Feed */}
      {!available ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">💤</Text>
          <Text
            className="text-primary text-xl text-center"
            style={{ fontFamily: "DMSerifDisplay_400Regular" }}
          >
            Vous êtes hors ligne
          </Text>
          <Text
            className="text-muted text-center mt-2"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            Activez la disponibilité pour recevoir des demandes.
          </Text>
        </View>
      ) : loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0D0870" size="large" />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshing={loading}
          onRefresh={refresh}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-4xl mb-4">🔍</Text>
              <Text
                className="text-muted text-center"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                Aucune demande ouverte pour le moment.{"\n"}
                Revenez dans quelques instants.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
