import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Clock, Loader2, MapPin, Send } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { useOpenBookingsBySpecialty } from "@/lib/db/realtime";
import type { ProSpecialty } from "@/lib/db/types";

type LiveBookingsFeedProps = {
  specialty: ProSpecialty;
};

export function LiveBookingsFeed({ specialty }: LiveBookingsFeedProps) {
  const { user } = useAuth();
  const { bookings, loading } = useOpenBookingsBySpecialty(specialty);
  const [bidFor, setBidFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitBid = async (bookingId: string) => {
    if (!user?.id || submitting) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 50) {
      setErrorMessage("Montant minimum 50 MAD.");
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await db.bids.create({
        booking_id: bookingId,
        professional_id: user.id,
        price_mad: n,
      });
      setBidFor(null);
      setAmount("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Aucune demande ouverte</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {bookings.map((booking) => (
        <View key={booking.id} style={styles.card}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Demande de soin</Text>
              {booking.notes ? <Text style={styles.note}>{booking.notes}</Text> : null}
            </View>
            <Text style={styles.price}>
              {booking.budget_min_mad ?? 0}-{booking.budget_max_mad ?? 0} MAD
            </Text>
          </View>

          <View style={styles.metaRow}>
            {booking.address ? (
              <View style={styles.metaItem}>
                <MapPin size={11} color={Colors.textMuted} />
                <Text style={styles.metaText}>{booking.address}</Text>
              </View>
            ) : null}
            {booking.scheduled_at ? (
              <View style={styles.metaItem}>
                <Clock size={11} color={Colors.textMuted} />
                <Text style={styles.metaText}>
                  {new Date(booking.scheduled_at).toLocaleString("fr-MA", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ) : null}
          </View>

          {bidFor === booking.id ? (
            <View style={styles.bidRow}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                style={styles.input}
                placeholder="Votre offre (MAD)"
                placeholderTextColor={Colors.textSubtle}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={() => submitBid(booking.id)} disabled={submitting}>
                {submitting ? (
                  <Loader2 size={14} color="white" />
                ) : (
                  <>
                    <Send size={13} color="white" />
                    <Text style={styles.sendText}>Envoyer</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setBidFor(null)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.offerBtn} onPress={() => setBidFor(booking.id)}>
              <Text style={styles.offerText}>Faire une offre</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
  list: { gap: 10 },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceWarm,
    padding: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  title: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  note: { marginTop: 2, color: Colors.textMuted, fontSize: 12 },
  price: { color: Colors.primary, fontSize: 12, fontWeight: "700" },
  metaRow: { gap: 6, marginBottom: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: Colors.textMuted, fontSize: 11 },
  bidRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  sendBtn: {
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  sendText: { color: "white", fontSize: 12, fontWeight: "600" },
  cancelText: { color: Colors.textMuted, fontSize: 12 },
  offerBtn: {
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  offerText: { color: "white", fontSize: 13, fontWeight: "600" },
  errorText: { color: Colors.danger, fontSize: 12 },
});
