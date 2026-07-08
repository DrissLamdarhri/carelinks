import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { BookingMap } from "@/components/BookingMap";
import type { ProPinData } from "@/components/map/Pins";

const PSY = "#7C3AED";
const CENTER = { lat: 33.8935, lng: -5.5473 }; // Meknès

type Psy = { id: string; name: string; focus: string; price: number; rating: number; reviews: number; dLat: number; dLng: number };
const DEMO: Psy[] = [
  { id: "demo-psy-1", name: "Dr. Dalila Mansouri", focus: "Anxiété & stress", price: 200, rating: 4.9, reviews: 42, dLat: 0.004, dLng: 0.005 },
  { id: "demo-psy-2", name: "Dr. Younes Fassi", focus: "Thérapie de couple", price: 250, rating: 4.8, reviews: 31, dLat: -0.003, dLng: 0.006 },
  { id: "demo-psy-3", name: "Dr. Salma Idrissi", focus: "Dépression & TCC", price: 180, rating: 5.0, reviews: 18, dLat: 0.005, dLng: -0.004 },
  { id: "demo-psy-4", name: "Dr. Karim Berrada", focus: "Burn-out & travail", price: 220, rating: 4.7, reviews: 27, dLat: -0.006, dLng: -0.003 },
];

const initials = (n: string) => n.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
const shortOf = (n: string) => n.replace(/^Dr\.?\s*/i, "").split(" ")[0] ?? n;

export default function PsychologistsMapScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [extra, setExtra] = useState<Psy[]>([]);

  // Best-effort: add real approved psychologists (placed around the center).
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: pros } = await supabase
        .from("professionals")
        .select("id, rating_avg, rating_count, hourly_rate_mad")
        .eq("specialty", "psychologist")
        .eq("verification_status", "approved");
      if (!pros?.length) return;
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", pros.map((p) => p.id));
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name as string]));
      const mapped: Psy[] = pros.map((p, i) => ({
        id: p.id, name: nameById.get(p.id) ?? "Psychologue", focus: t("clinical_psychologist"),
        price: p.hourly_rate_mad ?? 200, rating: p.rating_avg ?? 0, reviews: p.rating_count ?? 0,
        dLat: 0.002 * (i + 1) * (i % 2 ? 1 : -1), dLng: 0.003 * (i + 1) * (i % 2 ? -1 : 1),
      }));
      if (active) setExtra(mapped);
    })();
    return () => { active = false; };
  }, []);

  const all = useMemo(() => [...extra, ...DEMO], [extra]);
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);

  const pins: ProPinData[] = useMemo(
    () =>
      all.map((p) => ({
        id: p.id,
        initials: initials(p.name),
        name: p.name,
        shortName: shortOf(p.name),
        specialty: p.focus,
        rating: p.rating,
        priceMad: p.price,
        distanceKm: Math.round(Math.hypot(p.dLat * 111, p.dLng * 95) * 10) / 10,
        lat: CENTER.lat + p.dLat,
        lng: CENTER.lng + p.dLng,
      })),
    [all]
  );

  const openProfile = (id: string) => {
    const p = byId.get(id);
    if (!p) return;
    router.push(
      `/patient/psychologist-profile?id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name)}&price=${p.price}&focus=${encodeURIComponent(p.focus)}&rating=${p.rating}&reviews=${p.reviews}`
    );
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>{t("psychologists_title")}</Text>
          <Text style={s.subtitle}>{t("psychologists_map_hint")}</Text>
        </View>
      </View>

      <BookingMap
        pros={pins}
        demo={false}
        primaryColor={PSY}
        initialLat={CENTER.lat}
        initialLng={CENTER.lng}
        radiusKm={8}
        showChrome={false}
        emptyText={t("no_psychologists")}
        onReserve={openProfile}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: { backgroundColor: "white", flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  subtitle: { color: Colors.textMuted, fontSize: 12.5, marginTop: 1 },
});
