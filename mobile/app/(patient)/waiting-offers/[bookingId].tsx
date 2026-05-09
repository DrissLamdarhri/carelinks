/**
 * Waiting Offers — real-time bids feed for a patient's open booking.
 * Mirrors WaitingOffers.tsx (web) — uses the same useBookingBids hook.
 */

import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Star, Clock, DollarSign } from "lucide-react-native";

import { useAuth } from "../../../../shared/auth-context";
import { useBookingBids } from "../../../../shared/db/realtime";
import { db } from "../../../../shared/db/dal";
import type { Bid } from "../../../../shared/db/types";

export default function WaitingOffersScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { bids, pendingBids, loading, refresh } = useBookingBids(
    bookingId ?? null
  );

  const handleAccept = async (bid: Bid) => {
    Alert.alert(
      "Accepter cette offre ?",
      `Prix : ${bid.price_mad} MAD${bid.eta_min ? ` · ETA : ${bid.eta_min} min` : ""}`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Accepter",
          style: "default",
          onPress: async () => {
            try {
              await db.bids.accept(bid);
              await db.bookings.acceptBid(
                bid.booking_id,
                bid.professional_id,
                bid.price_mad
              );
              router.replace({
                pathname: "/(patient)/chat/[bookingId]",
                params: { bookingId: bid.booking_id },
              });
            } catch (err: any) {
              Alert.alert("Erreur", err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="bg-primary px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <ArrowLeft color="#EDE5CC" size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            className="text-surface text-lg"
            style={{ fontFamily: "DMSerifDisplay_400Regular" }}
          >
            Offres reçues
          </Text>
          <Text
            className="text-accent text-xs"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            {pendingBids.length} offre{pendingBids.length !== 1 ? "s" : ""} en
            attente
          </Text>
        </View>
        {/* Live indicator */}
        <View className="flex-row items-center gap-1">
          <View className="w-2 h-2 rounded-full bg-green-400" />
          <Text
            className="text-surface/70 text-xs"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            Live
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0D0870" size="large" />
          <Text
            className="text-muted mt-4"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            En attente d'offres…
          </Text>
        </View>
      ) : bids.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">⏳</Text>
          <Text
            className="text-primary text-xl mb-2 text-center"
            style={{ fontFamily: "DMSerifDisplay_400Regular" }}
          >
            En attente d'offres
          </Text>
          <Text
            className="text-muted text-center"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            Les professionnels disponibles vont vous envoyer leurs offres sous
            peu.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bids}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshing={loading}
          onRefresh={refresh}
          renderItem={({ item: bid }) => (
            <View
              className={`bg-white rounded-2xl p-5 shadow-sm border-2 ${
                bid.status === "accepted"
                  ? "border-green-400"
                  : bid.status === "rejected"
                  ? "border-red-200 opacity-60"
                  : "border-transparent"
              }`}
            >
              {/* Pro info row */}
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1 mr-4">
                  <Text
                    className="text-primary text-base"
                    style={{ fontFamily: "DMSans_500Medium" }}
                  >
                    Professionnel #{bid.professional_id.slice(-6)}
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
                <View className="items-end">
                  <Text
                    className="text-primary text-xl"
                    style={{ fontFamily: "DMSerifDisplay_400Regular" }}
                  >
                    {bid.price_mad} MAD
                  </Text>
                  {bid.eta_min && (
                    <View className="flex-row items-center gap-1 mt-1">
                      <Clock color="#888780" size={12} />
                      <Text
                        className="text-muted text-xs"
                        style={{ fontFamily: "DMSans_400Regular" }}
                      >
                        {bid.eta_min} min
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Accept button (only for pending bids) */}
              {bid.status === "pending" && (
                <TouchableOpacity
                  className="bg-primary py-3 rounded-xl items-center mt-2"
                  onPress={() => handleAccept(bid)}
                >
                  <Text
                    className="text-surface"
                    style={{ fontFamily: "DMSans_500Medium" }}
                  >
                    Accepter cette offre
                  </Text>
                </TouchableOpacity>
              )}

              {bid.status === "accepted" && (
                <View className="bg-green-100 py-2 rounded-xl items-center mt-2">
                  <Text
                    className="text-green-700 text-sm"
                    style={{ fontFamily: "DMSans_500Medium" }}
                  >
                    ✓ Offre acceptée
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
