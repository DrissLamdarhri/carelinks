/**
 * Full, readable recap of a yoga booking — instructor, center address with a
 * one-tap itinerary, formatted date/time, and booking + payment status.
 * Shared by the post-payment confirmation screen and the booking detail view
 * in "Mes RDV" (app/patient/bookings.tsx).
 */
import { useEffect, useState } from "react";
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarDays, MapPin, Navigation } from "lucide-react-native";
import { Colors, DEFAULT_AVATAR } from "@/lib/colors";
import { useI18n, type Locale } from "@/lib/i18n";
import { geo } from "@/lib/db/geo";
import { CareLinkMapView, type LatLng } from "@/components/map/CareLinkMapView";
import type { YogaBookingDetails as YogaBookingDetailsT } from "@/types/yoga";

const NAVY = Colors.primary;

const DATE_LOCALE: Record<Locale, string> = { fr: "fr-FR", ar: "ar-MA", en: "en-GB", dar: "fr-FR" };

function formatSessionDateTime(startsAtISO: string, durationMin: number, locale: Locale): string {
  const start = new Date(startsAtISO);
  const end = new Date(start.getTime() + durationMin * 60000);
  const dateLabel = start.toLocaleDateString(DATE_LOCALE[locale] ?? "fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const capitalized = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const fmtHour = (d: Date) => `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
  return `${capitalized} · ${fmtHour(start)} - ${fmtHour(end)}`;
}

// `bookings.status` only ever becomes 'matched' via confirm_yoga_payment(),
// after the enrollment + payment were both created in the same transaction
// — nothing else in the system sets it. It's trusted here as the primary
// signal, not `payment.status`: if the payment row lookup ever comes back
// empty or stale for any reason, a booking that's genuinely 'matched' must
// never be shown as "waiting for payment" — that's a worse, more confusing
// failure mode than a badge that's merely slow to reflect a refund.
function bookingStatusBadge(d: YogaBookingDetailsT): { labelKey: string; color: string; bg: string } {
  if (d.booking_status === "cancelled") return { labelKey: "cmp_cancelled_f", color: "#E24B4A", bg: "#FDE8E8" };
  if (d.booking_status === "completed") return { labelKey: "cmp_completed_f", color: "#16A34A", bg: "#DCFCE7" };
  const paid = d.booking_status === "matched" || d.payment?.status === "authorized" || d.payment?.status === "captured";
  if (paid) return { labelKey: "cmp_confirmed_f", color: "#16A34A", bg: "#DCFCE7" };
  return { labelKey: "cmp_awaiting_payment", color: "#D97706", bg: "#FFF7E6" };
}

function paymentStatusBadge(d: YogaBookingDetailsT): { labelKey: string; color: string } | null {
  if (!d.payment || !d.payment.status) {
    // No payment row found, but the booking itself is proof one succeeded —
    // same reasoning as bookingStatusBadge above.
    return d.booking_status === "matched" ? { labelKey: "payout_paid", color: "#16A34A" } : null;
  }
  if (d.payment.status === "refunded") return { labelKey: "cmp_refunded", color: "#2563EB" };
  if (d.payment.status === "authorized" || d.payment.status === "captured") {
    return d.booking_status === "cancelled"
      ? { labelKey: "cmp_not_refunded", color: "#D97706" }
      : { labelKey: "payout_paid", color: "#16A34A" };
  }
  if (d.payment.status === "failed") return { labelKey: "cmp_payment_failed", color: "#E24B4A" };
  return { labelKey: "pending_status", color: "#D97706" };
}

export function YogaBookingDetails({
  details,
  onResumePayment,
}: {
  details: YogaBookingDetailsT;
  /** Shown only for an unpaid, still-open reservation — lets the patient
   *  deliberately finish or walk away, instead of the seat/status ever being
   *  treated as reserved/paid just because a booking row exists. */
  onResumePayment?: () => void;
}) {
  const { t, locale } = useI18n();
  const { session, instructor, payment } = details;
  const statusBadge = bookingStatusBadge(details);
  const payBadge = paymentStatusBadge(details);
  const fullAddress = [session?.address, session?.city].filter(Boolean).join(", ");
  const isUnpaid = details.booking_status === "open" && !payment;

  // A class is a real place, same as a nurse home visit — show it on a map,
  // not just as text, when the admin picked a precise location for it
  // (migration 0049). Falls back to text-only if none was ever set.
  const [coords, setCoords] = useState<LatLng | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!session?.id) { setCoords(null); return; }
    void geo.getYogaSessionCoords(session.id)
      .then((c) => { if (!cancelled) setCoords(c); })
      .catch(() => { if (!cancelled) setCoords(null); });
    return () => { cancelled = true; };
  }, [session?.id]);

  const openItinerary = () => {
    if (coords) {
      void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`);
      return;
    }
    if (!fullAddress) return;
    const encoded = encodeURIComponent(fullAddress);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
  };

  return (
    <View style={s.root}>
      <View style={[s.statusPill, { backgroundColor: statusBadge.bg }]}>
        <Text style={[s.statusPillTxt, { color: statusBadge.color }]}>{t(statusBadge.labelKey)}</Text>
      </View>

      {instructor ? (
        <View style={s.instructorRow}>
          <Image
            source={instructor.avatar_url ? { uri: instructor.avatar_url } : DEFAULT_AVATAR}
            style={s.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.instructorName} numberOfLines={1}>{instructor.full_name}</Text>
            <Text style={s.instructorSub}>{t("cmp_yoga_instructor")}</Text>
          </View>
        </View>
      ) : null}

      <Text style={s.title} numberOfLines={2}>{session?.title ?? t("cmp_yoga_class")}</Text>

      {session ? (
        <View style={s.row}>
          <CalendarDays size={16} color={NAVY} />
          <Text style={s.rowText}>{formatSessionDateTime(session.starts_at, session.duration_min, locale)}</Text>
        </View>
      ) : null}

      {fullAddress ? (
        <View style={s.addressCard}>
          {coords ? (
            <View style={s.mapPreview} pointerEvents="none">
              <CareLinkMapView center={coords} destination={coords} radiusKm={0} />
            </View>
          ) : null}
          <View style={s.row}>
            <MapPin size={16} color={NAVY} />
            <Text style={[s.rowText, { flex: 1 }]}>{fullAddress}</Text>
          </View>
          <TouchableOpacity style={s.itineraryBtn} onPress={openItinerary}>
            <Navigation size={14} color="#FFFFFF" />
            <Text style={s.itineraryTxt}>{t("directions")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={s.divider} />

      <View style={s.paymentRow}>
        <View>
          <Text style={s.paymentLabel}>{t("amount")}</Text>
          <Text style={s.paymentAmount}>
            {details.final_price_mad ?? payment?.amount_mad ?? "—"} {t("mad")}
          </Text>
        </View>
        {payBadge ? (
          <View style={s.payBadge}>
            <Text style={[s.payBadgeTxt, { color: payBadge.color }]}>{t(payBadge.labelKey)}</Text>
          </View>
        ) : null}
      </View>

      {details.booking_status === "cancelled" && details.cancel_reason ? (
        <Text style={s.cancelNote}>{details.cancel_reason}</Text>
      ) : null}

      {isUnpaid && onResumePayment ? (
        <TouchableOpacity style={s.resumeBtn} onPress={onResumePayment}>
          <Text style={s.resumeTxt}>{t("cmp_finish_payment")}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 12, height: 28, borderRadius: 14, justifyContent: "center", marginBottom: 14 },
  statusPillTxt: { fontSize: 12, fontWeight: "700" },
  instructorRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.input },
  instructorName: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary },
  instructorSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  title: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  rowText: { fontSize: 13.5, color: Colors.textPrimary },
  addressCard: { backgroundColor: Colors.input, borderRadius: 14, padding: 12, marginTop: 2, marginBottom: 4 },
  mapPreview: { height: 120, borderRadius: 10, overflow: "hidden", marginBottom: 10 },
  itineraryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 38, borderRadius: 10, backgroundColor: NAVY, marginTop: 8,
  },
  itineraryTxt: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 14 },
  paymentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paymentLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  paymentAmount: { fontSize: 20, fontWeight: "800", color: NAVY },
  payBadge: { paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: Colors.input, justifyContent: "center" },
  payBadgeTxt: { fontSize: 12, fontWeight: "700" },
  cancelNote: { fontSize: 12, color: Colors.textMuted, marginTop: 12, fontStyle: "italic" },
  resumeBtn: { height: 50, borderRadius: 14, backgroundColor: NAVY, alignItems: "center", justifyContent: "center", marginTop: 16 },
  resumeTxt: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "700" },
});
