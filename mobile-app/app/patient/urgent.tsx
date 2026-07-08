import { useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, ArrowLeft, LocateFixed, MapPin, Phone, Zap } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import { toastError, toastSuccess } from "@/lib/toast";
import type { UrgencyLevel } from "@/lib/db/types";

const RED = "#E24B4A";
const AMBER = "#F59E0B";

export default function UrgentScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [level, setLevel] = useState<Extract<UrgencyLevel, "urgent" | "emergency">>("urgent");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [note, setNote] = useState("");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEmergency = level === "emergency";
  const accent = isEmergency ? RED : AMBER;
  const canSubmit = address.trim().length > 3 || coords !== null;

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const c = await geo.getCurrentPosition();
      setCoords(c);
      if (!address.trim()) setAddress(t("your_location"));
    } catch {
      toastError(t("cannot_cancel_request"));
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (!user?.id) { toastError(t("please_login_book")); return; }
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      let gps = coords;
      if (!gps) { try { gps = await geo.getCurrentPosition(); } catch { /* address only */ } }
      const booking = await db.bookings.create({
        patient_id: user.id,
        specialty: "nurse",
        urgency: level, // dedicated urgent flow (RULE: nurses see the Urgent badge)
        status: "open",
        address: address.trim() || t("your_location"),
        notes: note.trim() || null,
        // urgent premium range
        budget_min_mad: isEmergency ? 150 : 100,
        budget_max_mad: isEmergency ? 300 : 200,
      });
      if (gps) { try { await geo.setBookingLocation(booking.id, gps.lat, gps.lng); } catch { /* ignore */ } }
      toastSuccess(t("urgent_sent"));
      router.replace(`/patient/waiting/${booking.id}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("cannot_create_booking"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.root}>
      {/* Danger header */}
      <LinearGradient colors={isEmergency ? [RED, "#B91C1C"] : [AMBER, "#D97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><ArrowLeft size={20} color="#fff" /></TouchableOpacity>
        <View style={s.heroIcon}><AlertTriangle size={28} color="#fff" /></View>
        <Text style={s.heroTitle}>{t("urgent_title")}</Text>
        <Text style={s.heroSub}>{t("urgent_subtitle")}</Text>
      </LinearGradient>

      <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Level */}
        <Text style={s.label}>{t("urgency_title")}</Text>
        <View style={s.levelRow}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => setLevel("urgent")}
            style={[s.levelCard, { borderColor: level === "urgent" ? AMBER : "#ECECEC", backgroundColor: level === "urgent" ? "#FFFBEB" : "#fff" }]}>
            <Zap size={18} color={level === "urgent" ? AMBER : Colors.textMuted} />
            <Text style={[s.levelTitle, { color: level === "urgent" ? AMBER : Colors.textPrimary }]}>{t("urg_urgent")}</Text>
            <Text style={s.levelDesc}>{t("urg_urgent_desc")}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={() => setLevel("emergency")}
            style={[s.levelCard, { borderColor: isEmergency ? RED : "#ECECEC", backgroundColor: isEmergency ? "#FEF2F2" : "#fff" }]}>
            <AlertTriangle size={18} color={isEmergency ? RED : Colors.textMuted} />
            <Text style={[s.levelTitle, { color: isEmergency ? RED : Colors.textPrimary }]}>{t("urg_emergency")}</Text>
            <Text style={s.levelDesc}>{t("urg_emergency_desc")}</Text>
          </TouchableOpacity>
        </View>

        {/* Banner */}
        <View style={[s.banner, { backgroundColor: isEmergency ? "#FEF2F2" : "#FFFBEB", borderColor: accent + "55" }]}>
          <AlertTriangle size={16} color={accent} />
          <Text style={[s.bannerTxt, { color: accent }]}>{t(isEmergency ? "urg_emergency_banner" : "urg_urgent_banner")}</Text>
        </View>

        {/* SAMU for life-threatening */}
        {isEmergency ? (
          <TouchableOpacity style={s.samu} onPress={() => Linking.openURL("tel:141")}>
            <Phone size={16} color="#fff" />
            <Text style={s.samuTxt}>{t("call_141")}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Location */}
        <Text style={s.label}>{t("address")}</Text>
        <View style={s.inputWrap}>
          <MapPin size={16} color={Colors.textMuted} />
          <TextInput value={address} onChangeText={setAddress} placeholder={t("enter_address_ph")} placeholderTextColor={Colors.textSubtle} style={s.input} />
        </View>
        <TouchableOpacity style={s.locBtn} onPress={locate} disabled={locating}>
          {locating ? <ActivityIndicator size="small" color={Colors.primary} /> : <LocateFixed size={15} color={Colors.primary} />}
          <Text style={s.locTxt}>{t("use_my_location")}</Text>
        </TouchableOpacity>

        {/* Note */}
        <Text style={s.label}>{t("describe_situation")}</Text>
        <TextInput value={note} onChangeText={setNote} placeholder="…" placeholderTextColor={Colors.textSubtle} style={s.textArea} multiline />
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity disabled={!canSubmit || submitting} onPress={submit}
          style={[s.cta, { backgroundColor: accent }, (!canSubmit || submitting) && { opacity: 0.5 }]}>
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <>
              <AlertTriangle size={18} color="#fff" />
              <Text style={s.ctaTxt}>{t("request_now")}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  hero: { paddingTop: 54, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  back: { position: "absolute", top: 50, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 10 },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 13.5, marginTop: 3 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  label: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  levelRow: { flexDirection: "row", gap: 10 },
  levelCard: { flex: 1, borderRadius: 16, borderWidth: 2, padding: 14, alignItems: "center", gap: 6 },
  levelTitle: { fontSize: 14, fontWeight: "800" },
  levelDesc: { color: Colors.textMuted, fontSize: 11, textAlign: "center" },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  bannerTxt: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
  samu: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: RED, height: 48, borderRadius: 14, marginTop: 12 },
  samuTxt: { color: "#fff", fontSize: 14.5, fontWeight: "800" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 50 },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  locBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8 },
  locTxt: { color: Colors.primary, fontSize: 13, fontWeight: "700" },
  textArea: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, minHeight: 80, color: Colors.textPrimary, textAlignVertical: "top" },
  footer: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26 },
  cta: { height: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
