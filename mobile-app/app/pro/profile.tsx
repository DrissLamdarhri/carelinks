import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  ChevronRight,
  User,
  FileText,
  CreditCard,
  MapPin,
  Clock,
  Bell,
  Shield,
  LogOut,
  Star,
  LocateFixed,
} from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "expo-router";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import type { Professional } from "@/lib/db/types";

const menuItems = [
  { icon: User, label: "Informations personnelles", color: "#0D0870" },
  { icon: FileText, label: "Mes documents", color: "#3B82F6" },
  { icon: CreditCard, label: "Compte bancaire", color: "#6BB8C8" },
  { icon: MapPin, label: "Zone de couverture", color: "#8B5CF6" },
  { icon: Clock, label: "Disponibilités", color: "#6BB8C8" },
  { icon: Bell, label: "Notifications", color: "#0D0870" },
  { icon: Shield, label: "Vérification", color: "#0D0870" },
];

export default function ProProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [pro, setPro] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadPro = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      try {
        const row = await db.pros.get(user.id);
        if (row) {
          setPro(row);
        } else {
          const created = await db.pros.upsert({ id: user.id, specialty: "nurse" });
          setPro(created);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Profil professionnel indisponible.");
      } finally {
        setLoading(false);
      }
    };
    void loadPro();
  }, [user?.id]);

  const handleLocationUpdate = async () => {
    if (!user?.id || locating) return;
    setLocating(true);
    setErrorMessage(null);
    try {
      const coords = await geo.getCurrentPosition();
      await geo.setProLocation(user.id, coords.lat, coords.lng);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Mise à jour GPS impossible.");
    } finally {
      setLocating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : "Professionnel";
  const avatar =
    profile?.avatar ||
    "https://images.unsplash.com/photo-1594824475317-d131f6cbf0d8?w=200&q=80";
  const city = profile?.city ?? "";
  const rating = pro?.rating_avg ?? 0;
  const isVerified = pro?.verification_status === "approved";
  const specialty = pro?.specialty ? String(pro.specialty).replaceAll("_", " ") : "Professionnel de santé";

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mon profil pro</Text>

      <View style={styles.headerCard}>
        <View style={styles.profileRow}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.profileMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{displayName}</Text>
              {isVerified ? <Shield size={14} color={Colors.primary} /> : null}
            </View>
            <Text style={styles.specialty}>{specialty}</Text>
            {city ? <Text style={styles.city}>{city}</Text> : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <View style={styles.ratingRow}>
              <Star size={14} color="#FBBF24" fill="#FBBF24" />
              <Text style={styles.statValue}>{rating > 0 ? rating.toFixed(1) : "—"}</Text>
            </View>
            <Text style={styles.statLabel}>Note</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{pro?.total_bookings ?? 0}</Text>
            <Text style={styles.statLabel}>Missions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: isVerified ? Colors.primary : "#D97706" }]}>
              {isVerified ? "Vérifié" : "En attente"}
            </Text>
            <Text style={styles.statLabel}>Statut</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.locationBtn} onPress={handleLocationUpdate} disabled={locating}>
        {locating ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <LocateFixed size={18} color="white" />
        )}
        <Text style={styles.locationText}>
          {locating ? "Enregistrement…" : "Définir ma position GPS actuelle"}
        </Text>
      </TouchableOpacity>
      <Text style={styles.locationHint}>
        Permet aux patients de votre rayon de vous trouver via le matching géographique.
      </Text>

      <View style={styles.menuStack}>
        {menuItems.map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem}>
            <View style={[styles.menuIconWrap, { backgroundColor: `${item.color}18` }]}>
              <item.icon size={16} color={item.color} />
            </View>
            <Text style={styles.menuText}>{item.label}</Text>
            <ChevronRight size={16} color="#D0D0D0" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={async () => {
          await signOut();
          router.replace("/auth");
        }}
      >
        <LogOut size={18} color={Colors.danger} />
        <Text style={styles.signOutText}>Se déconnecter</Text>
      </TouchableOpacity>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceWarm },
  title: {
    fontSize: 22,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 12,
  },
  headerCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 12,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  profileMeta: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: Colors.textPrimary, fontSize: 17, fontWeight: "600" },
  specialty: { marginTop: 1, color: Colors.textMuted, fontSize: 13, textTransform: "capitalize" },
  city: { marginTop: 1, color: Colors.textSubtle, fontSize: 11 },
  statsRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 32, backgroundColor: "#F0F0F0" },
  statValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: "700" },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  locationText: { color: "white", fontSize: 14, fontWeight: "600" },
  locationHint: { color: Colors.textMuted, fontSize: 11, marginTop: 6, marginBottom: 12, paddingHorizontal: 2 },
  menuStack: { gap: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#F5F5F5",
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: "500" },
  signOutBtn: {
    marginTop: 12,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FDE8E8",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#FAD1D1",
  },
  signOutText: { color: Colors.danger, fontSize: 14, fontWeight: "600" },
  errorText: { color: Colors.danger, fontSize: 12, marginTop: 8 },
});
