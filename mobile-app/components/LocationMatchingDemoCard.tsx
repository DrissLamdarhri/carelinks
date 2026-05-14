import { StyleSheet, Text, View } from "react-native";
import { MapPin, Route } from "lucide-react-native";
import { Colors } from "@/lib/colors";

type LocationMatchingDemoCardProps = {
  role: "patient" | "pro";
  city?: string;
};

export function LocationMatchingDemoCard({ role, city }: LocationMatchingDemoCardProps) {
  const title =
    role === "patient"
      ? "Aperçu localisation patient ↔ professionnel"
      : "Aperçu matching localisation professionnel ↔ patient";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Mode démo (sans backend) · {city ?? "Ville"}</Text>

      <View style={styles.mapMock}>
        <View style={styles.routeLine} />

        <View style={[styles.pinWrap, styles.leftPin]}>
          <View style={styles.pinDotPatient}>
            <MapPin size={13} color="white" />
          </View>
          <Text style={styles.pinLabel}>{role === "patient" ? "Vous" : "Patient"}</Text>
        </View>

        <View style={[styles.pinWrap, styles.rightPin]}>
          <View style={styles.pinDotPro}>
            <MapPin size={13} color="white" />
          </View>
          <Text style={styles.pinLabel}>{role === "patient" ? "Pro proche" : "Vous"}</Text>
        </View>

        <View style={styles.centerBadge}>
          <Route size={12} color={Colors.primary} />
          <Text style={styles.centerBadgeText}>Rayon + disponibilité</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 12,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  mapMock: {
    height: 118,
    borderRadius: 14,
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 1,
    borderColor: "#E7E0CB",
    position: "relative",
    overflow: "hidden",
  },
  routeLine: {
    position: "absolute",
    top: "50%",
    left: 40,
    right: 40,
    borderTopWidth: 2,
    borderColor: "rgba(13,8,112,0.35)",
    borderStyle: "dashed",
  },
  pinWrap: {
    position: "absolute",
    alignItems: "center",
    gap: 4,
  },
  leftPin: {
    left: 18,
    top: 28,
  },
  rightPin: {
    right: 18,
    top: 28,
  },
  pinDotPatient: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pinDotPro: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pinLabel: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: "600",
  },
  centerBadge: {
    position: "absolute",
    left: "50%",
    transform: [{ translateX: -62 }],
    bottom: 10,
    height: 24,
    borderRadius: 999,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#EBEBEB",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  centerBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "600",
  },
});

