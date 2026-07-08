import { useState, useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, CalendarDays, MapPin, Repeat, Star, Video } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { supabase } from "@/lib/supabase";
import type { PlanType, Recurrence, SessionMode } from "@/lib/db/types";

const PRICE = 200; // MAD per session
// Fallback remote links used only if the psychologist hasn't saved their own yet.
const DEFAULT_MEET = "https://meet.google.com/new";
const DEFAULT_ZOOM = "https://zoom.us/join";

function buildDates() {
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return Array.from({ length: 90 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return { day: days[date.getDay()], num: String(date.getDate()).padStart(2, "0"), month: months[date.getMonth()], isoDate: date.toISOString().split("T")[0] };
  });
}
const dates = buildDates();
const slots = ["09:00", "10:30", "14:00", "15:30", "16:00", "17:30"];

const planOptions: { key: PlanType; label: string; icon: typeof CalendarDays }[] = [
  { key: "single", label: "plan_single", icon: CalendarDays },
  { key: "recurring", label: "plan_recurring", icon: Repeat },
  { key: "subscription", label: "plan_subscription", icon: Star },
];
const recurrenceOptions: { key: Exclude<Recurrence, "none">; label: string }[] = [
  { key: "weekly", label: "recurrence_weekly" },
  { key: "biweekly", label: "recurrence_biweekly" },
  { key: "monthly", label: "recurrence_monthly" },
];
const modeOptions: { key: SessionMode; label: string; icon: typeof MapPin }[] = [
  { key: "in_person", label: "mode_in_person", icon: MapPin },
  { key: "remote", label: "mode_remote", icon: Video },
];

export default function PsychologistBookingScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [plan, setPlan] = useState<PlanType>("single");
  const [recurrence, setRecurrence] = useState<Exclude<Recurrence, "none">>("weekly");
  const [sessionCount, setSessionCount] = useState(4);
  const [mode, setMode] = useState<SessionMode>("in_person");
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const isSeries = plan !== "single";
  const count = isSeries ? sessionCount : 1;

  const groupedMonths = useMemo(() => {
    const map = new Map<string, { key: string; label: string; dates: typeof dates }>();
    for (const d of dates) {
      const dt = new Date(d.isoDate);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      if (!map.has(key)) map.set(key, { key, label: dt.toLocaleString("fr-MA", { month: "long", year: "numeric" }), dates: [] as any });
      map.get(key)!.dates.push(d);
    }
    return Array.from(map.values());
  }, []);

  const canConfirm = selectedSlot !== null;

  const handleReserve = async () => {
    if (!user?.id) { Alert.alert(t("error"), t("please_login_book")); return; }
    if (!canConfirm) return;
    setConfirming(true);
    try {
      const time = selectedSlot !== null ? slots[selectedSlot] : "09:00";
      const [hour, minute] = time.split(":");
      const firstISO = new Date(`${dates[selectedDay].isoDate}T${hour}:${minute}:00`).toISOString();

      // Find an approved psychologist (for the real professional_id + saved links).
      const { data: psy } = await supabase
        .from("professionals")
        .select("id, meet_link, zoom_link")
        .eq("specialty", "psychologist")
        .eq("verification_status", "approved")
        .limit(1)
        .maybeSingle();

      const base = {
        patient_id: user.id,
        specialty: "psychologist" as const,
        status: "matched" as const,
        professional_id: psy?.id ?? null,
        address: mode === "in_person" ? "Meknès, Maroc" : null,
        notes: `Psychologue · ${t(plan === "single" ? "plan_single" : plan === "recurring" ? "plan_recurring" : "plan_subscription")}`,
        budget_min_mad: PRICE,
        budget_max_mad: PRICE,
        final_price_mad: PRICE,
        session_mode: mode,
        plan_type: plan,
        meet_link: mode === "remote" ? psy?.meet_link ?? DEFAULT_MEET : null,
        zoom_link: mode === "remote" ? psy?.zoom_link ?? DEFAULT_ZOOM : null,
      };

      let firstId: string;
      if (isSeries) {
        const rows = await db.bookings.createSeries(
          { ...base, recurrence },
          { count, recurrence, firstDateISO: firstISO }
        );
        firstId = rows[0].id;
      } else {
        const b = await db.bookings.create({ ...base, recurrence: "none", scheduled_at: firstISO, session_index: 1, session_total: 1 });
        firstId = b.id;
      }

      // Escrow: pay the (first) session now → held → released when completed.
      router.replace(`/patient/payment/${encodeURIComponent(firstId)}`);
    } catch (err) {
      console.error("psy reserve failed:", err);
      Alert.alert(t("error"), t("cannot_create_booking"));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("book_appointment_short")}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 18 }}>
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatarFallback}><Text style={styles.avatarInitials}>DM</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>Dr. Dalila Mansouri</Text>
              <Text style={styles.profileRole}>{t("clinical_psychologist")}</Text>
              <View style={styles.ratingRow}>
                <Star size={12} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.ratingText}>4.9</Text>
                <Text style={styles.ratingReviews}>(42)</Text>
              </View>
            </View>
            <View style={styles.priceTag}>
              <Text style={styles.priceTagVal}>{PRICE}</Text>
              <Text style={styles.priceTagUnit}>MAD/{t("per_session")}</Text>
            </View>
          </View>
        </View>

        {/* Appointment kind */}
        <Text style={styles.blockLabel}>{t("appointment_type")}</Text>
        <View style={styles.row3}>
          {planOptions.map((p) => {
            const active = p.key === plan;
            return (
              <TouchableOpacity key={p.key} onPress={() => setPlan(p.key)} style={[styles.pickCard, active && styles.pickCardActive]}>
                <p.icon size={18} color={active ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.pickText, active && styles.pickTextActive]}>{t(p.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recurrence + count (series only) */}
        {isSeries ? (
          <>
            <Text style={styles.blockLabel}>{t("recurrence_label")}</Text>
            <View style={styles.row3}>
              {recurrenceOptions.map((r) => {
                const active = r.key === recurrence;
                return (
                  <TouchableOpacity key={r.key} onPress={() => setRecurrence(r.key)} style={[styles.pickCard, active && styles.pickCardActive]}>
                    <Text style={[styles.pickText, active && styles.pickTextActive]}>{t(r.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.blockLabel}>{t("sessions_count")}</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setSessionCount((n) => Math.max(2, n - 1))}>
                <Text style={styles.counterBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterVal}>{sessionCount}</Text>
              <TouchableOpacity style={styles.counterBtn} onPress={() => setSessionCount((n) => Math.min(12, n + 1))}>
                <Text style={styles.counterBtnTxt}>+</Text>
              </TouchableOpacity>
              <Text style={styles.counterHint}>{sessionCount} × {PRICE} = {sessionCount * PRICE} MAD</Text>
            </View>
          </>
        ) : null}

        {/* Mode */}
        <Text style={styles.blockLabel}>{t("session_mode_label")}</Text>
        <View style={styles.row2}>
          {modeOptions.map((m) => {
            const active = m.key === mode;
            return (
              <TouchableOpacity key={m.key} onPress={() => setMode(m.key)} style={[styles.pickCardWide, active && styles.pickCardActive]}>
                <m.icon size={18} color={active ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.pickText, active && styles.pickTextActive]}>{t(m.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {mode === "remote" ? <Text style={styles.modeNote}>{t("remote_session_note")}</Text> : null}

        {/* Date */}
        <View style={styles.dateHeaderRow}>
          <Text style={styles.blockLabel}>{isSeries ? t("first_session_date") : t("choose_date")}</Text>
          <View style={styles.monthNav}>
            <TouchableOpacity style={[styles.monthNavBtn, selectedMonthIndex === 0 && styles.monthNavBtnDisabled]} disabled={selectedMonthIndex === 0}
              onPress={() => { const prev = Math.max(0, selectedMonthIndex - 1); setSelectedMonthIndex(prev); const g = dates.findIndex((d) => d.isoDate === groupedMonths[prev].dates[0].isoDate); if (g >= 0) setSelectedDay(g); }}>
              <Text style={styles.monthNavBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthHeader}>{groupedMonths[selectedMonthIndex]?.label}</Text>
            <TouchableOpacity style={[styles.monthNavBtn, selectedMonthIndex === groupedMonths.length - 1 && styles.monthNavBtnDisabled]} disabled={selectedMonthIndex === groupedMonths.length - 1}
              onPress={() => { const next = Math.min(groupedMonths.length - 1, selectedMonthIndex + 1); setSelectedMonthIndex(next); const g = dates.findIndex((d) => d.isoDate === groupedMonths[next].dates[0].isoDate); if (g >= 0) setSelectedDay(g); }}>
              <Text style={styles.monthNavBtnText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
        {groupedMonths[selectedMonthIndex] ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={styles.rowChips}>
              {groupedMonths[selectedMonthIndex].dates.map((date) => {
                const gi = dates.findIndex((d) => d.isoDate === date.isoDate);
                const active = selectedDay === gi;
                return (
                  <TouchableOpacity key={date.isoDate} style={[styles.dayChip, active && styles.dayChipActive]} onPress={() => setSelectedDay(gi)}>
                    <Text style={[styles.dayText, active && styles.dayTextActive]}>{date.day}</Text>
                    <Text style={[styles.dayNum, active && styles.dayTextActive]}>{date.num}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        ) : null}

        {/* Slots */}
        <Text style={styles.blockLabel}>{t("available_slots")}</Text>
        <View style={styles.slotsGrid}>
          {slots.map((time, i) => {
            const active = selectedSlot === i;
            return (
              <TouchableOpacity key={time} onPress={() => setSelectedSlot(i)} style={[styles.slotBtn, active && styles.slotBtnActive]}>
                <Text style={[styles.slotText, active && styles.slotTextActive]}>{time}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity disabled={!canConfirm || confirming} onPress={handleReserve}
          style={[styles.confirmBtn, (!canConfirm || confirming) && styles.confirmBtnDisabled]}>
          {confirming ? <ActivityIndicator size="small" color="white" /> : (
            <Text style={[styles.confirmBtnText, (!canConfirm || confirming) && styles.confirmBtnTextDisabled]}>
              {t("pay_and_book")} — {PRICE} MAD{isSeries ? ` · ${t("session_short")} 1/${count}` : ""}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: { backgroundColor: "white", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "600" },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  profileCard: { backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 14 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarFallback: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#E7E4FA", alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: Colors.primary, fontSize: 18, fontWeight: "800" },
  profileName: { color: Colors.textPrimary, fontSize: 16, fontWeight: "700" },
  profileRole: { color: Colors.textMuted, fontSize: 12.5 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  ratingText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  ratingReviews: { color: Colors.textMuted, fontSize: 12 },
  priceTag: { alignItems: "flex-end" },
  priceTagVal: { color: Colors.primary, fontSize: 18, fontWeight: "800" },
  priceTagUnit: { color: Colors.textMuted, fontSize: 10 },
  blockLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 8, marginTop: 4 },
  row3: { flexDirection: "row", gap: 8, marginBottom: 14 },
  row2: { flexDirection: "row", gap: 8, marginBottom: 6 },
  pickCard: { flex: 1, minHeight: 66, borderRadius: 12, borderWidth: 2, borderColor: "#F0F0F0", backgroundColor: "white", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 4 },
  pickCardWide: { flex: 1, height: 56, flexDirection: "row", borderRadius: 12, borderWidth: 2, borderColor: "#F0F0F0", backgroundColor: "white", alignItems: "center", justifyContent: "center", gap: 8 },
  pickCardActive: { borderColor: Colors.primary, backgroundColor: Colors.surfaceWarm },
  pickText: { color: Colors.textMuted, fontSize: 11.5, fontWeight: "600", textAlign: "center" },
  pickTextActive: { color: Colors.primary },
  counterRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  counterBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "white", borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center" },
  counterBtnTxt: { fontSize: 22, color: Colors.primary, fontWeight: "700" },
  counterVal: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary, minWidth: 24, textAlign: "center" },
  counterHint: { color: Colors.textMuted, fontSize: 12.5, marginLeft: 6 },
  modeNote: { color: Colors.textMuted, fontSize: 12, marginBottom: 12, lineHeight: 17 },
  dateHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthNavBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  monthNavBtnDisabled: { opacity: 0.4 },
  monthNavBtnText: { fontSize: 18, color: Colors.textPrimary, fontWeight: "700" },
  monthHeader: { fontSize: 15, color: Colors.textPrimary, fontWeight: "700", marginHorizontal: 6 },
  rowChips: { flexDirection: "row", gap: 8 },
  dayChip: { width: 52, borderRadius: 14, backgroundColor: "white", borderWidth: 1, borderColor: "#F0F0F0", alignItems: "center", paddingVertical: 8 },
  dayChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { color: Colors.textMuted, fontSize: 10 },
  dayNum: { color: Colors.textPrimary, fontSize: 18, fontWeight: "700" },
  dayTextActive: { color: "white" },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotBtn: { width: "31.5%", height: 46, borderRadius: 12, backgroundColor: "white", borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center" },
  slotBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotText: { color: Colors.textPrimary, fontSize: 14, fontWeight: "500" },
  slotTextActive: { color: "white" },
  footer: { backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingHorizontal: 20, paddingVertical: 14 },
  confirmBtn: { height: 52, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  confirmBtnDisabled: { backgroundColor: "#E0E0E0" },
  confirmBtnText: { color: "white", fontSize: 15, fontWeight: "700" },
  confirmBtnTextDisabled: { color: Colors.textMuted },
});
