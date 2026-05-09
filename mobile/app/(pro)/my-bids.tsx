/**
 * My Bids — list of all bids placed by the professional.
 * Mirrors NurseOffers.tsx (web).
 */

import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react-native";

import { useAuth } from "../../../shared/auth-context";
import { db } from "../../../shared/db/dal";
import type { Bid } from "../../../shared/db/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  accepted: "#10B981",
  rejected: "#EF4444",
  withdrawn: "#6B7280",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  rejected: "Refusée",
  withdrawn: "Retirée",
};

export default function MyBidsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    db.bids
      .listForPro(user.id)
      .then(setBids)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="bg-primary px-5 py-4">
        <Text
          className="text-surface text-xl"
          style={{ fontFamily: "DMSerifDisplay_400Regular" }}
        >
          Mes offres
        </Text>
        <Text
          className="text-accent text-sm mt-1"
          style={{ fontFamily: "DMSans_400Regular" }}
        >
          {bids.length} offre{bids.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0D0870" size="large" />
        </View>
      ) : (
        <FlatList
          data={bids}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-4xl mb-4">📋</Text>
              <Text
                className="text-muted text-center"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                Vous n'avez pas encore soumis d'offres.
              </Text>
            </View>
          }
          renderItem={({ item: bid }) => (
            <View
              className={`bg-white rounded-2xl p-5 shadow-sm ${
                bid.status === "accepted" ? "border-l-4 border-green-400" : ""
              }`}
            >
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 mr-3">
                  <Text
                    className="text-primary text-base"
                    style={{ fontFamily: "DMSans_500Medium" }}
                  >
                    Réservation #{bid.booking_id.slice(-6)}
                  </Text>
                  {bid.message && (
                    <Text
                      className="text-muted text-sm mt-1"
                      style={{ fontFamily: "DMSans_400Regular" }}
                      numberOfLines={2}
                    >
                      {bid.message}
                    </Text>
                  )}
                </View>
                <View>
                  <Text
                    className="text-primary text-lg text-right"
                    style={{ fontFamily: "DMSerifDisplay_400Regular" }}
                  >
                    {bid.price_mad} MAD
                  </Text>
                  <View
                    className="px-2 py-1 rounded-full mt-1"
                    style={{
                      backgroundColor:
                        (STATUS_COLORS[bid.status] ?? "#888") + "20",
                    }}
                  >
                    <Text
                      className="text-xs text-right"
                      style={{
                        color: STATUS_COLORS[bid.status] ?? "#888",
                        fontFamily: "DMSans_500Medium",
                      }}
                    >
                      {STATUS_LABELS[bid.status] ?? bid.status}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Open chat if accepted */}
              {bid.status === "accepted" && (
                <TouchableOpacity
                  className="flex-row items-center justify-center gap-2 bg-primary py-3 rounded-xl mt-3"
                  onPress={() =>
                    router.push({
                      pathname: "/(patient)/chat/[bookingId]",
                      params: { bookingId: bid.booking_id },
                    })
                  }
                >
                  <MessageCircle color="#EDE5CC" size={16} strokeWidth={1.5} />
                  <Text
                    className="text-surface"
                    style={{ fontFamily: "DMSans_500Medium" }}
                  >
                    Ouvrir la messagerie
                  </Text>
                </TouchableOpacity>
              )}

              <Text
                className="text-muted text-xs mt-2"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                {new Date(bid.created_at).toLocaleDateString("fr-MA", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
