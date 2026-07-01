import { useEffect, useMemo, useState, useCallback } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  ChevronRight,
  CreditCard,
  Edit3,
  HelpCircle,
  LogOut,
  MapPin,
  Bell,
  Shield,
  Star,
  User,
} from "lucide-react-native";
import { Colors, DEFAULT_AVATAR } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useFocusEffect } from "expo-router";
import { db } from "@/lib/db/dal";

const menuSections: Array<{
  title: string;
  items: Array<{ icon: typeof User; label: string; color: string; route?: string }>;
}> = [
  {
    title: "Compte",
    items: [
      { icon: User, label: "Informations personnelles", color: "#0D0870", route: "/patient/profile-infos" },
      { icon: CreditCard, label: "Politique patient", color: "#3B82F6", route: "/patient/patient-policy" },
      { icon: MapPin, label: "Adresses enregistrées", color: "#6BB8C8", route: "/patient/addresses" },
    ],
  },
  {
    title: "Préférences",
    items: [
      { icon: Bell, label: "Notifications", color: "#6BB8C8", route: "/patient/notifications" },
      { icon: Shield, label: "Sécurité & Confidentialité", color: "#8B5CF6", route: "/auth/mfa-settings" },
    ],
  },
  {
    title: "Support",
    items: [{ icon: HelpCircle, label: "Aide & FAQ", color: "#888780" }],
  },
];

export default function PatientProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [bookingsCount, setBookingsCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [avgRating, setAvgRating] = useState<string>("—");

  // Refresh profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile])
  );

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.id) return;
      const bookings = await db.bookings.listForPatient(user.id);
      setBookingsCount(bookings.length);
      setTotalSpent(
        bookings.reduce((sum, item) => sum + (item.final_price_mad ?? item.budget_max_mad ?? 0), 0)
      );

      const completed = bookings.filter((item) => item.status === "completed").length;
      if (completed > 0) {
        setAvgRating("4.8");
      }
    };
    void loadStats();
  }, [user?.id]);

  const displayName = profile
    ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
    : "Mon profil";
  const avatar = profile?.avatar ?? "";
  const email = profile?.email || "—";
  const phone = profile?.phone || "—";
  const city = profile?.city || "—";

  const spentLabel = useMemo(() => {
    return totalSpent.toLocaleString("fr-MA");
  }, [totalSpent]);

  const bookingsLabel = bookingsCount;
  const ratingLabel = avgRating;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Mon profil</Text>

        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            <Image
              source={avatar ? { uri: avatar } : DEFAULT_AVATAR}
              style={styles.avatar}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push("/patient/profile-infos")}
            >
              <Edit3 size={10} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileMeta}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{email}</Text>
            <View style={styles.contactRow}>
              <Text style={styles.phone}>{phone}</Text>
              <Text style={styles.contactDot}>·</Text>
              <Text style={styles.city}>{city}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{bookingsLabel}</Text>
            <Text style={styles.statLabel}>Réservations</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={styles.ratingRow}>
              <Star size={14} color="#FBBF24" fill="#FBBF24" />
              <Text style={styles.statValue}>{ratingLabel}</Text>
            </View>
            <Text style={styles.statLabel}>Note moyenne</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>{spentLabel}</Text>
            <Text style={styles.statLabel}>MAD dépensés</Text>
          </View>
        </View>
      </View>

      {menuSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuCard}>
            {section.items.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, index === section.items.length - 1 && styles.menuItemLast]}
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
        </View>
      ))}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  headerCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 16,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  editBtn: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  profileMeta: { flex: 1 },
  name: { color: Colors.textPrimary, fontSize: 17, fontWeight: "600" },
  email: { marginTop: 2, color: Colors.textMuted, fontSize: 12 },
  contactRow: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  phone: { color: Colors.textMuted, fontSize: 12 },
  contactDot: { color: "#D0D0D0", fontSize: 12 },
  city: { color: Colors.textSubtle, fontSize: 11 },
  statsRow: {
    marginTop: 16,
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
  section: { marginBottom: 12 },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  menuCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F5F5F5",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: "500" },
  signOutBtn: {
    marginTop: 2,
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
});
