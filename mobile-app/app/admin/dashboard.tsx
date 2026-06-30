import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Users, Briefcase, CalendarClock, Star, AlertTriangle } from "lucide-react-native";
import { Colors } from "@/lib/colors";

const kpis = [
  { label: "Utilisateurs", value: "1,247", icon: Users },
  { label: "Professionnels", value: "312", icon: Briefcase },
  { label: "Réservations", value: "342", icon: CalendarClock },
  { label: "Note moyenne", value: "4.8", icon: Star },
];

const alerts = [
  "12 documents KYC en attente",
  "3 litiges nécessitent une décision",
  "2 professionnels suspendus aujourd’hui",
];

export default function AdminDashboardScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <LinearGradient colors={[Colors.primary, "#1A1585"]} style={styles.header}>
        <Text style={styles.headerTitle}>Tableau de bord admin</Text>
        <Text style={styles.headerSubtitle}>Vue synthèse de la plateforme CareLink</Text>
      </LinearGradient>

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
        {alerts.map((line) => (
          <View key={line} style={styles.alertRow}>
            <AlertTriangle size={14} color="#D97706" />
            <Text style={styles.alertText}>{line}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Gestion des réservations</Text>
        <Text style={styles.panelText}>Consultez toutes les réservations et rendez-vous de psychologue en temps réel.</Text>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push("/admin/bookings")}>
          <Text style={styles.ctaText}>📋 Gerer les réservations</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Configuration</Text>
        <Text style={styles.panelText}>Tarification, zones géographiques, validation KYC et gestion des litiges sont disponibles ici dans la version mobile.</Text>
        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push("/admin/metrics")}>
            <Text style={styles.ctaText}>Voir les métriques</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push("/admin/kyc")}>
            <Text style={styles.ctaText}>File KYC</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { padding: 20, paddingBottom: 26 },
  header: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  headerTitle: {
    color: "white",
    fontSize: 24,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  headerSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  kpiCard: {
    width: "48.5%",
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    padding: 12,
  },
  kpiValue: { color: Colors.textPrimary, fontSize: 20, fontWeight: "700", marginTop: 8 },
  kpiLabel: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  panel: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    padding: 12,
    marginBottom: 10,
  },
  panelTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  alertText: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  panelText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  ctaRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  ctaBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
});
