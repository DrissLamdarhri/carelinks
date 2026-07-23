import { useEffect, useMemo, useState, useCallback } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import {
  ChevronRight,
  CreditCard,
  Edit3,
  Globe,
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
import { useI18n } from "@/lib/i18n";
import { useFocusRefresh } from "@/lib/hooks/useFocusRefresh";
import { useRouter, useFocusEffect } from "expo-router";
import { db } from "@/lib/db/dal";
import { ProfileHeaderCard } from "@/components/ProfileHeaderCard";
import { LanguageSelector } from "@/components/LanguageSelector";
import { toastSuccess } from "@/lib/toast";
import { usePickImage, uploadAvatarToSupabase, updateProfileAvatar } from "@/lib/hooks/useImageUpload";

// `label`/`title` are i18n keys resolved with t() at render.
const menuSections: Array<{
  title: string;
  items: Array<{ icon: typeof User; label: string; color: string; route?: string; action?: string }>;
}> = [
  {
    title: "account",
    items: [
      { icon: User, label: "personal_info", color: "#0D0870", route: "/patient/profile-infos" },
      { icon: CreditCard, label: "patient_policy", color: "#3B82F6", route: "/patient/patient-policy" },
      { icon: MapPin, label: "saved_addresses", color: "#6BB8C8", route: "/patient/addresses" },
    ],
  },
  {
    title: "preferences",
    items: [
      { icon: Globe, label: "language", color: "#0D0870", action: "language" },
      { icon: Bell, label: "notifications", color: "#6BB8C8", route: "/patient/notifications" },
    ],
  },
  {
    title: "support",
    items: [{ icon: HelpCircle, label: "help_faq", color: "#888780" }],
  },
];

export default function PatientProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [langOpen, setLangOpen] = useState(false);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [avgRating, setAvgRating] = useState<string>("—");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Refresh profile when screen comes into focus
  // Profile changes rarely — refresh at most once a minute instead of on every
  // tab switch (was a Supabase round-trip each time the tab regained focus).
  useFocusRefresh(() => {
    void refreshProfile();
  }, 60_000);

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

  const handleUploadAvatar = async () => {
    if (!user?.id) return;
    
    setUploadingAvatar(true);
    try {
      const image = await usePickImage();
      if (!image) {
        setUploadingAvatar(false);
        return;
      }

      const avatarUrl = await uploadAvatarToSupabase(user.id, image.uri);
      if (!avatarUrl) {
        setUploadingAvatar(false);
        return;
      }

      const success = await updateProfileAvatar(user.id, avatarUrl);
      if (success) {
        await refreshProfile();
        toastSuccess("Photo de profil mise à jour ✓");
      }
    } finally {
      setUploadingAvatar(false);
    }
  };

  const displayName = profile
    ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
    : "Mon profil";
  const avatar = profile?.avatar ?? "";
  const email = profile?.email || "—";
  const phone = profile?.phone || "—";
  const city = profile?.city || "—";
  const initials = profile ? `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}` : "?";

  const spentLabel = useMemo(() => {
    return totalSpent.toLocaleString("fr-MA");
  }, [totalSpent]);

  const bookingsLabel = bookingsCount;
  const ratingLabel = avgRating;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ProfileHeaderCard
        title="Mon profil"
        name={displayName}
        email={email}
        phone={phone}
        city={city}
        avatarUrl={avatar}
        initials={initials}
        uploading={uploadingAvatar}
        onEditAvatar={handleUploadAvatar}
        stats={[
          { value: bookingsLabel, label: "Réservations" },
          { value: ratingLabel, label: "Note moyenne", star: true },
          { value: spentLabel, label: "MAD dépensés", accent: true },
        ]}
      />

      <View style={styles.body}>
      {menuSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{t(section.title)}</Text>
          <View style={styles.menuCard}>
            {section.items.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, index === section.items.length - 1 && styles.menuItemLast]}
                onPress={() => {
                  if (item.action === "language") setLangOpen(true);
                  else if (item.route) router.push(item.route as never);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: `${item.color}18` }]}>
                  <item.icon size={16} color={item.color} />
                </View>
                <Text style={styles.menuText}>{t(item.label)}</Text>
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
        <Text style={styles.signOutText}>{t("sign_out")}</Text>
      </TouchableOpacity>
      </View>

      <LanguageSelector visible={langOpen} onClose={() => setLangOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { paddingBottom: 24 },
  body: { paddingHorizontal: 20, paddingTop: 16 },
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
