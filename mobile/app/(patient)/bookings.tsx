/**
 * Patient — all bookings list (upcoming + past).
 */

import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";

import { useAuth } from "../../../shared/auth-context";
import { usePatientBookings } from "../../../shared/db/realtime";
import type { Booking } from "../../../shared/db/types";

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

export default function BookingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  const { upcoming, past, loading, refresh } = usePatientBookings(
    user?.id ?? null
  );

  const data = activeTab === "upcoming" ? upcoming : past;

  const renderBooking = ({ item }: { item: Booking }) => (
    <TouchableOpacity
      className="bg-white rounded-2xl p-5 mb-3 shadow-sm"
      onPress={() => {
        if (item.status === "open") {
          router.push({
            pathname: "/(patient)/waiting-offers/[bookingId]",
            params: { bookingId: item.id },
          });
        } else {
          router.push({
            pathname: "/(patient)/chat/[bookingId]",
            params: { bookingId: item.id },
          });
        }
      }}
    >
      <View className="flex-row justify-between items-start mb-2">
        <Text
          className="text-primary text-base capitalize"
          style={{ fontFamily: "DMSans_500Medium" }}
        >
          {item.specialty.replace("_", " ")}
        </Text>
        <View
          className="px-3 py-1 rounded-full"
          style={{
            backgroundColor: (STATUS_COLORS[item.status] ?? "#888") + "20",
          }}
        >
          <Text
            className="text-xs"
            style={{
              color: STATUS_COLORS[item.status] ?? "#888",
              fontFamily: "DMSans_500Medium",
            }}
          >
            {STATUS_LABELS[item.status] ?? item.status}
          </Text>
        </View>
      </View>

      <Text
        className="text-muted text-sm"
        style={{ fontFamily: "DMSans_400Regular" }}
      >
        {item.address || "Adresse non précisée"}
      </Text>

      {item.final_price_mad && (
        <Text
          className="text-primary text-sm mt-2"
          style={{ fontFamily: "DMSans_500Medium" }}
        >
          Prix final : {item.final_price_mad} MAD
        </Text>
      )}

      <Text
        className="text-muted text-xs mt-2"
        style={{ fontFamily: "DMSans_400Regular" }}
      >
        {new Date(item.created_at).toLocaleDateString("fr-MA", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="bg-primary px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <ArrowLeft color="#EDE5CC" size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text
          className="text-surface text-lg"
          style={{ fontFamily: "DMSerifDisplay_400Regular" }}
        >
          Mes réservations
        </Text>
      </View>

      {/* Tabs */}
      <View className="flex-row mx-5 mt-5 mb-4 bg-white rounded-2xl p-1">
        {(["upcoming", "past"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`flex-1 py-3 rounded-xl items-center ${
              activeTab === tab ? "bg-primary" : ""
            }`}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              className={activeTab === tab ? "text-surface" : "text-muted"}
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              {tab === "upcoming" ? "En cours" : "Historique"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#0D0870" className="mt-8" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          refreshing={loading}
          onRefresh={refresh}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text
                className="text-muted text-center"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                Aucune réservation {activeTab === "upcoming" ? "active" : "passée"}.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
