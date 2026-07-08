import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  Calendar,
  Clock,
  MapPin,
  Filter,
  CheckCircle2,
  AlertCircle,
} from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { fetchAdminBookings, fetchPriorityBookings, fetchBookingStats } from "@/lib/admin/booking-notifications";
import type { AdminBookingLog } from "@/lib/admin/booking-notifications";

export default function AdminBookingsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [bookings, setBookings] = useState<AdminBookingLog[]>([]);
  const [priorityBookings, setPriorityBookings] = useState<AdminBookingLog[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    psychologist: 0,
    urgent: 0,
    critical: 0,
    today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "psychologist" | "urgent" | "critical">("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allBookings, priority, bookingStats] = await Promise.all([
        fetchAdminBookings({ limit: 100 }),
        fetchPriorityBookings(),
        fetchBookingStats(),
      ]);

      setBookings(allBookings);
      setPriorityBookings(priority);
      setStats(bookingStats);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Recharge les données toutes les 30 secondes (fallback)
    const interval = setInterval(loadData, 30000);

    // Realtime subscription to admin_booking_logs for instant updates
    const channel = supabase
      .channel("admin-booking-logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_booking_logs" },
        (payload) => {
          setBookings((prev) => {
            if (payload.eventType === "INSERT") return [payload.new as AdminBookingLog, ...prev];
            if (payload.eventType === "UPDATE") return prev.map((row) => (row.id === (payload.new as AdminBookingLog).id ? (payload.new as AdminBookingLog) : row));
            if (payload.eventType === "DELETE") return prev.filter((row) => row.id !== (payload.old as AdminBookingLog).id);
            return prev;
          });

          // Update stats live (best-effort)
          void fetchBookingStats()
            .then((s) => setStats(s))
            .catch((e) => console.error("fetchBookingStats error:", e));
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getFilteredBookings = () => {
    switch (filter) {
      case "psychologist":
        return bookings.filter((b) => b.is_psychologist);
      case "urgent":
        return bookings.filter((b) => b.alert_level === "high");
      case "critical":
        return bookings.filter((b) => b.alert_level === "critical");
      default:
        return bookings;
    }
  };

  const filteredBookings = getFilteredBookings();

  const renderBookingItem = ({ item }: { item: AdminBookingLog }) => {
    const statusColors: Record<string, { bg: string; color: string }> = {
      open: { bg: "#FEF3C7", color: "#D97706" },
      matched: { bg: "#DBEAFE", color: "#0284C7" },
      in_progress: { bg: "#DBEAFE", color: "#0284C7" },
      completed: { bg: "#DCFCE7", color: "#16A34A" },
      cancelled: { bg: "#FEE2E2", color: "#DC2626" },
    };

    const alertColors = {
      normal: { bg: "#F3F4F6", color: "#6B7280" },
      high: { bg: "#FEF08A", color: "#DC2626" },
      critical: { bg: "#FCA5A5", color: "#991B1B" },
    };

    const statusColor = statusColors[item.status] || statusColors.open;
    const alertColor = alertColors[item.alert_level];

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        onPress={() => {
          // Optionnel: Naviguer vers les détails de la réservation
        }}
      >
        <View style={styles.bookingHeader}>
          <View style={styles.bookingTitleWrap}>
            <Text style={styles.bookingSpecialty}>{item.specialty.toUpperCase()}</Text>
            {item.is_psychologist && (
              <View style={[styles.badge, { backgroundColor: "#F472B6", borderColor: "#EC4899" }]}>
                <Text style={[styles.badgeText, { color: "#BE185D" }]}>🧠 PSY</Text>
              </View>
            )}
          </View>
          <View
            style={[
              styles.alertBadge,
              {
                backgroundColor: alertColor.bg,
                borderColor: alertColor.color,
              },
            ]}
          >
            {item.alert_level === "critical" && <AlertTriangle size={12} color={alertColor.color} />}
            {item.alert_level === "high" && <AlertCircle size={12} color={alertColor.color} />}
            <Text style={[styles.alertBadgeText, { color: alertColor.color }]}>
              {item.alert_level === "critical" ? "CRITIQUE" : item.alert_level === "high" ? "ÉLEVÉE" : "NORMALE"}
            </Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Calendar size={13} color={Colors.textMuted} />
            <Text style={styles.detailText}>
              {item.scheduled_at
                ? new Date(item.scheduled_at).toLocaleString("fr-MA", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : t("date_not_set")}
            </Text>
          </View>

          {item.address && (
            <View style={styles.detailRow}>
              <MapPin size={13} color={Colors.textMuted} />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
          )}

          {item.notes && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("notes_label")}</Text>
              <Text style={styles.detailText} numberOfLines={1}>
                {item.notes}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bookingFooter}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor.color }]}>{item.status}</Text>
          </View>

          {item.price && (
            <Text style={styles.price}>
              {item.price.toLocaleString("fr-MA")} MAD
            </Text>
          )}

          <View style={styles.urgencyBadge}>
            <Clock size={11} color={Colors.textMuted} />
            <Text style={styles.urgencyText}>{item.urgency}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      onScroll={({ nativeEvent }) => {
        if (
          nativeEvent.contentOffset.y +
            nativeEvent.layoutMeasurement.height ===
          nativeEvent.contentSize.height
        ) {
          // Charger plus de résultats si l'utilisateur atteint le bas
        }
      }}
    >
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.title}>{t("bookings_management")}</Text>
        <Text style={styles.subtitle}>{t("all_bookings_desc")}</Text>
      </View>

      {/* Statistiques */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>{t("total")}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: "#EC4899", borderLeftWidth: 3 }]}>
          <Text style={[styles.statValue, { color: "#EC4899" }]}>{stats.psychologist}</Text>
          <Text style={styles.statLabel}>{t("psychologists")}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: "#F59E0B", borderLeftWidth: 3 }]}>
          <Text style={[styles.statValue, { color: "#F59E0B" }]}>{stats.urgent}</Text>
          <Text style={styles.statLabel}>{t("urgent_f")}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: "#DC2626", borderLeftWidth: 3 }]}>
          <Text style={[styles.statValue, { color: "#DC2626" }]}>{stats.critical}</Text>
          <Text style={styles.statLabel}>{t("critical")}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardSpan]}>
          <Text style={[styles.statValue, { color: "#0284C7" }]}>{stats.today}</Text>
          <Text style={styles.statLabel}>Aujourd'hui</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === "all" && styles.filterBtnActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.filterBtnText, filter === "all" && styles.filterBtnTextActive]}>
            Tous ({bookings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === "psychologist" && styles.filterBtnActive]}
          onPress={() => setFilter("psychologist")}
        >
          <Text style={[styles.filterBtnText, filter === "psychologist" && styles.filterBtnTextActive]}>
            🧠 Psy ({stats.psychologist})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === "critical" && styles.filterBtnActive]}
          onPress={() => setFilter("critical")}
        >
          <Text style={[styles.filterBtnText, filter === "critical" && styles.filterBtnTextActive]}>
            ⚠️ Critique ({stats.critical})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Réservations prioritaires */}
      {priorityBookings.length > 0 && (
        <View style={styles.prioritySection}>
          <Text style={styles.sectionTitle}>🚨 Priorité immédiate</Text>
          {priorityBookings.map((booking) => (
            <View key={booking.id} style={styles.priorityCard}>
              <AlertTriangle size={16} color="#DC2626" />
              <View style={styles.priorityInfo}>
                <Text style={styles.priorityText}>
                  {booking.is_psychologist ? t("psy_appointment") : t("urgent_booking")}
                </Text>
                <Text style={styles.prioritySubtext}>{booking.specialty}</Text>
              </View>
              <CheckCircle2 size={20} color="white" style={{ opacity: 0.5 }} />
            </View>
          ))}
        </View>
      )}

      {/* Liste des réservations */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Calendar size={40} color={Colors.textMuted} />
          <Text style={styles.emptyStateText}>Aucune réservation</Text>
          <Text style={styles.emptyStateSubtext}>
            Les réservations apparaîtront ici automatiquement
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F9FC" },
  content: { paddingBottom: 20 },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    color: "white",
    fontSize: 24,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 4,
  },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 10,
  },
  statCard: {
    width: "31%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  statCardSpan: { width: "48.5%" },
  statValue: { fontSize: 18, fontWeight: "700", color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  filtersContainer: {
    flexDirection: "row",
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterBtnText: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  filterBtnTextActive: { color: "white" },
  prioritySection: {
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  priorityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#DC2626",
    gap: 12,
  },
  priorityInfo: { flex: 1 },
  priorityText: { fontSize: 13, fontWeight: "700", color: "#7F1D1D" },
  prioritySubtext: { fontSize: 11, color: "#991B1B", marginTop: 2 },
  bookingCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  bookingTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  bookingSpecialty: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
  alertBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  alertBadgeText: { fontSize: 10, fontWeight: "700" },
  bookingDetails: { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailLabel: { fontSize: 11, fontWeight: "600", color: Colors.textMuted },
  detailText: { fontSize: 12, color: Colors.textPrimary, flex: 1 },
  bookingFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "600" },
  price: { flex: 1, textAlign: "right", fontSize: 13, fontWeight: "700", color: Colors.primary },
  urgencyBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  urgencyText: { fontSize: 10, color: Colors.textMuted, fontWeight: "500" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary, marginTop: 12 },
  emptyStateSubtext: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
});
