import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, ChevronRight, MapPin, Star, Video } from "lucide-react-native";
import { Colors, Shadows } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { CareLinkMapView } from "@/components/map/CareLinkMapView";
import type { ProPinData } from "@/components/map/Pins";

const PSY = "#7C3AED";
const PSY_DARK = "#5B21B6";
const CENTER = { lat: 33.8935, lng: -5.5473 }; // Meknès
const SCREEN_W = Dimensions.get("window").width;
const CARD_W = SCREEN_W - 56;
const GAP = 12;

type Psy = { id: string; name: string; focus: string; price: number; rating: number; reviews: number; lat: number; lng: number };
const initials = (n: string) => n.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
const shortOf = (n: string) => n.replace(/^Dr\.?\s*/i, "").split(" ")[0] ?? n;

export default function PsychologistsMapScreen() {
  const { t } = useI18n();
  const router = useRouter();
  // Real approved psychologists only. This screen used to merge three invented
  // ones ("Dr. Dalila Mansouri" and friends) into the list, AND scatter the
  // real ones around a hardcoded Meknès centre with fabricated offsets — so
  // every pin on the map was in the wrong place, whether the person existed or
  // not. Positions now come from the professional's own recorded location, and
  // anyone without one is simply not plotted.
  const [extra, setExtra] = useState<Psy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase
          .from("v_pros_public")
          .select("id, full_name, rating_avg, rating_count, hourly_rate_mad, lat, lng")
          .eq("specialty", "psychologist");
        const mapped: Psy[] = (data ?? [])
          .filter((p: any) => p.lat != null && p.lng != null)
          .map((p: any) => ({
            id: p.id,
            name: p.full_name ?? t("clinical_psychologist"),
            focus: t("clinical_psychologist"),
            price: p.hourly_rate_mad ?? 0,
            rating: p.rating_avg ?? 0,
            reviews: p.rating_count ?? 0,
            lat: p.lat,
            lng: p.lng,
          }));
        if (active) setExtra(mapped);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const all = extra;
  const pins: ProPinData[] = useMemo(
    () => all.map((p) => ({
      id: p.id, initials: initials(p.name), name: p.name, shortName: shortOf(p.name), specialty: p.focus,
      rating: p.rating, priceMad: p.price,
      distanceKm: Math.round(Math.hypot((p.lat - CENTER.lat) * 111, (p.lng - CENTER.lng) * 95) * 10) / 10,
      lat: p.lat, lng: p.lng,
    })),
    [all]
  );

  const selectAt = (id: string) => {
    setSelectedId(id);
    const idx = all.findIndex((p) => p.id === id);
    if (idx >= 0) scrollRef.current?.scrollTo({ x: idx * (CARD_W + GAP), animated: true });
  };

  const openProfile = (p: Psy) =>
    router.push(`/patient/psychologist-profile?id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name)}&price=${p.price}&focus=${encodeURIComponent(p.focus)}&rating=${p.rating}&reviews=${p.reviews}`);

  return (
    <View style={s.root}>
      <CareLinkMapView
        center={CENTER}
        pros={pins}
        radiusKm={9}
        primaryColor={PSY}
        selectedProId={selectedId}
        onSelectPro={(id) => selectAt(id)}
      />

      {/* Floating glass top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <LinearGradient colors={[PSY, PSY_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.titlePill}>
          <Text style={s.titlePillTxt}>{t("psychologists_title")}</Text>
          <View style={s.countDot}><Text style={s.countTxt}>{all.length}</Text></View>
        </LinearGradient>
      </View>
      <Text style={s.hint}>{t("psychologists_map_hint")}</Text>

      {/* Bottom carousel synced with pins */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.carousel}
        contentContainerStyle={s.carouselContent}
        snapToInterval={CARD_W + GAP}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + GAP));
          const p = all[idx];
          if (p) setSelectedId(p.id);
        }}
      >
        {/* An empty carousel with an empty map used to be impossible, because
            three invented psychologists guaranteed content. Now it can happen,
            and saying so is better than a blank strip. */}
        {!loading && all.length === 0 ? (
          <View style={[s.card, s.cardEmpty]}>
            <Text style={s.cardFocus}>{t("no_pros_nearby")}</Text>
          </View>
        ) : null}
        {all.map((p) => {
          const on = p.id === selectedId;
          return (
            <TouchableOpacity key={p.id} activeOpacity={0.92} onPress={() => openProfile(p)} style={[s.card, on && s.cardOn]}>
              <LinearGradient colors={[PSY, PSY_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardAvatar}>
                <Text style={s.cardAvatarTxt}>{initials(p.name)}</Text>
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.cardFocus} numberOfLines={1}>{p.focus}</Text>
                <View style={s.metaRow}>
                  <Star size={12} color="#FBBF24" fill="#FBBF24" />
                  <Text style={s.rating}>{p.rating.toFixed(1)}</Text>
                  {p.reviews ? <Text style={s.reviews}>({p.reviews})</Text> : null}
                  <View style={s.badge}><MapPin size={9} color={PSY} /></View>
                  <View style={s.badge}><Video size={9} color={PSY} /></View>
                </View>
              </View>
              <View style={s.cardRight}>
                <Text style={s.price}>{p.price}</Text>
                <Text style={s.priceUnit}>{t("mad_per_session")}</Text>
                <View style={s.viewChip}>
                  <Text style={s.viewChipTxt}>{t("about_label")}</Text>
                  <ChevronRight size={13} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  topBar: { position: "absolute", top: 50, left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 10, zIndex: 20 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.96)", alignItems: "center", justifyContent: "center", ...Shadows.md },
  titlePill: { flexDirection: "row", alignItems: "center", gap: 8, height: 42, paddingHorizontal: 16, borderRadius: 21, ...Shadows.md },
  titlePillTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  countDot: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  countTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  hint: { position: "absolute", top: 100, alignSelf: "center", color: PSY_DARK, backgroundColor: "rgba(255,255,255,0.9)", overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, fontSize: 11.5, fontWeight: "700", zIndex: 20 },
  carousel: { position: "absolute", bottom: 28, left: 0, right: 0, zIndex: 20 },
  carouselContent: { paddingHorizontal: 28, gap: GAP },
  card: { width: CARD_W, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 20, padding: 14, borderWidth: 2, borderColor: "transparent", ...Shadows.lg },
  cardOn: { borderColor: PSY },
  cardAvatar: { width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  cardAvatarTxt: { color: "#fff", fontSize: 18, fontWeight: "800" },
  cardName: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  cardEmpty: { alignItems: "center", justifyContent: "center" },
  cardFocus: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  rating: { color: Colors.textPrimary, fontSize: 12.5, fontWeight: "700" },
  reviews: { color: Colors.textMuted, fontSize: 11 },
  badge: { width: 18, height: 18, borderRadius: 6, backgroundColor: "#F3EEFE", alignItems: "center", justifyContent: "center", marginLeft: 2 },
  cardRight: { alignItems: "flex-end", gap: 2 },
  price: { color: PSY, fontSize: 17, fontWeight: "800" },
  priceUnit: { color: Colors.textMuted, fontSize: 9 },
  viewChip: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: PSY, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
  viewChipTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
