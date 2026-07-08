import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, BadgeCheck, CalendarClock, MapPin, MessageSquare, Star, Video } from "lucide-react-native";
import { Colors, Gradients, Shadows } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";

const initialsOf = (n: string) => n.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

// Demo review cards (shown for the visual "zoomed" profile).
const DEMO_REVIEWS = [
  { id: "r1", name: "Salma B.", stars: 5, text: "À l'écoute et très professionnelle. Je me sens beaucoup mieux.", when: "il y a 2 sem." },
  { id: "r2", name: "Youssef T.", stars: 5, text: "Approche bienveillante, séances en visio pratiques.", when: "il y a 1 mois" },
  { id: "r3", name: "Nadia F.", stars: 4, text: "Très bon suivi, je recommande.", when: "il y a 1 mois" },
];

export default function PsychologistProfileScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const p = useLocalSearchParams<{ id?: string; name?: string; price?: string; focus?: string; rating?: string; reviews?: string }>();
  const name = (typeof p.name === "string" && p.name) || "Dr. Dalila Mansouri";
  const price = Number(p.price) || 200;
  const focus = (typeof p.focus === "string" && p.focus) || t("clinical_psychologist");
  const rating = Number(p.rating) || 4.9;
  const reviews = Number(p.reviews) || 42;

  const book = () =>
    router.push(`/patient/psychologist?proId=${encodeURIComponent(p.id ?? "demo")}&name=${encodeURIComponent(name)}&price=${price}`);

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
            <View style={s.statTop}><Star size={15} color="#FBBF24" fill="#FBBF24" /><Text style={s.statVal}>{rating.toFixed(1)}</Text></View>
            <Text style={s.statLbl}>{reviews} {t("reviews_word")}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statVal}>8+</Text>
            <Text style={s.statLbl}>{t("experience")}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statVal}>320</Text>
            <Text style={s.statLbl}>{t("sessions_label")}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* About */}
          <Text style={s.h}>{t("about_label")}</Text>
          <Text style={s.p}>
            {t("psy_bio_demo")}
          </Text>

          {/* Specialties */}
          <Text style={s.h}>{t("specialties_label")}</Text>
          <View style={s.chips}>
            {["Anxiété", "Dépression", "TCC", "Stress", "Confiance en soi"].map((c) => (
              <View key={c} style={s.chip}><Text style={s.chipTxt}>{c}</Text></View>
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
            <Text style={s.priceVal}>{price} MAD</Text>
          </View>

          {/* Reviews */}
          <View style={s.reviewHead}>
            <Text style={s.h}>{t("patient_reviews")}</Text>
            <View style={s.reviewScore}><Star size={13} color="#FBBF24" fill="#FBBF24" /><Text style={s.reviewScoreTxt}>{rating.toFixed(1)}</Text></View>
          </View>
          {DEMO_REVIEWS.map((r) => (
            <View key={r.id} style={s.reviewCard}>
              <View style={s.reviewTop}>
                <View style={s.reviewAvatar}><Text style={s.reviewAvatarTxt}>{initialsOf(r.name)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.reviewName}>{r.name}</Text>
                  <View style={s.starsRow}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={11} color={i <= r.stars ? "#FBBF24" : "#E0E0E0"} fill={i <= r.stars ? "#FBBF24" : "#E0E0E0"} />
                    ))}
                    <Text style={s.reviewWhen}>· {r.when}</Text>
                  </View>
                </View>
              </View>
              <Text style={s.reviewText}>{r.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={s.footer}>
        <View style={s.footerPrice}><Text style={s.footerPriceVal}>{price} MAD</Text><Text style={s.footerPriceUnit}>/{t("per_session")}</Text></View>
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
