import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Calendar, CalendarClock, ChevronRight, MapPin, Star, Wallet } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { usePatientBookings } from "@/lib/db/realtime";

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: "#0891B2", bg: "#D8F0F4", label: "En attente" },
  matched: { color: Colors.primary, bg: Colors.surfaceWarm, label: "Confirmé" },
  in_progress: { color: "#0891B2", bg: "#D8F0F4", label: "En cours" },
  completed: { color: "#16A34A", bg: "#DCFCE7", label: "Terminé" },
  cancelled: { color: Colors.danger, bg: "#FDE8E8", label: "Annulé" },
};

export default function PatientBookingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const { bookings, loading, error } = usePatientBookings(user?.id ?? null);

  const { upcoming, past } = useMemo(() => {
    const nextUpcoming = bookings.filter((item) =>
      ["open", "matched", "in_progress"].includes(item.status)
    );
    const nextPast = bookings.filter((item) => ["completed", "cancelled"].includes(item.status));
    return { upcoming: nextUpcoming, past: nextPast };
  }, [bookings]);

  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mes Rendez-vous</Text>

      <View style={styles.paymentCard}>
        <Wallet size={18} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.paymentTitle}>Paiement</Text>
          <Text style={styles.paymentText}>
            Paiement en espèces ou lien carte sécurisé au moment du match.
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "upcoming" && styles.tabBtnActive]}
          onPress={() => setTab("upcoming")}
        >
          <Text style={[styles.tabText, tab === "upcoming" && styles.tabTextActive]}>
            À venir ({upcoming.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "past" && styles.tabBtnActive]}
          onPress={() => setTab("past")}
        >
          <Text style={[styles.tabText, tab === "past" && styles.tabTextActive]}>
            Passés ({past.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : null}

      {!loading && displayed.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Calendar size={28} color={Colors.textSubtle} />
          </View>
          <Text style={styles.emptyTitle}>
            {tab === "upcoming" ? "Aucun rendez-vous à venir" : "Aucun historique"}
          </Text>
          {tab === "upcoming" ? (
            <TouchableOpacity style={styles.emptyCta} onPress={() => router.push("/patient/request")}>
              <Text style={styles.emptyCtaText}>Prendre un rendez-vous</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {!loading &&
        displayed.map((booking) => {
          const status = statusConfig[booking.status] ?? statusConfig.open;
          const when = booking.scheduled_at
            ? new Date(booking.scheduled_at).toLocaleString("fr-MA", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : new Date(booking.created_at).toLocaleString("fr-MA", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });

          const isOpen = booking.status === "open";
          const isActive = ["matched", "in_progress"].includes(booking.status);
          const isCompleted = booking.status === "completed";

          return (
            <View key={booking.id} style={styles.card}>
              <View style={styles.headRow}>
                <View style={styles.iconWrap}>
                  <CalendarClock size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceText}>
                    {booking.specialty.replaceAll("_", " ")}
                  </Text>
                  <Text style={styles.metaText}>{booking.address ?? "Adresse non renseignée"}</Text>
                </View>
                <Text style={[styles.statusBadge, { color: status.color, backgroundColor: status.bg }]}>
                  {status.label}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <CalendarClock size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>{when}</Text>
                <MapPin size={12} color={Colors.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {booking.address ?? "—"}
                </Text>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.priceText}>
                  {booking.final_price_mad ?? booking.budget_max_mad ?? booking.budget_min_mad ?? 0} MAD
                </Text>

                {isOpen ? (
                  <TouchableOpacity
                    style={styles.actionTextBtn}
                    onPress={() => router.push(`/patient/waiting/${booking.id}`)}
                  >
                    <Text style={styles.actionText}>Suivre</Text>
                    <ChevronRight size={14} color={Colors.primary} />
                  </TouchableOpacity>
                ) : null}

                {isActive ? (
                  <TouchableOpacity
                    style={styles.actionTextBtn}
                    onPress={() => router.push(`/patient/tracking/${booking.id}`)}
                  >
                    <Text style={styles.actionText}>Suivre</Text>
                    <ChevronRight size={14} color={Colors.primary} />
                  </TouchableOpacity>
                ) : null}

                {isCompleted ? (
                  <TouchableOpacity
                    style={styles.ratingBtn}
                    onPress={() => router.push(`/patient/rating/${booking.id}`)}
                  >
                    <Star size={12} color={Colors.primary} fill={Colors.primary} />
                    <Text style={styles.ratingBtnText}>Évaluer</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}

      {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 26 },
  title: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 12,
  },
  paymentCard: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E9DEC0",
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  paymentTitle: { color: Colors.primary, fontWeight: "700", fontSize: 13 },
  paymentText: { color: "rgba(13,8,112,0.75)", fontSize: 12, marginTop: 2 },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.input,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: { backgroundColor: "white" },
  tabText: { color: Colors.textMuted, fontSize: 13 },
  tabTextActive: { color: Colors.textPrimary, fontWeight: "600" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 56 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { color: Colors.textMuted, fontSize: 15, fontWeight: "500" },
  emptyCta: {
    marginTop: 12,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  emptyCtaText: { color: "white", fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 9 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceWarm,
  },
  serviceText: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
  statusBadge: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "600",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  metaText: { color: Colors.textMuted, fontSize: 12, flexShrink: 1 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceText: { color: Colors.primary, fontSize: 16, fontWeight: "700" },
  actionTextBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  actionText: { color: Colors.primary, fontSize: 12, fontWeight: "500" },
  ratingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ratingBtnText: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
