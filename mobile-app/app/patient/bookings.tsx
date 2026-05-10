import { View, Text, ScrollView, StyleSheet } from "react-native";
import { CalendarClock } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { mockPatientBooking } from "@/lib/mock-data";

export default function PatientBookingsScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mes réservations</Text>

      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <CalendarClock size={18} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pro}>{mockPatientBooking.proName}</Text>
          <Text style={styles.meta}>
            {mockPatientBooking.careType} · {mockPatientBooking.dateStr}
          </Text>
          <Text style={styles.meta}>Heure: {mockPatientBooking.timeStr}</Text>
        </View>
        <Text style={styles.status}>Confirmé</Text>
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
    marginBottom: 14,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceWarm,
  },
  pro: { color: Colors.textPrimary, fontWeight: "600", fontSize: 14 },
  meta: { color: Colors.textMuted, fontSize: 12 },
  status: {
    color: Colors.primary,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "600",
  },
});
