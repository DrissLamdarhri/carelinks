import { useEffect, useState, useCallback } from "react";
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
import { Colors, DEFAULT_AVATAR } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useFocusEffect } from "expo-router";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import type { Professional } from "@/lib/db/types";
import { RadiusSlider } from "@/components/RadiusSlider";
import { ProfileHeaderCard } from "@/components/ProfileHeaderCard";
import { toastSuccess } from "@/lib/toast";
import { usePickImage, uploadAvatarToSupabase, updateProfileAvatar } from "@/lib/hooks/useImageUpload";

const menuItems = [
  { icon: User, label: "Informations personnelles", color: "#0D0870", route: "/pro/profile-infos" },
  { icon: FileText, label: "Mes documents", color: "#3B82F6", route: "/pro/kyc" },
  { icon: CreditCard, label: "Compte bancaire", color: "#6BB8C8" },
  { icon: MapPin, label: "Zone de couverture", color: "#8B5CF6" },
  { icon: Clock, label: "Disponibilités", color: "#6BB8C8" },
  { icon: Bell, label: "Notifications", color: "#0D0870", route: "/pro/notifications" },
  { icon: Shield, label: "Sécurité & Confidentialité", color: "#8B5CF6", route: "/auth/mfa-settings" },
  { icon: Shield, label: "Vérification", color: "#0D0870", route: "/pro/kyc" },
];

export default function ProProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [pro, setPro] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUploadAvatar = async () => {
    if (!user?.id || uploadingAvatar) return;
    setUploadingAvatar(true);
    try {
      const image = await usePickImage();
      if (!image) return;
      const avatarUrl = await uploadAvatarToSupabase(user.id, image.uri);
      if (avatarUrl && (await updateProfileAvatar(user.id, avatarUrl))) {
        await refreshProfile();
        toastSuccess("Photo de profil mise à jour ✓");
      }
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Refresh profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile])
  );

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
    DEFAULT_AVATAR;
  const email = profile?.email || "";
  const phone = profile?.phone || "";
  const city = profile?.city ?? "";
  const rating = pro?.rating_avg ?? 0;
  const isVerified = pro?.verification_status === "approved";
  const specialty = pro?.specialty ? String(pro.specialty).replaceAll("_", " ") : "Professionnel de santé";

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ProfileHeaderCard
        title="Mon profil pro"
        name={displayName}
        email={email}
        phone={phone}
        city={city || specialty}
        avatarUrl={typeof avatar === "string" ? avatar : ""}
        initials={displayName.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase()}
        uploading={uploadingAvatar}
        onEditAvatar={handleUploadAvatar}
        stats={[
          { value: rating > 0 ? rating.toFixed(1) : "—", label: "Note", star: true },
          { value: pro?.total_bookings ?? 0, label: "Missions" },
          { value: isVerified ? "Vérifié" : "En attente", label: "Statut", accent: isVerified },
        ]}
      />

      <View style={styles.body}>
      <View style={styles.menuStack}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.menuItem}
            onPress={() => {
              if (item.route) router.push(item.route as never);
            }}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: `${item.color}18` }]}>
              <item.icon size={16} color={item.color} />
            </View>
            <Text style={styles.menuText}>{item.label}</Text>
            <ChevronRight size={16} color="#D0D0D0" />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.coverageCard}>
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
        {user?.id && pro ? (
          <RadiusSlider
            professionalId={user.id}
            initialRadiusKm={pro.service_radius_km || 5}
            onUpdated={(radiusKm) =>
              setPro((prev) => (prev ? { ...prev, service_radius_km: radiusKm } : prev))
            }
          />
        ) : null}
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { paddingBottom: 24 },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
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
  name: { color: Colors.textPrimary, fontSize: 17, fontWeight: "600" },
  email: { marginTop: 2, color: Colors.textMuted, fontSize: 12 },
  contactRow: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  phone: { color: Colors.textMuted, fontSize: 12 },
  contactDot: { color: "#D0D0D0", fontSize: 12 },
  specialtyRow: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 },
  specialty: { color: Colors.textMuted, fontSize: 13, textTransform: "capitalize" },
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
  coverageCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#F5F5F5",
  },
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
