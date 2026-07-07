import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, Briefcase, CalendarClock, ShieldCheck, Star, UserX, Users } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";

type Stats = {
  users: number;
  pros: number;
  bookings: number;
  rating: string;
  pendingKyc: number;
  suspended: number;
  disputes: number;
};

const countOf = async (table: string, apply?: (q: any) => any): Promise<number> => {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count } = await q;
  return count ?? 0;
};

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ users: 0, pros: 0, bookings: 0, rating: "—", pendingKyc: 0, suspended: 0, disputes: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [users, pros, bookings, pendingKyc, suspended, ratingRows, disputes] = await Promise.all([
        countOf("profiles"),
        countOf("professionals"),
        countOf("bookings"),
        countOf("professionals", (q) => q.eq("verification_status", "pending")),
        countOf("profiles", (q) => q.eq("is_suspended", true)),
        supabase.from("professionals").select("rating_avg").gt("rating_count", 0),
        countOf("disputes", (q) => q.in("status", ["open", "pending"])).catch(() => 0),
      ]);
      const rated = (ratingRows.data ?? []).map((r: any) => Number(r.rating_avg)).filter((n) => n > 0);
      const avg = rated.length ? (rated.reduce((s, n) => s + n, 0) / rated.length).toFixed(1) : "—";
      setStats({ users, pros, bookings, rating: avg, pendingKyc, suspended, disputes });
    } catch (e) {
      console.error("dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "professionals" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const kpis = [
    { label: "Utilisateurs", value: String(stats.users), icon: Users },
    { label: "Professionnels", value: String(stats.pros), icon: Briefcase },
    { label: "Réservations", value: String(stats.bookings), icon: CalendarClock },
    { label: "Note moyenne", value: stats.rating, icon: Star },
  ];

  const alerts: { text: string; kind: "warn" | "ok"; onPress?: () => void }[] = [
    stats.pendingKyc > 0
      ? { text: `${stats.pendingKyc} document(s) KYC en attente`, kind: "warn", onPress: () => router.push("/admin/kyc") }
      : { text: "Aucun KYC en attente", kind: "ok" },
    ...(stats.suspended > 0 ? [{ text: `${stats.suspended} compte(s) suspendu(s)`, kind: "warn" as const }] : []),
    ...(stats.disputes > 0 ? [{ text: `${stats.disputes} litige(s) à traiter`, kind: "warn" as const }] : []),
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <LinearGradient colors={[Colors.primary, "#1A1585"]} style={styles.header}>
        <Text style={styles.headerTitle}>Tableau de bord admin</Text>
        <Text style={styles.headerSubtitle}>Vue synthèse — données en temps réel</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={Colors.primary} />
      ) : (
        <>
          <View style={styles.grid}>
            {kpis.map((item) => (
              <View key={item.label} style={styles.kpiCard}>
                <item.icon size={16} color={Colors.primary} />
                <Text style={styles.kpiValue}>{item.value}</Text>
                <Text style={styles.kpiLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Actions prioritaires</Text>
            {alerts.map((a) => (
              <TouchableOpacity key={a.text} style={styles.alertRow} disabled={!a.onPress} onPress={a.onPress}>
                {a.kind === "ok" ? <ShieldCheck size={15} color="#16A34A" /> : a.text.includes("suspendu") ? <UserX size={15} color="#E24B4A" /> : <AlertTriangle size={15} color="#D97706" />}
                <Text style={styles.alertText}>{a.text}</Text>
                {a.onPress ? <Text style={styles.alertGo}>›</Text> : null}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Gestion</Text>
            <View style={styles.ctaRow}>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push("/admin/kyc")}>
                <Text style={styles.ctaText}>File KYC{stats.pendingKyc > 0 ? ` (${stats.pendingKyc})` : ""}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push("/admin/bookings")}>
                <Text style={styles.ctaText}>Réservations</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.ctaBtn, styles.ctaWide]} onPress={() => router.push("/admin/metrics")}>
              <Text style={styles.ctaText}>Voir les métriques</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { padding: 20, paddingTop: 44, paddingBottom: 26 },
  header: { borderRadius: 18, padding: 16, marginBottom: 12 },
  headerTitle: { color: "white", fontSize: 24, fontFamily: "DMSerifDisplay_400Regular" },
  headerSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  kpiCard: { width: "48.5%", backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: "#F0F0F0", padding: 12 },
  kpiValue: { color: Colors.textPrimary, fontSize: 22, fontWeight: "800", marginTop: 8 },
  kpiLabel: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  panel: { backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: "#F0F0F0", padding: 14, marginBottom: 10 },
  panelTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 10 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 },
  alertText: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  alertGo: { color: Colors.textMuted, fontSize: 18 },
  ctaRow: { flexDirection: "row", gap: 8 },
  ctaBtn: { flex: 1, height: 42, borderRadius: 11, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  ctaWide: { marginTop: 8, flex: undefined, width: "100%" },
  ctaText: { color: "white", fontSize: 13, fontWeight: "700" },
});
