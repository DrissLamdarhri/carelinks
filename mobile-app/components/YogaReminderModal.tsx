/**
 * "Your class starts soon" popup — shown when the 2h-before push notification
 * is tapped (see PushTapHandler in app/_layout.tsx), styled the same way as
 * every other bottom-sheet modal in the app (backdrop + rounded-top card,
 * same shape as the yoga detail modal in app/patient/bookings.tsx and
 * <CancellationDialog/>). Reuses <YogaBookingDetails/> for the recap so the
 * instructor/address/time/itinerary logic lives in exactly one place.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { AlarmClock, X } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { getBookingDetails } from "@/lib/db/yoga";
import { subscribeYogaReminderPopup, hideYogaReminderPopup } from "@/lib/yoga-reminder-popup";
import { YogaBookingDetails } from "@/components/YogaBookingDetails";
import type { YogaBookingDetails as YogaBookingDetailsT } from "@/types/yoga";

export function YogaReminderModalHost() {
  const { t } = useI18n();
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [details, setDetails] = useState<YogaBookingDetailsT | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeYogaReminderPopup((payload) => setBookingId(payload?.bookingId ?? null)), []);

  useEffect(() => {
    if (!bookingId) { setDetails(null); return; }
    let cancelled = false;
    setLoading(true);
    void getBookingDetails(bookingId)
      .then((d) => { if (!cancelled) setDetails(d); })
      .catch(() => { if (!cancelled) setDetails(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId]);

  const close = () => hideYogaReminderPopup();

  return (
    <Modal transparent visible={!!bookingId} animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.headerIconWrap}>
              <AlarmClock size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>{t("cmp_class_starts_soon")}</Text>
              <Text style={s.headerSub}>{t("cmp_class_prepare_hint")}</Text>
            </View>
            <TouchableOpacity onPress={close} style={s.closeBtn} accessibilityLabel={t("close")}>
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {loading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 30 }} />
            ) : details ? (
              <YogaBookingDetails details={details} />
            ) : (
              <Text style={s.errorTxt}>{t("cmp_class_load_failed")}</Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => {
              close();
              router.push("/patient/bookings");
            }}
          >
            <Text style={s.primaryBtnTxt}>{t("see_my_bookings")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  card: { backgroundColor: "#F7F9FC", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", padding: 18 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#EDE5CC",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 15.5, fontWeight: "800", color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EFEFEF", alignItems: "center", justifyContent: "center" },
  errorTxt: { color: Colors.textMuted, textAlign: "center", marginVertical: 30 },
  primaryBtn: { height: 52, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginTop: 14 },
  primaryBtnTxt: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
