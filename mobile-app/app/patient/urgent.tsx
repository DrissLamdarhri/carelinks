import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, ArrowLeft, Clock, Droplets, HeartPulse, LocateFixed, MapPin, MoreHorizontal, PersonStanding, Phone, Thermometer } from "lucide-react-native";
import { Colors, Shadows } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import { toastError, toastSuccess } from "@/lib/toast";
import type { UrgencyLevel } from "@/lib/db/types";
import { useIdentityGate } from "@/lib/hooks/useIdentityVerification";

const RED = "#E24B4A";
const RED_DARK = "#B91C1C";

/**
 * There is exactly one urgency here, and it is the fastest one.
 *
 * The screen used to open on a two-card choice — "Urgent ~30 min" against
 * "Urgence ~10 min" — and default to the slower of the two. Field feedback was
 * blunt about it: in a real emergency nobody reads two cards and weighs an ETA,
 * they hit the button. A chooser at the top of an emergency screen costs time
 * at the exact moment time is the thing the user has least of, and defaulting
 * to the SLOWER tier meant the panicked tap bought the worst option.
 *
 * So the level is now a constant. Every request from this screen is dispatched
 * as an emergency: broadcast to every online nurse, first to claim wins.
 */
const LEVEL: Extract<UrgencyLevel, "emergency"> = "emergency";

const SYMPTOMS = [
  { key: "sym_bleeding", icon: Droplets },
  { key: "sym_pain", icon: Activity },
  { key: "sym_fall", icon: PersonStanding },
  { key: "sym_fever", icon: Thermometer },
  { key: "sym_faint", icon: HeartPulse },
  { key: "sym_other", icon: MoreHorizontal },
];

export default function UrgentScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { ensureVerified } = useIdentityGate();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [note, setNote] = useState("");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      db.pros.countAvailableForSpecialty("nurse").then((n) => { if (active) setOnlineCount(n); }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 30000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  const accent = RED;
  const accentDark = RED_DARK;
  const canSubmit = address.trim().length > 3 || coords !== null;

  // ── Pulsing SOS emblem ──────────────────────────────────────────────────────
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ring = (delay: number) => ({
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
  });

  const toggleSymptom = (k: string) =>
    setSymptoms((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const c = await geo.getCurrentPosition();
      setCoords(c);
      if (!address.trim()) setAddress(t("your_location"));
    } catch { toastError(t("cannot_cancel_request")); } finally { setLocating(false); }
  };

  const submit = async () => {
    if (!user?.id) { toastError(t("please_login_book")); return; }
    if (!canSubmit || submitting) return;
    // Identity gate — a pro is about to enter this person's home (migration 0030).
    if (!(await ensureVerified())) return;
    setSubmitting(true);
    try {
      const availablePros = await db.pros.countAvailableForSpecialty("nurse").catch(() => 1);
      if (availablePros === 0) {
        toastError(t("no_pros_online_block"));
        setSubmitting(false);
        return;
      }
      let gps = coords;
      if (!gps) { try { gps = await geo.getCurrentPosition(); } catch { /* address only */ } }
      const symptomText = symptoms.map((k) => t(k)).join(", ");
      const fullNote = [symptomText, note.trim()].filter(Boolean).join(" — ") || null;
      const booking = await db.bookings.create({
        patient_id: user.id, specialty: "nurse", urgency: LEVEL, status: "open",
        address: address.trim() || t("your_location"), notes: fullNote,
        budget_min_mad: 150, budget_max_mad: 300,
      });
      if (gps) { try { await geo.setBookingLocation(booking.id, gps.lat, gps.lng); } catch { /* ignore */ } }
      toastSuccess(t("urgent_sent"));
      // No bidding for urgent/emergency: the hold is placed now, broadcast to
      // every online nurse is instant, first to claim wins. Payment first,
      // then the waiting screen (which redirects on to tracking once claimed).
      router.replace(`/patient/payment/${booking.id}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("cannot_create_booking"));
    } finally { setSubmitting(false); }
  };

  return (
    <View style={s.root}>
      {/* ── Pulsing danger hero ── */}
      <LinearGradient colors={[RED, RED_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><ArrowLeft size={20} color="#fff" /></TouchableOpacity>
        <View style={s.emblemWrap}>
          <Animated.View style={[s.ring, ring(0)]} />
          <Animated.View style={[s.ring, ring(1)]} />
          <View style={s.emblem}><HeartPulse size={34} color={accent} strokeWidth={2.4} /></View>
        </View>
        <Text style={s.heroTitle}>{t("urgent_title")}</Text>
        <Text style={s.heroSub}>{t("urgent_subtitle")}</Text>
        {onlineCount != null ? (
          <View style={s.livePill}>
            <View style={s.liveDot} />
            <Text style={s.liveTxt}>{onlineCount} {t("pros_available_now")}</Text>
          </View>
        ) : null}
      </LinearGradient>

      <ScrollView style={s.sheet} contentContainerStyle={s.sheetBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        {/* SAMU first. CareLink dispatches a nurse; it is not an ambulance, and
            for a life-threatening call the right action is the one at the top. */}
        <TouchableOpacity style={s.samu} onPress={() => Linking.openURL("tel:141")}>
          <Phone size={16} color="#fff" /><Text style={s.samuTxt}>{t("call_141")}</Text>
        </TouchableOpacity>

        {/* Quick triage — what's happening */}
        <Text style={s.label}>{t("whats_happening")}</Text>
        <View style={s.symGrid}>
          {SYMPTOMS.map((sy) => {
            const on = symptoms.includes(sy.key);
            return (
              <TouchableOpacity key={sy.key} activeOpacity={0.85} onPress={() => toggleSymptom(sy.key)}
                style={[s.symChip, on && { borderColor: accent, backgroundColor: accent + "12" }]}>
                <sy.icon size={15} color={on ? accent : Colors.textMuted} />
                <Text style={[s.symTxt, on && { color: accentDark, fontWeight: "800" }]}>{t(sy.key)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Location */}
        <Text style={s.label}>{t("address")}</Text>
        <View style={s.inputWrap}>
          <MapPin size={16} color={accent} />
          <TextInput value={address} onChangeText={setAddress} placeholder={t("enter_address_ph")} placeholderTextColor={Colors.textSubtle} style={s.input} />
          <TouchableOpacity onPress={locate} disabled={locating} style={s.locChip}>
            {locating ? <ActivityIndicator size="small" color={accent} /> : <LocateFixed size={14} color={accent} />}
          </TouchableOpacity>
        </View>

        {/* Note */}
        <Text style={s.label}>{t("describe_situation")}</Text>
        <TextInput value={note} onChangeText={setNote} placeholder="…" placeholderTextColor={Colors.textSubtle} style={s.textArea} multiline />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={s.footer}>
        <TouchableOpacity disabled={!canSubmit || submitting} onPress={submit} activeOpacity={0.9} style={[s.cta, (!canSubmit || submitting) && { opacity: 0.5 }]}>
          <LinearGradient colors={[RED, RED_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaBg}>
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <>
                <HeartPulse size={19} color="#fff" strokeWidth={2.4} />
                <Text style={s.ctaTxt}>{t("request_now")}</Text>
                <View style={s.ctaEta}><Clock size={12} color="#fff" /><Text style={s.ctaEtaTxt}>{t("eta_emergency")}</Text></View>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  hero: { paddingTop: 52, paddingBottom: 34, alignItems: "center", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: "hidden" },
  back: { position: "absolute", top: 50, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", zIndex: 3 },
  emblemWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center", marginTop: 6, marginBottom: 12 },
  ring: { position: "absolute", width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff" },
  emblem: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...Shadows.md },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.92)", fontSize: 13.5, marginTop: 3 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 14 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" },
  liveTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  sheet: { flex: 1, marginTop: -4 },
  // Generous, even gutters. The previous 20px felt tight against the cards and
  // inputs, which is what the field feedback called out.
  sheetBody: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 34 },
  samu: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: RED, height: 52, borderRadius: 15, ...Shadows.md },
  samuTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  label: { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", marginTop: 20, marginBottom: 10 },
  symGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  symChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: "#ECECEC", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  symTxt: { color: Colors.textPrimary, fontSize: 12.5, fontWeight: "600" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingLeft: 12, paddingRight: 6, height: 52 },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  locChip: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center" },
  textArea: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, minHeight: 78, color: Colors.textPrimary, textAlignVertical: "top" },
  footer: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26 },
  cta: { height: 56, borderRadius: 18, overflow: "hidden", ...Shadows.md },
  ctaBg: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaTxt: { color: "#fff", fontSize: 16.5, fontWeight: "800" },
  ctaEta: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  ctaEtaTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
