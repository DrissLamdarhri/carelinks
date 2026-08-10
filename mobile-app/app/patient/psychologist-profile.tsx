import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, BadgeCheck, CalendarClock, MapPin, MessageSquare, Star, Video } from "lucide-react-native";
import { Colors, Gradients, Shadows } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { ReviewsList } from "@/components/ReviewsList";
import { db } from "@/lib/db/dal";

const initialsOf = (n: string) => n.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";


export default function PsychologistProfileScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const p = useLocalSearchParams<{ id?: string; name?: string; price?: string; focus?: string; rating?: string; reviews?: string }>();
  const name = (typeof p.name === "string" && p.name) || t("clinical_psychologist");
  const price = Number(p.price) || 0;
  const focus = (typeof p.focus === "string" && p.focus) || t("clinical_psychologist");
  // Real credentials, read from the professional's record. These used to be
  // hardcoded ("4.9", "42 reviews", "8+" years, "320" sessions) — the same
  // invented figures shown for every psychologist, which is not something we
  // can put in front of a patient choosing who enters their care.
  const [stats, setStats] = useState<{ rating: number; reviews: number; years: number; sessions: number } | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  useEffect(() => {
    if (!p.id) return;
    let alive = true;
    void (async () => {
      const pro = await db.pros.get(p.id as string).catch(() => null);
      if (alive && pro) {
        setBio(pro.bio ?? null);
        setStats({
          rating: Number(pro.rating_avg ?? 0),
          reviews: Number(pro.rating_count ?? 0),
          years: Number(pro.years_experience ?? 0),
          sessions: Number(pro.total_bookings ?? 0),
        });
      }
    })();
    return () => { alive = false; };
  }, [p.id]);

  const rating = stats?.rating ?? Number(p.rating) ?? 0;
  const reviews = stats?.reviews ?? Number(p.reviews) ?? 0;

  const book = () =>
    router.push(`/patient/psychologist?proId=${encodeURIComponent(String(p.id ?? ""))}&name=${encodeURIComponent(name)}&price=${price}`);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={Gradients.psy} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>
          <View style={s.heroBlob} />
          <View style={s.avatar}><Text style={s.avatarTxt}>{initialsOf(name)}</Text></View>
          <View style={s.nameRow}>
            <Text style={s.name}>{name}</Text>
            <BadgeCheck size={18} color="#C4B5FD" fill="#7C3AED" />
          </View>
          <Text style={s.role}>{focus}</Text>
        </LinearGradient>

        {/* Floating stats */}
        <View style={s.statsCard}>
          <View style={s.stat}>
            <View style={s.statTop}><Star size={15} color="#FBBF24" fill="#FBBF24" /><Text style={s.statVal}>{reviews > 0 ? rating.toFixed(1) : "—"}</Text></View>
            <Text style={s.statLbl}>{reviews > 0 ? `${reviews} ${t("reviews_word")}` : t("no_reviews_yet")}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statVal}>{stats?.years ? `${stats.years}+` : "—"}</Text>
            <Text style={s.statLbl}>{t("experience")}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statVal}>{stats?.sessions ?? "—"}</Text>
            <Text style={s.statLbl}>{t("sessions_label")}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* About */}
          <Text style={s.h}>{t("about_label")}</Text>
          {/* The professional's own words, or nothing. This was a fixed
              paragraph of invented biography (`psy_bio_demo`) rendered
              identically under every psychologist's name. */}
          {bio ? <Text style={s.p}>{bio}</Text> : null}

          {/* Specialties */}
          <Text style={s.h}>{t("specialties_label")}</Text>
          <View style={s.chips}>
            {["pat_topic_anxiety", "pat_topic_depression", "pat_topic_cbt", "pat_topic_stress", "pat_topic_self_confidence"].map((c) => (
              <View key={c} style={s.chip}><Text style={s.chipTxt}>{t(c)}</Text></View>
            ))}
          </View>

          {/* Modes */}
          <Text style={s.h}>{t("consultation_modes")}</Text>
          <View style={s.modes}>
            <View style={s.modeCard}><MapPin size={16} color={Colors.primary} /><Text style={s.modeTxt}>{t("mode_in_person")}</Text></View>
            <View style={s.modeCard}><Video size={16} color={Colors.primary} /><Text style={s.modeTxt}>{t("mode_remote")}</Text></View>
          </View>

          {/* Price */}
          <View style={s.priceCard}>
            <View><Text style={s.priceLbl}>{t("consultation")}</Text><Text style={s.priceSub}>{t("per_session")}</Text></View>
            <Text style={s.priceVal}>{price} {t("mad")}</Text>
          </View>

          {/* Reviews — real data only. Fabricated testimonials were being shown
              here as if they were genuine patient feedback. */}
          <Text style={s.h}>{t("patient_reviews")}</Text>
          {p.id ? <ReviewsList professionalId={p.id} /> : null}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={s.footer}>
        <View style={s.footerPrice}><Text style={s.footerPriceVal}>{price} {t("mad")}</Text><Text style={s.footerPriceUnit}>/{t("per_session")}</Text></View>
        <TouchableOpacity style={s.cta} onPress={book} activeOpacity={0.9}>
          <CalendarClock size={17} color="#fff" />
          <Text style={s.ctaTxt}>{t("book_appointment_short")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const PSY = "#7C3AED";
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  hero: { paddingTop: 54, paddingBottom: 46, alignItems: "center", borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" },
  back: { position: "absolute", top: 50, left: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  heroBlob: { position: "absolute", top: -50, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.08)" },
  avatar: { width: 92, height: 92, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 3, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarTxt: { color: "#fff", fontSize: 30, fontWeight: "800" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: "#fff", fontSize: 22, fontWeight: "800" },
  role: { color: "rgba(255,255,255,0.85)", fontSize: 13.5, marginTop: 3 },
  statsCard: { flexDirection: "row", backgroundColor: "#fff", marginHorizontal: 20, marginTop: -26, borderRadius: 20, paddingVertical: 16, ...Shadows.md },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  statVal: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  statLbl: { color: Colors.textMuted, fontSize: 11 },
  statDivider: { width: 1, backgroundColor: "#F0F0F0", marginVertical: 6 },
  body: { padding: 20 },
  h: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 8, marginTop: 16 },
  p: { color: Colors.textMuted, fontSize: 13.5, lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#F3EEFE", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipTxt: { color: PSY, fontSize: 12.5, fontWeight: "700" },
  modes: { flexDirection: "row", gap: 10 },
  modeCard: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  modeTxt: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  priceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 16, padding: 16, marginTop: 16, ...Shadows.sm },
  priceLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  priceSub: { color: Colors.textMuted, fontSize: 12 },
  priceVal: { color: PSY, fontSize: 20, fontWeight: "800" },
  reviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewScore: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFFBEB", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 10 },
  reviewScoreTxt: { color: "#B45309", fontSize: 12.5, fontWeight: "800" },
  reviewCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginTop: 10, ...Shadows.sm },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F3EEFE", alignItems: "center", justifyContent: "center" },
  reviewAvatarTxt: { color: PSY, fontSize: 13, fontWeight: "800" },
  reviewName: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "700" },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  reviewWhen: { color: Colors.textSubtle, fontSize: 10.5, marginLeft: 4 },
  reviewText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  footerPrice: { },
  footerPriceVal: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  footerPriceUnit: { color: Colors.textMuted, fontSize: 11 },
  cta: { flex: 1, height: 52, borderRadius: 16, backgroundColor: PSY, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
