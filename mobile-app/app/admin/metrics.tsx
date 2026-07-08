import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { RefreshCw } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type MetricsState = {
  gmv: number;
  commission: number;
  totalBookings: number;
  activePros: number;
  openDisputes: number;
  pendingKyc: number;
};

const TAKE_RATE = 0.15;

export default function AdminMetricsScreen() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<MetricsState>({
    gmv: 0,
    commission: 0,
    totalBookings: 0,
    activePros: 0,
    openDisputes: 0,
    pendingKyc: 0,
  });

  const loadMetrics = useCallback(async () => {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceIso = since.toISOString();

      const [
        paymentsRes,
        bookingsCountRes,
        activeProsRes,
        disputesRes,
        pendingKycRes,
      ] = await Promise.all([
        supabase
          .from("payments")
          .select("amount_mad, commission_mad")
          .eq("status", "authorized")
          .gte("created_at", sinceIso),
        supabase.from("bookings").select("*", { count: "exact", head: true }),
        supabase
          .from("professionals")
          .select("*", { count: "exact", head: true })
          .eq("verification_status", "approved")
          .eq("is_available", true),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("dispute_open", true),
        supabase
          .from("professionals")
          .select("*", { count: "exact", head: true })
          .eq("verification_status", "pending"),
      ]);

      const paymentsRows = paymentsRes.error ? [] : (paymentsRes.data ?? []);
      const gmv = paymentsRows.reduce((sum, row) => sum + Number(row.amount_mad ?? 0), 0);
      const commissionFromRows = paymentsRows.reduce(
        (sum, row) => sum + Number(row.commission_mad ?? 0),
        0
      );
      const commission = commissionFromRows > 0 ? commissionFromRows : Math.round(gmv * TAKE_RATE);

      setMetrics({
        gmv,
        commission,
        totalBookings: bookingsCountRes.count ?? 0,
        activePros: activeProsRes.count ?? 0,
        openDisputes: disputesRes.error ? 0 : disputesRes.count ?? 0,
        pendingKyc: pendingKycRes.count ?? 0,
      });

      if (paymentsRes.error) {
        Alert.alert(
          "Info",
          t("payments_unavailable")
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("cannot_load_metrics");
      Alert.alert("Erreur", message);
    }
  }, []);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
    setLoading(false);
  }, [loadMetrics]);

  useFocusEffect(
    useCallback(() => {
      void runRefresh();
    }, [runRefresh])
  );

  const cards = useMemo(
    () => [
      { key: "gmv", label: "GMV (30j)", value: `${metrics.gmv.toLocaleString("fr-MA")} MAD` },
      {
        key: "commission",
        label: t("commission"),
        value: `${metrics.commission.toLocaleString("fr-MA")} MAD`,
      },
      { key: "bookings", label: t("bookings_lbl"), value: String(metrics.totalBookings) },
      { key: "activePros", label: t("active_pros"), value: String(metrics.activePros) },
      { key: "disputes", label: t("open_disputes"), value: String(metrics.openDisputes) },
      { key: "pendingKyc", label: "KYC en attente", value: String(metrics.pendingKyc) },
    ],
    [metrics]
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>{t("admin_metrics")}</Text>
          <Text style={styles.subtitle}>{t("platform_kpi")}</Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, refreshing && { opacity: 0.7 }]}
          onPress={runRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <RefreshCw size={15} color={Colors.primary} />
              <Text style={styles.refreshText}>{t("refresh")}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <View style={styles.grid}>
          {cards.map((card) => (
            <View key={card.key} style={styles.card}>
              <Text style={styles.cardLabel}>{card.label}</Text>
              <Text style={styles.cardValue}>{card.value}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surfaceWarm,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  refreshBtn: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "white",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: "48.5%",
    borderRadius: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 12,
  },
  cardLabel: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  cardValue: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 6,
  },
});
