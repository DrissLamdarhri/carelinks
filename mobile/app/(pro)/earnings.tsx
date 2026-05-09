/**
 * Pro Earnings — summary of completed bookings + revenue.
 * Mirrors NurseEarnings.tsx (web) — no recharts, uses simple RN views.
 */

import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TrendingUp, CheckCircle, XCircle } from "lucide-react-native";

import { useAuth } from "../../../shared/auth-context";
import { db } from "../../../shared/db/dal";
import type { Booking } from "../../../shared/db/types";

export default function EarningsScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    db.bookings
      .listForPro(user.id)
      .then(setBookings)
      .finally(() => setLoading(false));
  }, [user]);

  const completed = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const totalEarnings = completed.reduce(
    (sum, b) => sum + (b.final_price_mad ?? 0),
    0
  );
  const avgEarning =
    completed.length > 0 ? totalEarnings / completed.length : 0;

  const statCards = [
    {
      label: "Revenus totaux",
      value: `${totalEarnings.toFixed(0)} MAD`,
      Icon: TrendingUp,
      color: "#0D0870",
      bg: "#EDE5CC",
    },
    {
      label: "Missions terminées",
      value: completed.length.toString(),
      Icon: CheckCircle,
      color: "#10B981",
      bg: "#D1FAE5",
    },
    {
      label: "Annulées",
      value: cancelled.length.toString(),
      Icon: XCircle,
      color: "#EF4444",
      bg: "#FEE2E2",
    },
    {
      label: "Revenu moyen",
      value: `${avgEarning.toFixed(0)} MAD`,
      Icon: TrendingUp,
      color: "#5BB8D4",
      bg: "#E0F7FC",
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="bg-primary px-5 py-4">
        <Text
          className="text-surface text-xl"
          style={{ fontFamily: "DMSerifDisplay_400Regular" }}
        >
          Mes revenus
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0D0870" size="large" />
        </View>
      ) : (
        <>
          {/* Stats grid */}
          <View className="flex-row flex-wrap gap-3 p-5">
            {statCards.map((card) => (
              <View
                key={card.label}
                className="flex-1 min-w-[44%] rounded-2xl p-4"
                style={{ backgroundColor: card.bg }}
              >
                <card.Icon color={card.color} size={20} strokeWidth={1.5} />
                <Text
                  className="text-2xl mt-2 mb-1"
                  style={{ color: card.color, fontFamily: "DMSerifDisplay_400Regular" }}
                >
                  {card.value}
                </Text>
                <Text
                  className="text-sm"
                  style={{ color: card.color + "99", fontFamily: "DMSans_400Regular" }}
                >
                  {card.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Recent completed */}
          <Text
            className="px-5 text-primary text-base mb-3"
            style={{ fontFamily: "DMSans_500Medium" }}
          >
            Missions récentes
          </Text>
          <FlatList
            data={completed.slice(0, 20)}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            ListEmptyComponent={
              <Text
                className="text-muted text-center"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                Aucune mission terminée.
              </Text>
            }
            renderItem={({ item }) => (
              <View className="bg-white rounded-2xl p-4 mb-3 flex-row justify-between items-center">
                <View className="flex-1 mr-3">
                  <Text
                    className="text-primary text-sm capitalize"
                    style={{ fontFamily: "DMSans_500Medium" }}
                  >
                    {item.specialty.replace("_", " ")}
                  </Text>
                  <Text
                    className="text-muted text-xs mt-1"
                    style={{ fontFamily: "DMSans_400Regular" }}
                  >
                    {item.completed_at
                      ? new Date(item.completed_at).toLocaleDateString(
                          "fr-MA",
                          { day: "numeric", month: "short", year: "numeric" }
                        )
                      : "—"}
                  </Text>
                </View>
                <Text
                  className="text-primary"
                  style={{ fontFamily: "DMSerifDisplay_400Regular" }}
                >
                  {item.final_price_mad ?? "—"} MAD
                </Text>
              </View>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}
