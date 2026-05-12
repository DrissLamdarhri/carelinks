import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, Loader2, Star } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { db } from "@/lib/db/dal";
import { useBookingBids } from "@/lib/db/realtime";

type LiveBidsFeedProps = {
  bookingId: string;
  onAccepted?: (bidId: string) => void;
};

export function LiveBidsFeed({ bookingId, onAccepted }: LiveBidsFeedProps) {
  const { pendingBids, loading } = useBookingBids(bookingId);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const accept = async (bidId: string) => {
    const bid = pendingBids.find((row) => row.id === bidId);
    if (!bid) return;
    setErrorMessage(null);
    setAccepting(bid.id);
    try {
      await db.bids.accept(bid);
      await db.bookings.acceptBid(bookingId, bid.professional_id, bid.price_mad);
      onAccepted?.(bid.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erreur lors de l'acceptation.");
    } finally {
      setAccepting(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (pendingBids.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>En attente d'offres…</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {pendingBids.map((bid) => (
        <View key={bid.id} style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{bid.professional_id.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.proName}>Pro {bid.professional_id.slice(0, 6)}</Text>
            <View style={styles.metaRow}>
              <Star size={10} color="#F5B544" fill="#F5B544" />
              <Text style={styles.metaText}>4.8</Text>
              {bid.eta_min ? <Text style={styles.metaText}>· {bid.eta_min} min</Text> : null}
            </View>
          </View>
          <View style={styles.priceWrap}>
            <Text style={styles.price}>{bid.price_mad}</Text>
            <Text style={styles.priceUnit}>MAD</Text>
          </View>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => accept(bid.id)}
            disabled={accepting === bid.id}
          >
            {accepting === bid.id ? (
              <Loader2 size={14} color="white" />
            ) : (
              <Check size={16} color="white" />
            )}
          </TouchableOpacity>
        </View>
      ))}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
  list: { gap: 8 },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceWarm,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(91,184,212,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.primary, fontSize: 13, fontWeight: "700" },
  proName: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { color: Colors.textMuted, fontSize: 11 },
  priceWrap: { alignItems: "flex-end", marginRight: 2 },
  price: { color: Colors.primary, fontSize: 16, fontWeight: "700" },
  priceUnit: { color: Colors.textMuted, fontSize: 10 },
  acceptBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { marginTop: 4, color: Colors.danger, fontSize: 12 },
});
