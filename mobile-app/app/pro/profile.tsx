import { View, Text, ScrollView, StyleSheet, Image } from "react-native";
import { Colors } from "@/lib/colors";
import { mockProProfile } from "@/lib/mock-data";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default function ProProfileScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Profil Pro</Text>
        <LocaleSwitcher />
      </View>

      <View style={styles.card}>
        <Image source={{ uri: mockProProfile.avatar }} style={styles.avatar} />
        <Text style={styles.name}>{mockProProfile.name}</Text>
        <Text style={styles.city}>{mockProProfile.city}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  card: { backgroundColor: "white", borderRadius: 16, padding: 20, alignItems: "center" },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 10 },
  name: { color: Colors.textPrimary, fontSize: 17, fontWeight: "600", marginBottom: 2 },
  city: { color: Colors.textMuted, fontSize: 13 },
});
