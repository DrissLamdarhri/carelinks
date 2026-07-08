import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Award,
  Clock3,
  MapPin,
  MessageCircle,
  Phone,
  Shield,
  Star,
} from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { ReviewsList } from "@/components/ReviewsList";
import { db } from "@/lib/db/dal";
import type { Professional, Profile } from "@/lib/db/types";
import { mockProfessionals } from "@/lib/mock-data";

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
  const phone = profile?.phone || fallback?.phone || null;
  const rating = professional?.rating_avg ?? fallback?.rating ?? 0;
  const reviewCount = professional?.rating_count ?? fallback?.reviewCount ?? 0;
  const isVerified = professional?.verification_status === "approved" || Boolean(fallback);
  const specialty = professional?.specialty
    ? professional.specialty.replaceAll("_", " ")
    : fallback?.specialty || "professionnel de santé";

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatarWrap}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {displayName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                </View>
              )}
              {isVerified ? (
                <View style={styles.verifiedBadge}>
                  <Shield size={10} color="white" />
                </View>
              ) : null}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.specialty}>{specialty}</Text>
              <View style={styles.cityRow}>
                <MapPin size={11} color={Colors.textMuted} />
                <Text style={styles.city}>{city}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <View style={styles.ratingRow}>
                <Star size={14} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.statValue}>
                  {rating > 0 ? rating.toFixed(1) : t("new_badge")}
                </Text>
              </View>
              <Text style={styles.statLabel}>
                {reviewCount > 0 ? `${reviewCount} avis` : t("no_reviews_yet")}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{professional?.years_experience ?? "—"}</Text>
              <Text style={styles.statLabel}>{t("experience")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { color: Colors.primary }]}>
                {professional?.hourly_rate_mad ?? fallback?.minPrice ?? "—"}
              </Text>
              <Text style={styles.statLabel}>MAD / soin</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickInfoRow}>
          {[
            { icon: Clock3, text: t("by_appointment") },
            { icon: Award, text: isVerified ? t("verified_check") : t("pending_status") },
            { icon: MapPin, text: city },
          ].map((item, index) => (
            <View key={`${item.text}-${index}`} style={styles.quickInfoChip}>
              <item.icon size={14} color={Colors.primary} />
              <Text style={styles.quickInfoText} numberOfLines={1}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>À propos</Text>
          <Text style={styles.aboutText}>
            Professionnel certifié CareLink, interventions à domicile avec approche humaine et
            ponctuelle.
          </Text>
        </View>

        {providerId ? <ReviewsList professionalId={providerId} /> : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        {phone ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              void Linking.openURL(`tel:${phone}`);
            }}
          >
            <Phone size={20} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            if (phone) {
              const sanitized = phone.replace(/[^\d]/g, "");
              void Linking.openURL(`https://wa.me/${sanitized}`);
            } else {
              router.push("/patient/messages");
            }
          }}
        >
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
  top: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 70,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, marginTop: -52 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceWarm },
  card: {
    marginHorizontal: 20,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  avatar: { width: 80, height: 80, borderRadius: 18 },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 18,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { color: Colors.primary, fontSize: 28, fontWeight: "700" },
  verifiedBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: Colors.textPrimary, fontSize: 18, fontWeight: "700" },
  specialty: { color: Colors.textMuted, fontSize: 13, textTransform: "capitalize", marginTop: 2 },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  city: { color: Colors.textMuted, fontSize: 12 },
  statsRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statCol: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 34, backgroundColor: "#F0F0F0" },
  statValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: "700" },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  quickInfoRow: {
    marginTop: 12,
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
