import { View, Text, ScrollView, StyleSheet } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { Colors } from "@/lib/colors";

export default function PatientMessagesScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Messagerie</Text>
      <View style={styles.emptyCard}>
        <View style={styles.iconWrap}>
          <MessageCircle size={22} color={Colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Aucune conversation</Text>
        <Text style={styles.emptyText}>
          Vos discussions avec les professionnels s’afficheront ici.
        </Text>
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
  emptyCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceWarm,
    marginBottom: 10,
  },
  emptyTitle: { color: Colors.textPrimary, fontWeight: "600", fontSize: 15, marginBottom: 4 },
  emptyText: { color: Colors.textMuted, fontSize: 12, textAlign: "center" },
});
