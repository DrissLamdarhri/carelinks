import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/lib/colors";
import { mockProAppointments } from "@/lib/mock-data";

export default function ProScheduleScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Calendrier</Text>

      {mockProAppointments.map((b) => (
        <View key={b.id} style={styles.card}>
          <View>
            <Text style={styles.time}>{b.timeStr}</Text>
            <Text style={styles.date}>{b.dateStr}</Text>
          </View>
          <View style={styles.sep} />
          <View style={{ flex: 1 }}>
            <Text style={styles.patient}>{b.patientName}</Text>
            <Text style={styles.meta}>{b.careType}</Text>
            <Text style={styles.meta}>{b.address}</Text>
          </View>
          <Text style={styles.price}>{b.price} MAD</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 10 },
  title: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 4,
  },
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
  meta: { color: Colors.textMuted, fontSize: 12 },
  price: { color: Colors.primary, fontSize: 12, fontWeight: "700" },
});
