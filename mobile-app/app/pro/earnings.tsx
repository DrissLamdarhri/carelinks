import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowUpRight, Banknote, Calendar, TrendingUp } from "lucide-react-native";
import { Colors, Gradients } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import type { Booking } from "@/lib/db/types";

const COMMISSION_RATE = 0.15;
const SPEC_LABEL: Record<string, string> = {
  nurse: "Soins infirmiers",
  physiotherapist: "Kinésithérapie",
  psychologist: "Psychologie",
  yoga_instructor: "Yoga",
};

export default function ProEarningsScreen() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"week" | "month">("week");
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
        setErrorMessage(error instanceof Error ? error.message : "Chargement des revenus impossible.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const now = new Date();
  const periodStart = new Date(now);
  if (period === "week") {
    periodStart.setDate(now.getDate() - 7);
  } else {
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
  }

  const filteredBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        if (booking.status !== "completed") return false;
        try {
          return new Date(booking.created_at) >= periodStart;
        } catch {
          return false;
        }
      }),
    [bookings, periodStart]
  );

  const allCompleted = useMemo(
    () => bookings.filter((booking) => booking.status === "completed"),
    [bookings]
  );

  const gross = filteredBookings.reduce((sum, booking) => {
    const value = booking.final_price_mad ?? booking.budget_max_mad ?? 0;
    return sum + Number(value);
  }, 0);
  const commission = Math.round(gross * COMMISSION_RATE);
  const net = gross - commission;

  const chartDays = useMemo(() => {
    const dayMap: Record<string, number> = {};
    filteredBookings.forEach((booking) => {
      const day = booking.created_at.slice(0, 10);
      const value = Number(booking.final_price_mad ?? booking.budget_max_mad ?? 0);
      dayMap[day] = (dayMap[day] || 0) + value;
    });
    return Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7);
  }, [filteredBookings]);

  const maxBar = Math.max(...chartDays.map(([, value]) => value), 1);

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <LinearGradient colors={Gradients.nurse} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroSub}>
          Revenus nets ({period === "week" ? "7 derniers jours" : "ce mois"})
        </Text>
        <Text style={styles.heroValue}>
          {net} <Text style={styles.heroUnit}>MAD</Text>
        </Text>
        <View style={styles.heroCards}>
          <View style={styles.heroCard}>
            <Banknote size={14} color="rgba(255,255,255,0.65)" />
            <Text style={styles.heroCardValue}>{gross} MAD</Text>
            <Text style={styles.heroCardLabel}>Brut</Text>
          </View>
          <View style={styles.heroCard}>
            <TrendingUp size={14} color="rgba(255,255,255,0.65)" />
            <Text style={styles.heroCardValue}>-{commission} MAD</Text>
            <Text style={styles.heroCardLabel}>Commission (15%)</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.periodSwitch}>
        <TouchableOpacity
          style={[styles.periodBtn, period === "week" && styles.periodBtnActive]}
          onPress={() => setPeriod("week")}
        >
          <Text style={[styles.periodText, period === "week" && styles.periodTextActive]}>7 jours</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === "month" && styles.periodBtnActive]}
          onPress={() => setPeriod("month")}
        >
          <Text style={[styles.periodText, period === "month" && styles.periodTextActive]}>Ce mois</Text>
        </TouchableOpacity>
      </View>

      {chartDays.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Revenus par jour</Text>
          <View style={styles.chartBars}>
            {chartDays.map(([day, value]) => (
              <View key={day} style={styles.chartCol}>
                <View style={[styles.chartBar, { height: `${Math.max((value / maxBar) * 100, 8)}%` }]} />
                <Text style={styles.chartLabel}>
                  {new Date(day).toLocaleDateString("fr-MA", { day: "numeric" })}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Calendar size={18} color={Colors.primary} />
          <Text style={styles.summaryValue}>{allCompleted.length}</Text>
          <Text style={styles.summaryLabel}>Missions terminées</Text>
        </View>
        <View style={styles.summaryCard}>
          <ArrowUpRight size={18} color={Colors.accent} />
          <Text style={styles.summaryValue}>
            {allCompleted
              .reduce((sum, booking) => sum + Number(booking.final_price_mad ?? booking.budget_max_mad ?? 0), 0)
              .toFixed(0)}{" "}
            MAD
          </Text>
          <Text style={styles.summaryLabel}>Total cumulé</Text>
        </View>
      </View>

      <Text style={styles.listTitle}>Historique des transactions</Text>
      {filteredBookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucune mission terminée sur cette période</Text>
        </View>
      ) : (
        filteredBookings.map((booking) => {
          const grossValue = Number(booking.final_price_mad ?? booking.budget_max_mad ?? 0);
          const fee = Math.round(grossValue * COMMISSION_RATE);
          const netValue = grossValue - fee;
          return (
            <View key={booking.id} style={styles.txCard}>
              <View style={styles.txIconWrap}>
                <Banknote size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txTitle}>{SPEC_LABEL[booking.specialty] ?? "Mission"}</Text>
                <Text style={styles.txMeta}>
                  Patient ·{" "}
                  {new Date(booking.created_at).toLocaleDateString("fr-MA", {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.txValue}>+{netValue} MAD</Text>
                <Text style={styles.txFee}>-{fee} comm.</Text>
              </View>
            </View>
          );
        })
      )}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { paddingBottom: 20 },
  loadingRoot: { flex: 1, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center" },
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 20,
  },
  heroSub: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 2 },
  heroValue: { color: "white", fontSize: 36, fontWeight: "800", marginBottom: 12 },
  heroUnit: { fontSize: 16, fontWeight: "500" },
  heroCards: { flexDirection: "row", gap: 8 },
  heroCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 10,
  },
  heroCardValue: { color: "white", fontSize: 14, fontWeight: "600", marginTop: 4 },
  heroCardLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 2 },
  periodSwitch: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: Colors.input,
    padding: 4,
    flexDirection: "row",
  },
  periodBtn: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  periodBtnActive: { backgroundColor: "white" },
  periodText: { color: Colors.textMuted, fontSize: 13 },
  periodTextActive: { color: Colors.textPrimary, fontWeight: "600" },
  chartCard: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: "white",
    padding: 14,
  },
  chartTitle: { color: Colors.textMuted, fontSize: 12, marginBottom: 10, fontWeight: "500" },
  chartBars: { height: 72, flexDirection: "row", alignItems: "flex-end", gap: 6 },
  chartCol: { flex: 1, alignItems: "center", gap: 4 },
  chartBar: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: Colors.primary },
  chartLabel: { color: Colors.textSubtle, fontSize: 9 },
  summaryGrid: {
    marginHorizontal: 20,
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "white",
    padding: 12,
  },
  summaryValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 6 },
  summaryLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  listTitle: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    marginHorizontal: 20,
    borderRadius: 14,
    backgroundColor: "white",
    padding: 16,
    alignItems: "center",
  },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
  txCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: "white",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  txTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  txMeta: { color: Colors.textMuted, fontSize: 11 },
  txValue: { color: Colors.primary, fontSize: 15, fontWeight: "700" },
  txFee: { color: Colors.textSubtle, fontSize: 10 },
  errorText: { marginHorizontal: 20, marginTop: 6, color: Colors.danger, fontSize: 12 },
});
