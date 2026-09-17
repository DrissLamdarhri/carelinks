/**
 * CareLink — Explorer.
 *
 * The second tab used to be `yoga.tsx` wearing an "Explorer" label, so tapping
 * Explorer dropped the patient straight into one single discipline. Yoga is a
 * quarter of what CareLink offers; a browse tab that commits to one specialty
 * before the patient has chosen anything is simply the wrong screen.
 *
 * This is that screen: every specialty, then the professionals who are online
 * near you right now, with a filter that ties the two together.
 *
 * Data comes from the same places the home screen uses — `primaryServices` for
 * the catalogue, `geo.findNearbyProsForMap` for live availability — so the two
 * tabs can never disagree about who is working.
 */
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, Brain, Flower2, Search, Syringe } from "lucide-react-native";
import { Colors, Gradients } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useFocusRefresh } from "@/lib/hooks/useFocusRefresh";
import { primaryServices } from "@/lib/mock-data";
import { geo, type NearbyProMapItem } from "@/lib/db/geo";
import { SPEC_LABEL } from "@/lib/care-label";
import { AvatarWithDefault } from "@/components/AvatarWithDefault";

const serviceIconMap = { syringe: Syringe, brain: Brain, flower2: Flower2, activity: Activity } as const;

// Same city default the home screen falls back to before a patient position
// exists. Kept identical on purpose — two different defaults would put the same
// professional at two different distances depending on the tab you came from.
const HOME_CENTER = { lat: 34.037, lng: -5.004 };

/** Catalogue key → the specialty string stored on a professional row. */
const KEY_TO_SPECIALTY: Record<string, string> = {
  infirmier: "nurse",
  psy: "psychologist",
  yoga: "yoga",
  kine: "physiotherapist",
};

/** Where each catalogue card leads. Unchanged from the home screen. */
function routeForService(key: string): string {
  if (key === "psy") return "/patient/psychologists";
  if (key === "yoga") return "/patient/yoga";
  if (key === "kine") return "/patient/kine";
  return `/patient/request?service=${key}`;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { t } = useI18n();

  const [pros, setPros] = useState<NearbyProMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  useFocusRefresh(
    useCallback(async () => {
      setLoading(true);
      try {
        setPros(
          await geo.findNearbyProsForMap(HOME_CENTER.lat, HOME_CENTER.lng, {
            radiusKm: 100,
            limit: 30,
          }),
        );
      } catch {
        setPros([]);
      } finally {
        setLoading(false);
      }
    }, []),
    30_000,
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pros.filter((p) => {
      if (filter && p.specialty !== KEY_TO_SPECIALTY[filter]) return false;
      if (!q) return true;
      return (p.full_name ?? "").toLowerCase().includes(q);
    });
  }, [pros, query, filter]);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.body}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.h1}>{t("explore")}</Text>

      <View style={s.searchWrap}>
        <Search size={17} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={s.searchInput}
          placeholder={t("explore_search_ph")}
          placeholderTextColor={Colors.textSubtle}
          returnKeyType="search"
        />
      </View>

      <Text style={s.sectionTitle}>{t("choose_service")}</Text>
      <View style={s.grid}>
        {primaryServices.map((svc) => {
          const Icon = serviceIconMap[svc.icon as keyof typeof serviceIconMap];
          const gradient =
            svc.gradient === "nurse" ? Gradients.nurse
            : svc.gradient === "psy" ? Gradients.psy
            : svc.gradient === "yoga" ? Gradients.yoga
            : Gradients.kine;
          return (
            <TouchableOpacity
              key={svc.key}
              style={s.card}
              activeOpacity={0.9}
              onPress={() => router.push(routeForService(svc.key) as never)}
            >
              <Image source={{ uri: svc.image }} style={s.cardImage} />
              <LinearGradient colors={[gradient[0], "rgba(0,0,0,0.45)"]} style={s.cardOverlay} />
              <View style={s.cardText}>
                {Icon ? <Icon size={19} color="#fff" strokeWidth={2} /> : null}
                <Text style={s.cardTitle}>{t(svc.label)}</Text>
                <Text style={s.cardSub} numberOfLines={2}>{t(svc.sub)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.sectionTitle}>{t("explore_available_now")}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
        <View style={s.filterRow}>
          <TouchableOpacity
            onPress={() => setFilter(null)}
            style={[s.chip, filter === null && s.chipOn]}
          >
            <Text style={[s.chipTxt, filter === null && s.chipTxtOn]}>{t("explore_filter_all")}</Text>
          </TouchableOpacity>
          {primaryServices.map((svc) => {
            const on = filter === svc.key;
            return (
              <TouchableOpacity
                key={svc.key}
                onPress={() => setFilter(on ? null : svc.key)}
                style={[s.chip, on && s.chipOn]}
              >
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{t(svc.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {loading ? (
        <View style={s.empty}><ActivityIndicator color={Colors.primary} /></View>
      ) : visible.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>{t("no_pros_nearby")}</Text>
        </View>
      ) : (
        visible.map((p) => {
          const label = SPEC_LABEL[p.specialty] ? t(SPEC_LABEL[p.specialty]) : p.specialty;
          return (
            <TouchableOpacity
              key={p.id}
              style={s.proRow}
              activeOpacity={0.85}
              onPress={() => router.push(`/patient/provider/${p.id}` as never)}
            >
              <AvatarWithDefault avatarUrl={p.avatar_url} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={s.proName} numberOfLines={1}>{p.full_name ?? "—"}</Text>
                <Text style={s.proMeta} numberOfLines={1}>
                  {label}
                  {p.rating_avg != null ? ` · ★ ${p.rating_avg.toFixed(1)}` : ""}
                </Text>
              </View>
              <Text style={s.proDist}>{p.distanceKm.toFixed(1)} km</Text>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  body: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 30 },
  h1: { fontSize: 26, fontWeight: "800", color: Colors.textPrimary, marginBottom: 14 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 13, height: 48,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: Colors.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary, marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47.5%", height: 132, borderRadius: 18, overflow: "hidden", backgroundColor: "#DDD",
  },
  cardImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  cardOverlay: { ...StyleSheet.absoluteFillObject },
  cardText: { position: "absolute", left: 12, right: 12, bottom: 11, gap: 3 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  cardSub: { color: "rgba(255,255,255,0.88)", fontSize: 11, lineHeight: 14 },
  filterScroll: { marginBottom: 14, marginTop: -2 },
  filterRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5, borderColor: "#E8E8E8", backgroundColor: "#fff",
  },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  chipTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.textMuted },
  chipTxtOn: { color: "#fff" },
  proRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  proName: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary },
  proMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  proDist: { fontSize: 13, fontWeight: "800", color: Colors.primary },
  empty: { paddingVertical: 34, alignItems: "center" },
  emptyTxt: { color: Colors.textMuted, fontSize: 13.5 },
});
