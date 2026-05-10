import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/lib/colors";
import { mockCompletedStats } from "@/lib/mock-data";

export default function ProEarningsScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Revenus</Text>

      <View style={styles.grid}>
        <View style={styles.box}>
          <Text style={styles.boxLabel}>Aujourd'hui</Text>
          <Text style={styles.boxValue}>{mockCompletedStats.todayEarnings} MAD</Text>
        </View>
        <View style={styles.box}>
          <Text style={styles.boxLabel}>Cette semaine</Text>
          <Text style={styles.boxValue}>{mockCompletedStats.weeklyMissions} missions</Text>
        </View>
        <View style={styles.box}>
          <Text style={styles.boxLabel}>Ce mois</Text>
          <Text style={styles.boxValue}>{mockCompletedStats.monthMissions} missions</Text>
        </View>
        <View style={styles.box}>
          <Text style={styles.boxLabel}>Note moyenne</Text>
          <Text style={styles.boxValue}>{mockCompletedStats.rating.toFixed(1)}</Text>
        </View>
      </View>
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
    marginBottom: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  box: {
    width: "48.5%",
    backgroundColor: "white",
    borderRadius: 14,
    padding: 12,
  },
  boxLabel: { color: Colors.textMuted, fontSize: 11, marginBottom: 4 },
  boxValue: { color: Colors.primary, fontSize: 15, fontWeight: "700" },
});
