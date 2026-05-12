import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { usePatientBookings } from "@/lib/db/realtime";

export default function PatientMessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { bookings, loading, error } = usePatientBookings(user?.id ?? null);
  const chatReadyBookings = bookings.filter((item) => item.status !== "cancelled");

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Messagerie</Text>
      <Text style={styles.subtitle}>Choisissez une réservation pour discuter en temps réel.</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : null}

      {!loading &&
        chatReadyBookings.map((booking) => (
          <TouchableOpacity
            key={booking.id}
            style={styles.chatCard}
            onPress={() => router.push(`/patient/chat/${booking.id}`)}
          >
            <View style={styles.iconWrap}>
              <MessageCircle size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatTitle}>Booking #{booking.id.slice(0, 8)}</Text>
              <Text style={styles.chatMeta}>{booking.specialty} · {booking.status}</Text>
            </View>
            <Text style={styles.openText}>Ouvrir</Text>
          </TouchableOpacity>
        ))}

      {!loading && chatReadyBookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucune conversation active.</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  title: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginBottom: 12, marginTop: 4 },
  center: { paddingVertical: 40, alignItems: "center" },
  chatCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceWarm,
  },
  chatTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  chatMeta: { color: Colors.textMuted, fontSize: 12, textTransform: "capitalize" },
  openText: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  emptyCard: { backgroundColor: "white", borderRadius: 16, padding: 20, alignItems: "center" },
  emptyText: { color: Colors.textMuted, fontSize: 12 },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
