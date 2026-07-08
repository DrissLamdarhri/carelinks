import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, ArrowLeft, CalendarClock, CheckCircle2, ChevronRight, Repeat, Stethoscope } from "lucide-react-native";
import { Colors, Shadows } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/lib/toast";
import type { Recurrence } from "@/lib/db/types";

const KINE = "#059669";
const KINE_DARK = "#065F46";
const PRICE = 150; // MAD per rééducation session

function buildDates() {
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return Array.from({ length: 60 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { day: days[d.getDay()], num: String(d.getDate()).padStart(2, "0"), month: months[d.getMonth()], iso: d.toISOString().split("T")[0] };
  });
}
const dates = buildDates();
const FOCUS = ["focus_motor", "focus_resp", "focus_drainage", "focus_massage", "focus_mobil", "focus_postop"];
const FREQ: { key: Exclude<Recurrence, "none">; label: string }[] = [
  { key: "daily", label: "recurrence_daily" },
  { key: "weekly", label: "recurrence_weekly" },
  { key: "biweekly", label: "recurrence_biweekly" },
  { key: "monthly", label: "recurrence_monthly" },
];
const PRESETS = [6, 10, 12];
type Kine = { id: string; name: string; focus: string; real: boolean };
const DEMO_KINE: Kine[] = [
  { id: "demo-kine-1", name: "Dr. Hamza Alami", focus: "Rééducation motrice", real: false },
  { id: "demo-kine-2", name: "Dr. Leila Saïdi", focus: "Kiné respiratoire", real: false },
  { id: "demo-kine-3", name: "Dr. Omar Tazi", focus: "Drainage & sport", real: false },
];
const initialsOf = (n: string) => n.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

export default function KineScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<"single" | "program">("program");
  const [kines, setKines] = useState<Kine[]>(DEMO_KINE);
  const [kineId, setKineId] = useState<string>(DEMO_KINE[0].id);
  const [focus, setFocus] = useState(0);
  const [sessions, setSessions] = useState(10);
  const [freq, setFreq] = useState<Exclude<Recurrence, "none">>("weekly");
  const [startDay, setStartDay] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: pros } = await supabase.from("professionals").select("id").eq("specialty", "physiotherapist").eq("verification_status", "approved");
      if (!pros?.length) return;
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", pros.map((p) => p.id));
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name as string]));
      const real: Kine[] = pros.map((p) => ({ id: p.id, name: nameById.get(p.id) ?? "Kinésithérapeute", focus: t("spec_physio"), real: true }));
      if (active) setKines([...real, ...DEMO_KINE]);
    })();
    return () => { active = false; };
  }, []);

  const chosen = useMemo(() => kines.find((k) => k.id === kineId) ?? kines[0], [kines, kineId]);
  const total = sessions * PRICE;

  const reserve = async () => {
    if (!user?.id || submitting) return;
    setSubmitting(true);
    try {
      const [h, m] = ["10", "00"];
      const firstISO = new Date(`${dates[startDay].iso}T${h}:${m}:00`).toISOString();
      const realId = chosen && chosen.real ? chosen.id : null;
      const rows = await db.bookings.createSeries(
        {
          patient_id: user.id, specialty: "physiotherapist", status: "matched",
          professional_id: realId, address: "Meknès, Maroc",
          notes: `${chosen?.name ?? "Kiné"} · ${t(FOCUS[focus])}`,
          budget_min_mad: PRICE, budget_max_mad: PRICE, final_price_mad: PRICE,
          session_mode: "in_person", plan_type: "subscription", recurrence: freq,
        },
        { count: sessions, recurrence: freq, firstDateISO: firstISO }
      );
      router.replace(`/patient/payment/${encodeURIComponent(rows[0].id)}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("cannot_create_booking"));
    } finally { setSubmitting(false); }
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={[KINE, KINE_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><ArrowLeft size={20} color="#fff" /></TouchableOpacity>
        <View style={s.heroBlob} />
        <View style={s.heroIcon}><Activity size={26} color="#fff" strokeWidth={2.2} /></View>
        <Text style={s.heroTitle}>{t("spec_physio")}</Text>
        <Text style={s.heroSub}>{t("kine_subtitle")}</Text>
      </LinearGradient>

      {/* Segmented */}
      <View style={s.segment}>
        {(["single", "program"] as const).map((mkey) => {
          const on = mode === mkey;
          return (
            <TouchableOpacity key={mkey} style={[s.segBtn, on && s.segBtnOn]} onPress={() => setMode(mkey)}>
              {mkey === "single" ? <CalendarClock size={15} color={on ? "#fff" : KINE} /> : <Repeat size={15} color={on ? "#fff" : KINE} />}
              <Text style={[s.segTxt, { color: on ? "#fff" : KINE_DARK }]}>{t(mkey === "single" ? "plan_single" : "plan_program")}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {mode === "single" ? (
        <View style={s.singleWrap}>
          <View style={s.singleCard}>
            <View style={s.singleIcon}><Stethoscope size={24} color={KINE} /></View>
            <Text style={s.singleTitle}>{t("plan_single")}</Text>
            <Text style={s.singleDesc}>{t("single_desc")}</Text>
            <TouchableOpacity style={s.singleCta} onPress={() => router.push("/patient/request?service=kine")}>
              <Text style={s.singleCtaTxt}>{t("find_kine")}</Text>
              <ChevronRight size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {/* Kiné picker (same practitioner across the program) */}
          <Text style={s.label}>{t("choose_kine")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
            {kines.map((k) => {
              const on = k.id === kineId;
              return (
                <TouchableOpacity key={k.id} onPress={() => setKineId(k.id)} style={[s.kineCard, on && s.kineCardOn]}>
                  <View style={[s.kineAvatar, on && { backgroundColor: KINE }]}><Text style={[s.kineAvatarTxt, on && { color: "#fff" }]}>{initialsOf(k.name)}</Text></View>
                  <Text style={s.kineName} numberOfLines={1}>{k.name}</Text>
                  <Text style={s.kineFocus} numberOfLines={1}>{k.focus}</Text>
                  {on ? <View style={s.kineCheck}><CheckCircle2 size={16} color={KINE} /></View> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Focus */}
          <Text style={s.label}>{t("reeducation_type")}</Text>
          <View style={s.chips}>
            {FOCUS.map((f, i) => {
              const on = i === focus;
              return (
                <TouchableOpacity key={f} onPress={() => setFocus(i)} style={[s.chip, on && { backgroundColor: "#E7F6EF", borderColor: KINE }]}>
                  <Text style={[s.chipTxt, on && { color: KINE_DARK, fontWeight: "800" }]}>{t(f)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sessions */}
          <Text style={s.label}>{t("sessions_count")}</Text>
          <View style={s.presetRow}>
            {PRESETS.map((n) => {
              const on = n === sessions;
              return (
                <TouchableOpacity key={n} onPress={() => setSessions(n)} style={[s.preset, on && { backgroundColor: KINE, borderColor: KINE }]}>
                  <Text style={[s.presetTxt, on && { color: "#fff" }]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={s.stepper}>
              <TouchableOpacity onPress={() => setSessions((v) => Math.max(2, v - 1))} style={s.stepBtn}><Text style={s.stepTxt}>−</Text></TouchableOpacity>
              <Text style={s.stepVal}>{sessions}</Text>
              <TouchableOpacity onPress={() => setSessions((v) => Math.min(30, v + 1))} style={s.stepBtn}><Text style={s.stepTxt}>+</Text></TouchableOpacity>
            </View>
          </View>

          {/* Frequency */}
          <Text style={s.label}>{t("recurrence_label")}</Text>
          <View style={s.chips}>
            {FREQ.map((f) => {
              const on = f.key === freq;
              return (
                <TouchableOpacity key={f.key} onPress={() => setFreq(f.key)} style={[s.chip, on && { backgroundColor: "#E7F6EF", borderColor: KINE }]}>
                  <Text style={[s.chipTxt, on && { color: KINE_DARK, fontWeight: "800" }]}>{t(f.label)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Start date */}
          <Text style={s.label}>{t("start_date")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
            {dates.slice(0, 30).map((d, i) => {
              const on = i === startDay;
              return (
                <TouchableOpacity key={d.iso} onPress={() => setStartDay(i)} style={[s.dayChip, on && { backgroundColor: KINE, borderColor: KINE }]}>
                  <Text style={[s.dayTxt, on && { color: "#fff" }]}>{d.day}</Text>
                  <Text style={[s.dayNum, on && { color: "#fff" }]}>{d.num}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Summary */}
          <View style={s.summary}>
            <Text style={s.summaryTitle}>{t("program_summary")}</Text>
            <View style={s.summaryRow}><Text style={s.summaryK}>{sessions} × {PRICE} MAD</Text><Text style={s.summaryV}>{total} MAD</Text></View>
            <Text style={s.summaryNote}>{t("first_session_charged")}</Text>
          </View>

          <TouchableOpacity style={[s.cta, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={reserve}>
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={s.ctaTxt}>{t("reserve_program")}</Text>
                <Text style={s.ctaSub}>{PRICE} MAD · {t("session_short")} 1/{sessions}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  hero: { paddingTop: 52, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" },
  back: { position: "absolute", top: 50, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  heroBlob: { position: "absolute", top: -40, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)" },
  heroIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 10 },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 13.5, marginTop: 3 },
  segment: { flexDirection: "row", gap: 8, backgroundColor: "#fff", margin: 20, marginBottom: 6, padding: 5, borderRadius: 16, ...Shadows.sm },
  segBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 12 },
  segBtnOn: { backgroundColor: KINE },
  segTxt: { fontSize: 13.5, fontWeight: "800" },
  singleWrap: { padding: 20 },
  singleCard: { backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center", ...Shadows.md },
  singleIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#E7F6EF", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  singleTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  singleDesc: { color: Colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 18 },
  singleCta: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: KINE, height: 50, borderRadius: 15, paddingHorizontal: 24 },
  singleCtaTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  body: { padding: 20, paddingTop: 12 },
  label: { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", marginTop: 18, marginBottom: 10 },
  kineCard: { width: 130, backgroundColor: "#fff", borderRadius: 16, borderWidth: 2, borderColor: "#EEE", padding: 12, ...Shadows.sm },
  kineCardOn: { borderColor: KINE },
  kineAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#E7F6EF", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  kineAvatarTxt: { color: KINE_DARK, fontSize: 15, fontWeight: "800" },
  kineName: { color: Colors.textPrimary, fontSize: 13, fontWeight: "800" },
  kineFocus: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  kineCheck: { position: "absolute", top: 10, right: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1.5, borderColor: "#ECECEC", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  chipTxt: { color: Colors.textPrimary, fontSize: 12.5, fontWeight: "600" },
  presetRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  preset: { width: 52, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: "#ECECEC", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  presetTxt: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 4, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: "#ECECEC", paddingHorizontal: 8, height: 46 },
  stepBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  stepTxt: { fontSize: 20, color: KINE, fontWeight: "800" },
  stepVal: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary, minWidth: 22, textAlign: "center" },
  dayChip: { width: 50, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#EEE", alignItems: "center", paddingVertical: 8 },
  dayTxt: { color: Colors.textMuted, fontSize: 10 },
  dayNum: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },
  summary: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginTop: 20, ...Shadows.sm },
  summaryTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryK: { color: Colors.textMuted, fontSize: 13.5 },
  summaryV: { color: KINE_DARK, fontSize: 20, fontWeight: "800" },
  summaryNote: { color: Colors.textMuted, fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  cta: { height: 56, borderRadius: 18, backgroundColor: KINE, alignItems: "center", justifyContent: "center", marginTop: 18, ...Shadows.md },
  ctaTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  ctaSub: { color: "rgba(255,255,255,0.85)", fontSize: 11.5, marginTop: 2, fontWeight: "700" },
});
