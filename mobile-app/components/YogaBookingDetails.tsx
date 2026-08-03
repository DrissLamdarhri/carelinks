/**
 * Full, readable recap of a yoga booking — instructor, center address with a
 * one-tap itinerary, formatted date/time, and booking + payment status.
 * Shared by the post-payment confirmation screen and the booking detail view
 * in "Mes RDV" (app/patient/bookings.tsx).
 */
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarDays, MapPin, Navigation } from "lucide-react-native";
import { Colors, DEFAULT_AVATAR } from "@/lib/colors";
import type { YogaBookingDetails as YogaBookingDetailsT } from "@/types/yoga";

const NAVY = Colors.primary;

function formatSessionDateTime(startsAtISO: string, durationMin: number): string {
  const start = new Date(startsAtISO);
  const end = new Date(start.getTime() + durationMin * 60000);
  const dateLabel = start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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
function bookingStatusBadge(d: YogaBookingDetailsT): { label: string; color: string; bg: string } {
  if (d.booking_status === "cancelled") return { label: "Annulée", color: "#E24B4A", bg: "#FDE8E8" };
  if (d.booking_status === "completed") return { label: "Terminée", color: "#16A34A", bg: "#DCFCE7" };
  const paid = d.booking_status === "matched" || d.payment?.status === "authorized" || d.payment?.status === "captured";
  if (paid) return { label: "Confirmée", color: "#16A34A", bg: "#DCFCE7" };
  return { label: "En attente de paiement", color: "#D97706", bg: "#FFF7E6" };
}

function paymentStatusBadge(d: YogaBookingDetailsT): { label: string; color: string } | null {
  if (!d.payment || !d.payment.status) {
    // No payment row found, but the booking itself is proof one succeeded —
    // same reasoning as bookingStatusBadge above.
    return d.booking_status === "matched" ? { label: "Payé", color: "#16A34A" } : null;
  }
  if (d.payment.status === "refunded") return { label: "Remboursé", color: "#2563EB" };
  if (d.payment.status === "authorized" || d.payment.status === "captured") {
    return d.booking_status === "cancelled"
      ? { label: "Non remboursé", color: "#D97706" }
      : { label: "Payé", color: "#16A34A" };
  }
  if (d.payment.status === "failed") return { label: "Échec du paiement", color: "#E24B4A" };
  return { label: "En attente", color: "#D97706" };
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
  const { session, instructor, payment } = details;
  const statusBadge = bookingStatusBadge(details);
  const payBadge = paymentStatusBadge(details);
  const fullAddress = [session?.address, session?.city].filter(Boolean).join(", ");
  const isUnpaid = details.booking_status === "open" && !payment;

  const openItinerary = () => {
    if (!fullAddress) return;
    const encoded = encodeURIComponent(fullAddress);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
  };

  return (
    <View style={s.root}>
      <View style={[s.statusPill, { backgroundColor: statusBadge.bg }]}>
        <Text style={[s.statusPillTxt, { color: statusBadge.color }]}>{statusBadge.label}</Text>
      </View>

      {instructor ? (
        <View style={s.instructorRow}>
          <Image
            source={instructor.avatar_url ? { uri: instructor.avatar_url } : DEFAULT_AVATAR}
            style={s.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.instructorName} numberOfLines={1}>{instructor.full_name}</Text>
            <Text style={s.instructorSub}>Instructeur de yoga</Text>
          </View>
        </View>
      ) : null}

      <Text style={s.title} numberOfLines={2}>{session?.title ?? "Cours de yoga"}</Text>

      {session ? (
        <View style={s.row}>
          <CalendarDays size={16} color={NAVY} />
          <Text style={s.rowText}>{formatSessionDateTime(session.starts_at, session.duration_min)}</Text>
        </View>
      ) : null}

      {fullAddress ? (
        <View style={s.addressCard}>
          <View style={s.row}>
            <MapPin size={16} color={NAVY} />
            <Text style={[s.rowText, { flex: 1 }]}>{fullAddress}</Text>
          </View>
          <TouchableOpacity style={s.itineraryBtn} onPress={openItinerary}>
            <Navigation size={14} color="#FFFFFF" />
            <Text style={s.itineraryTxt}>Itinéraire</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={s.divider} />

      <View style={s.paymentRow}>
        <View>
          <Text style={s.paymentLabel}>Montant</Text>
          <Text style={s.paymentAmount}>
            {details.final_price_mad ?? payment?.amount_mad ?? "—"} MAD
          </Text>
        </View>
        {payBadge ? (
          <View style={s.payBadge}>
            <Text style={[s.payBadgeTxt, { color: payBadge.color }]}>{payBadge.label}</Text>
          </View>
        ) : null}
      </View>

      {details.booking_status === "cancelled" && details.cancel_reason ? (
        <Text style={s.cancelNote}>{details.cancel_reason}</Text>
      ) : null}

      {isUnpaid && onResumePayment ? (
        <TouchableOpacity style={s.resumeBtn} onPress={onResumePayment}>
          <Text style={s.resumeTxt}>Terminer le paiement</Text>
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
