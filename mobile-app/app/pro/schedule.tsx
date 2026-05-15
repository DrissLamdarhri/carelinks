import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import type { Booking } from "@/lib/db/types";

export default function ProScheduleScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      try {
        await db.pros.upsert({ id: user.id, specialty: "nurse" });
        const rows = await db.bookings.listForPro(user.id);
        setBookings(rows);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Chargement de l'agenda impossible.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Calendrier</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : null}

      {!loading &&
        bookings.map((booking) => (
          <View key={booking.id} style={styles.card}>
            <View>
              <Text style={styles.time}>
                {booking.scheduled_at
                  ? new Date(booking.scheduled_at).toLocaleTimeString("fr-MA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}
              </Text>
              <Text style={styles.date}>
                {booking.scheduled_at
                  ? new Date(booking.scheduled_at).toLocaleDateString("fr-MA")
                  : "Date flexible"}
              </Text>
            </View>
            <View style={styles.sep} />
            <View style={{ flex: 1 }}>
              <Text style={styles.patient}>Booking #{booking.id.slice(0, 8)}</Text>
              <Text style={styles.meta}>{booking.specialty}</Text>
              <Text style={styles.meta}>{booking.address ?? "Adresse non renseignée"}</Text>
            </View>
            <Text style={styles.price}>{booking.final_price_mad ?? booking.budget_max_mad ?? 0} MAD</Text>
          </View>
        ))}

      {!loading && bookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucune mission planifiée.</Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { padding: 20, gap: 10 },
  title: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 4,
  },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  time: { color: Colors.primary, fontSize: 14, fontWeight: "700" },
  date: { color: Colors.textMuted, fontSize: 10 },
  sep: { width: 1, height: 40, backgroundColor: Colors.border },
  patient: { color: Colors.textPrimary, fontWeight: "600", fontSize: 14 },
  meta: { color: Colors.textMuted, fontSize: 12, textTransform: "capitalize" },
  price: { color: Colors.primary, fontSize: 12, fontWeight: "700" },
  emptyCard: { backgroundColor: "white", borderRadius: 14, padding: 16, alignItems: "center" },
  emptyText: { color: Colors.textMuted, fontSize: 12 },
  errorText: { color: Colors.danger, fontSize: 12, marginTop: 6 },
});
