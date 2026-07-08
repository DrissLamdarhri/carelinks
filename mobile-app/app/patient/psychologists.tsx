import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, MapPin, Star, Video } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type Psy = { id: string; name: string; focus: string; price: number; rating: number; reviews: number; initials: string; real: boolean };

// Built-in entries so the directory always has choices; real approved
// psychologists (registered via the pro flow) are appended below.
const DEMO: Psy[] = [
  { id: "demo-psy-1", name: "Dr. Dalila Mansouri", focus: "Anxiété & stress", price: 200, rating: 4.9, reviews: 42, initials: "DM", real: false },
  { id: "demo-psy-2", name: "Dr. Younes Fassi", focus: "Thérapie de couple", price: 250, rating: 4.8, reviews: 31, initials: "YF", real: false },
  { id: "demo-psy-3", name: "Dr. Salma Idrissi", focus: "Dépression & TCC", price: 180, rating: 5.0, reviews: 18, initials: "SI", real: false },
];

const initialsOf = (name: string) => name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

export default function PsychologistsDirectoryScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [list, setList] = useState<Psy[]>(DEMO);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: pros } = await supabase
          .from("professionals")
          .select("id, rating_avg, rating_count, hourly_rate_mad")
          .eq("specialty", "psychologist")
          .eq("verification_status", "approved");
        if (!pros?.length) return;
        const ids = pros.map((p) => p.id);
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name as string]));
        const real: Psy[] = pros.map((p) => {
          const name = nameById.get(p.id) ?? "Psychologue";
          return {
            id: p.id, name, focus: t("clinical_psychologist"),
            price: p.hourly_rate_mad ?? 200, rating: p.rating_avg ?? 0,
            reviews: p.rating_count ?? 0, initials: initialsOf(name), real: true,
          };
        });
        if (active) setList([...real, ...DEMO]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const openProfile = (p: Psy) => {
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
          <Text style={s.subtitle}>{t("psychologists_subtitle")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={Colors.primary} style={{ marginBottom: 12 }} /> : null}
        {list.map((p) => (
          <TouchableOpacity key={p.id} style={s.card} activeOpacity={0.85} onPress={() => openProfile(p)}>
            <View style={s.avatar}><Text style={s.avatarTxt}>{p.initials}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{p.name}</Text>
              <Text style={s.focus}>{p.focus}</Text>
              <View style={s.metaRow}>
                <Star size={12} color="#FBBF24" fill="#FBBF24" />
                <Text style={s.rating}>{p.rating.toFixed(1)}</Text>
                {p.reviews ? <Text style={s.reviews}>({p.reviews})</Text> : null}
                <View style={s.badges}>
                  <View style={s.badge}><MapPin size={10} color={Colors.primary} /></View>
                  <View style={s.badge}><Video size={10} color={Colors.primary} /></View>
                </View>
              </View>
            </View>
            <View style={s.priceCol}>
              <Text style={s.price}>{p.price}</Text>
              <Text style={s.priceUnit}>MAD/{t("per_session")}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: { backgroundColor: "white", flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  subtitle: { color: Colors.textMuted, fontSize: 12.5, marginTop: 1 },
  content: { padding: 16, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 16, padding: 14 },
  avatar: { width: 54, height: 54, borderRadius: 16, backgroundColor: "#E7E4FA", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: Colors.primary, fontSize: 17, fontWeight: "800" },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  focus: { color: Colors.textMuted, fontSize: 12.5, marginTop: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  rating: { color: Colors.textPrimary, fontSize: 12.5, fontWeight: "700" },
  reviews: { color: Colors.textMuted, fontSize: 11.5 },
  badges: { flexDirection: "row", gap: 4, marginLeft: 6 },
  badge: { width: 20, height: 20, borderRadius: 6, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center" },
  priceCol: { alignItems: "flex-end" },
  price: { color: Colors.primary, fontSize: 17, fontWeight: "800" },
  priceUnit: { color: Colors.textMuted, fontSize: 9.5 },
});
