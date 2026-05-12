import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowLeft, LocateFixed } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import { toDbSpecialty } from "@/lib/db/types";
import { LiveBookingsFeed } from "../../components/LiveBookingsFeed";

const specialtyChoices = [
  { key: "infirmier", label: "Infirmier" },
  { key: "psy", label: "Psychologue" },
  { key: "kine", label: "Kiné" },
  { key: "yoga", label: "Yoga" },
];

export default function ProBidsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [specialtyKey, setSpecialtyKey] = useState("infirmier");
  const [locating, setLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const specialty = useMemo(() => toDbSpecialty(specialtyKey), [specialtyKey]);

  const handleSetLocation = async () => {
    if (!user?.id || locating) return;
    setErrorMessage(null);
    setLocating(true);
    try {
      await db.pros.upsert({ id: user.id, specialty });
      const coords = await geo.getCurrentPosition();
      await geo.setProLocation(user.id, coords.lat, coords.lng);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Position GPS non enregistrée.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Demandes proches</Text>
          <Text style={styles.subtitle}>Soumettez vos offres en temps réel</Text>
        </View>
      </View>

      <View style={styles.specialtyRow}>
        {specialtyChoices.map((choice) => {
          const active = specialtyKey === choice.key;
          return (
            <TouchableOpacity
              key={choice.key}
              onPress={() => setSpecialtyKey(choice.key)}
              style={[styles.specialtyChip, active && styles.specialtyChipActive]}
            >
              <Text style={[styles.specialtyText, active && styles.specialtyTextActive]}>{choice.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.locateBtn} onPress={handleSetLocation} disabled={locating}>
        {locating ? <ActivityIndicator size="small" color={Colors.primary} /> : <LocateFixed size={16} color={Colors.primary} />}
        <Text style={styles.locateText}>Mettre à jour ma localisation GPS</Text>
      </TouchableOpacity>

      <LiveBookingsFeed specialty={specialty} />

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular" },
  subtitle: { fontSize: 12, color: Colors.textMuted },
  specialtyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  specialtyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "white",
  },
  specialtyChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  specialtyText: { color: Colors.textPrimary, fontSize: 12 },
  specialtyTextActive: { color: "white", fontWeight: "600" },
  locateBtn: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locateText: { color: Colors.primary, fontWeight: "600", fontSize: 12 },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
