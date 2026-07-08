import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { CalendarClock, CheckCircle2, MapPin, Video } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { showToast } from "@/lib/toast";
import { db } from "@/lib/db/dal";
import type { Booking } from "@/lib/db/types";

const NAVY = "#0D0870";
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-MA", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AppointmentConfirmedScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [series, setSeries] = useState<Booking[]>([]);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!bookingId) { setLoading(false); return; }
    try {
      const b = await db.bookings.get(bookingId);
      setBooking(b);
      const rows = b.series_id ? await db.bookings.getSeries(b.series_id).catch(() => [b]) : [b];
      setSeries(rows);
      // Which sessions already have an escrow hold (paid).
      const pays = await db.payments.listForBookings(rows.map((r) => r.id)).catch(() => []);
      setPaidIds(new Set(pays.filter((p) => p.kind === "service" && p.status !== "refunded" && p.status !== "failed").map((p) => p.booking_id)));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Open the meeting link in an in-app browser tab. This avoids Android routing
  // the URL straight into the Google Meet / Zoom app intent (which can be blocked,
  // e.g. meet.google.com/new needs CALL_PHONE). The browser then offers to open
  // the app or join on the web.
  const open = async (url: string | null) => {
    if (!url) { showToast(t("link_not_set")); return; }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      try { await Linking.openURL(url); } catch { showToast(t("link_open_failed")); }
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={NAVY} /></View>;
  if (!booking) return <View style={s.center}><Text style={s.muted}>{t("cannot_load_booking")}</Text></View>;

  const remote = booking.session_mode === "remote";

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.badge}><CheckCircle2 size={40} color="#16A34A" /></View>
      <Text style={s.title}>{t("appointment_confirmed")}</Text>
      <Text style={s.sub}>{t("payment_confirmed_short")}</Text>

      {/* Summary */}
      <View style={s.card}>
        <View style={s.rowBetween}>
          <Text style={s.cardTitle}>{booking.notes || t("clinical_psychologist")}</Text>
          {booking.session_total && booking.session_total > 1 ? (
            <View style={s.pill}><Text style={s.pillTxt}>{t("session_short")} {booking.session_index}/{booking.session_total}</Text></View>
          ) : null}
        </View>
        <View style={s.line}><CalendarClock size={15} color={Colors.textMuted} /><Text style={s.lineTxt}>{fmt(booking.scheduled_at)}</Text></View>
        <View style={s.line}>
          {remote ? <Video size={15} color={Colors.textMuted} /> : <MapPin size={15} color={Colors.textMuted} />}
          <Text style={s.lineTxt}>{remote ? t("mode_remote") : `${t("mode_in_person")} · ${booking.address ?? "—"}`}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.rowBetween}>
          <Text style={s.muted}>{t("total_to_pay")}</Text>
          <Text style={s.price}>{booking.final_price_mad ?? 0} MAD</Text>
        </View>
      </View>

      {/* Remote → Join buttons; In-person → directions */}
      {remote ? (
        <>
          <Text style={s.blockLabel}>{t("join_session")}</Text>
          <Text style={s.hint}>{t("remote_session_note")}</Text>
          <TouchableOpacity style={[s.joinBtn, s.meet]} onPress={() => open(booking.meet_link)}>
            <Video size={18} color="#fff" /><Text style={s.joinTxt}>{t("join_google_meet")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.joinBtn, s.zoom]} onPress={() => open(booking.zoom_link)}>
            <Video size={18} color="#fff" /><Text style={s.joinTxt}>{t("join_zoom")}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={s.dirBtn} onPress={() => router.push(`/patient/tracking?bookingId=${encodeURIComponent(booking.id)}`)}>
          <MapPin size={16} color={NAVY} /><Text style={s.dirTxt}>{t("view_directions")}</Text>
        </TouchableOpacity>
      )}

      {/* Upcoming sessions (series) */}
      {series.length > 1 ? (
        <>
          <Text style={s.blockLabel}>{t("upcoming_sessions")}</Text>
          <View style={s.card}>
            {series.map((sn) => {
              const paid = paidIds.has(sn.id);
              return (
                <View key={sn.id} style={s.seriesRow}>
                  <Text style={s.seriesIdx}>{sn.session_index}/{sn.session_total}</Text>
                  <Text style={s.seriesDate}>{fmt(sn.scheduled_at)}</Text>
                  {paid ? (
                    <Text style={[s.seriesTag, s.seriesTagPaid]}>{t("session_paid")}</Text>
                  ) : (
                    <TouchableOpacity style={s.payBtn} onPress={() => router.push(`/patient/payment/${encodeURIComponent(sn.id)}`)}>
                      <Text style={s.payBtnTxt}>{t("pay_session")}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={s.hint}>{t("series_payment_note")}</Text>
        </>
      ) : null}

      <TouchableOpacity style={s.homeBtn} onPress={() => router.replace("/patient")}>
        <Text style={s.homeTxt}>{t("back_home")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { padding: 20, paddingTop: 44, alignItems: "stretch" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceWarm },
  badge: { alignSelf: "center", width: 76, height: 76, borderRadius: 38, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { textAlign: "center", fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  sub: { textAlign: "center", color: Colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 14 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary },
  pill: { backgroundColor: Colors.surfaceWarm, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillTxt: { color: Colors.primary, fontSize: 11.5, fontWeight: "800" },
  line: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  lineTxt: { color: Colors.textPrimary, fontSize: 13.5, flex: 1, textTransform: "capitalize" },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 12 },
  muted: { color: Colors.textMuted, fontSize: 13 },
  price: { color: Colors.primary, fontSize: 17, fontWeight: "800" },
  blockLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: 6, marginTop: 4 },
  hint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  joinBtn: { height: 52, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  meet: { backgroundColor: "#00897B" },
  zoom: { backgroundColor: "#2D8CFF" },
  joinTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
  dirBtn: { height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "white", borderWidth: 1, borderColor: NAVY, marginBottom: 14 },
  dirTxt: { color: NAVY, fontSize: 14, fontWeight: "700" },
  seriesRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  seriesIdx: { color: Colors.primary, fontSize: 12.5, fontWeight: "800", width: 34 },
  seriesDate: { color: Colors.textPrimary, fontSize: 12.5, flex: 1, textTransform: "capitalize" },
  seriesTag: { color: Colors.textMuted, fontSize: 11, fontWeight: "700" },
  seriesTagPaid: { color: "#16A34A" },
  payBtn: { backgroundColor: "#0D0870", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  payBtnTxt: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
  homeBtn: { height: 52, borderRadius: 16, backgroundColor: NAVY, alignItems: "center", justifyContent: "center", marginTop: 8 },
  homeTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
