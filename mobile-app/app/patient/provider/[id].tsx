import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Clock3,
  Home,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
} from "lucide-react-native";
import { Colors, Gradients, Shadows } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { ReviewsList } from "@/components/ReviewsList";
import { db } from "@/lib/db/dal";
import type { Professional, Profile } from "@/lib/db/types";
import { mockProfessionals } from "@/lib/mock-data";

// Gradient tuned to the pro's specialty so the profile feels part of that
// service's world (same palette as the psychologist "zoomed" profile).
const SPEC_GRADIENT: Record<string, readonly [string, string]> = {
  nurse: Gradients.nurse,
  physiotherapist: Gradients.kine,
  psychologist: Gradients.psy,
  yoga_instructor: Gradients.yoga,
};
const SPEC_LABEL_KEY: Record<string, string> = {
  nurse: "spec_nurse",
  physiotherapist: "spec_physio",
  psychologist: "spec_psy",
  yoga_instructor: "spec_yoga",
};

// Real service categories per specialty (i18n keys) — keeps the profile
// meaningful and structured even for a new pro with no reviews. Not pro-specific
// data, so nothing is fabricated about the individual.
const SPEC_SERVICES: Record<string, string[]> = {
  nurse: ["svc_injection", "svc_dressing", "svc_infusion", "svc_bloodtest"],
  physiotherapist: ["focus_motor", "focus_resp", "focus_drainage", "focus_massage"],
  psychologist: ["svc_anxiety", "svc_stress", "svc_followup"],
  yoga_instructor: ["svc_yoga_individual", "svc_yoga_relax"],
};

export default function ProviderProfileScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const providerId = params.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadProvider = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [nextProfile, nextProfessional] = await Promise.all([
          db.profiles.get(providerId).catch(() => null),
          db.pros.get(providerId).catch(() => null),
        ]);
        if (!cancelled) {
          setProfile(nextProfile);
          setProfessional(nextProfessional);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : t("pro_not_found_short"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadProvider();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const fallback = useMemo(
    () => mockProfessionals.find((item) => item.id === providerId),
    [providerId]
  );

  const displayName =
    profile?.full_name ||
    (fallback ? `${fallback.firstName} ${fallback.lastName}` : "Professionnel");
  const avatar = profile?.avatar_url || fallback?.avatar || null;
  const city = profile?.city || fallback?.city || "Maroc";
  const rating = professional?.rating_avg ?? fallback?.rating ?? 0;
  const reviewCount = professional?.rating_count ?? fallback?.reviewCount ?? 0;
  const isVerified = professional?.verification_status === "approved" || Boolean(fallback);
  const specialtyKey = professional?.specialty ?? "";
  const specialty = SPEC_LABEL_KEY[specialtyKey]
    ? t(SPEC_LABEL_KEY[specialtyKey])
    : professional?.specialty
    ? professional.specialty.replaceAll("_", " ")
    : fallback?.specialty || t("health_professional");
  const gradient = SPEC_GRADIENT[specialtyKey] ?? Gradients.nurse;
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const experience = professional?.years_experience
    ? `${professional.years_experience}+`
    : "—";
  const price = professional?.hourly_rate_mad ?? fallback?.minPrice ?? null;
  const services = (SPEC_SERVICES[specialtyKey] ?? []).map((k) => t(k));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroBlob} />
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroAvatarWrap}>
            {/* Photo is obligatory for trust; initials only when a pro truly has none. */}
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.heroAvatar} />
            ) : (
              <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
                <Text style={styles.heroAvatarText}>{initials}</Text>
              </View>
            )}
            {isVerified ? (
              <View style={styles.heroVerified}>
                <BadgeCheck size={16} color="#fff" fill={Colors.primary} />
              </View>
            ) : null}
          </View>

          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroSpecialty}>{specialty}</Text>
          <View style={styles.heroCityRow}>
            <MapPin size={12} color="rgba(255,255,255,0.85)" />
            <Text style={styles.heroCity}>{city}</Text>
          </View>
        </LinearGradient>

        {/* ── Floating stats ── */}
        <View style={styles.statsCard}>
          <View style={styles.statCol}>
            <View style={styles.ratingRow}>
              <Star size={15} color="#FBBF24" fill="#FBBF24" />
              <Text style={styles.statValue}>{rating > 0 ? rating.toFixed(1) : t("new_badge")}</Text>
            </View>
            <Text style={styles.statLabel}>
              {reviewCount > 0 ? `${reviewCount} ${t("reviews_word")}` : t("no_reviews_yet")}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{experience}</Text>
            <Text style={styles.statLabel}>{t("experience")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>{price ?? "—"}</Text>
            <Text style={styles.statLabel}>MAD / {t("care_unit")}</Text>
          </View>
        </View>

        {/* ── Quick info ── */}
        <View style={styles.quickInfoRow}>
          {[
            { icon: Clock3, text: t("by_appointment") },
            { icon: Award, text: isVerified ? t("verified_check") : t("pending_status") },
            { icon: MapPin, text: city },
          ].map((item, index) => (
            <View key={`${item.text}-${index}`} style={styles.quickInfoChip}>
              <item.icon size={14} color={Colors.primary} />
              <Text style={styles.quickInfoText} numberOfLines={1}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* ── About ── */}
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>{t("about_label")}</Text>
          <Text style={styles.aboutText}>{t("pro_bio_generic")}</Text>
        </View>

        {/* ── Services offered (by specialty) — real service categories, so the
            page stays meaningful even for a brand-new pro with no reviews yet. ── */}
        {services.length > 0 ? (
          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>{t("services_offered")}</Text>
            <View style={styles.chipsWrap}>
              {services.map((s) => (
                <View key={s} style={styles.serviceChip}>
                  <Text style={styles.serviceChipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Trust row — true platform guarantees, reassuring and structured. ── */}
        <View style={styles.trustCard}>
          {[
            { icon: BadgeCheck, text: t("trust_verified") },
            { icon: ShieldCheck, text: t("trust_secure_pay") },
            { icon: Home, text: t("trust_at_home") },
          ].map((item, i) => (
            <View key={i} style={styles.trustItem}>
              <View style={styles.trustIcon}>
                <item.icon size={16} color={Colors.primary} />
              </View>
              <Text style={styles.trustText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {providerId ? <ReviewsList professionalId={providerId} /> : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>

      {/* ── Footer: contact stays in-app (booking / messaging), never a raw
          phone number — that would let patients bypass the platform. ── */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/patient/messages")}>
          <MessageCircle size={20} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.requestBtn} onPress={() => router.push("/patient/request")}>
          <Text style={styles.requestBtnText}>{t("request_care")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceWarm },

  hero: {
    paddingTop: 54,
    paddingBottom: 44,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  heroBlob: {
    position: "absolute", top: -50, right: -40, width: 180, height: 180,
    borderRadius: 90, backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroTop: { position: "absolute", top: 20, left: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  heroAvatarWrap: { position: "relative", marginBottom: 12 },
  heroAvatar: { width: 96, height: 96, borderRadius: 28, borderWidth: 3, borderColor: "rgba(255,255,255,0.5)" },
  heroAvatarFallback: { backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroAvatarText: { color: "#fff", fontSize: 34, fontWeight: "800" },
  heroVerified: {
    position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  heroName: { color: "#fff", fontSize: 21, fontWeight: "800", textAlign: "center" },
  heroSpecialty: { color: "rgba(255,255,255,0.9)", fontSize: 13.5, marginTop: 2, textTransform: "capitalize" },
  heroCityRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  heroCity: { color: "rgba(255,255,255,0.85)", fontSize: 12.5 },

  statsCard: {
    flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 20, marginTop: -24,
    borderRadius: 20, paddingVertical: 16, ...Shadows.md,
  },
  statCol: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { width: 1, height: 34, backgroundColor: "#F0F0F0", alignSelf: "center" },
  statValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: "700" },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  quickInfoRow: {
    marginTop: 14,
    marginHorizontal: 20,
    flexDirection: "row",
    gap: 8,
  },
  quickInfoChip: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "white",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quickInfoText: { color: Colors.textPrimary, fontSize: 11, fontWeight: "500", flex: 1 },
  aboutCard: {
    marginTop: 12,
    marginHorizontal: 20,
    borderRadius: 14,
    backgroundColor: "white",
    padding: 14,
  },
  aboutTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 6 },
  aboutText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  serviceChip: {
    backgroundColor: Colors.surfaceWarm, borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 7,
  },
  serviceChipText: { color: Colors.textPrimary, fontSize: 12.5, fontWeight: "600" },
  trustCard: {
    marginTop: 12, marginHorizontal: 20, borderRadius: 14, backgroundColor: "white",
    paddingVertical: 14, paddingHorizontal: 12, flexDirection: "row", justifyContent: "space-between",
  },
  trustItem: { flex: 1, alignItems: "center", gap: 6, paddingHorizontal: 4 },
  trustIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surfaceWarm,
    alignItems: "center", justifyContent: "center",
  },
  trustText: { color: Colors.textMuted, fontSize: 10.5, fontWeight: "600", textAlign: "center" },
  footer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  requestBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  requestBtnText: { color: "white", fontSize: 14, fontWeight: "600" },
  errorText: {
    marginTop: 10,
    marginHorizontal: 20,
    color: Colors.danger,
    fontSize: 12,
  },
});
