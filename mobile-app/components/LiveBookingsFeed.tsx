import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Clock, HandCoins, Loader2, Lock, MapPin, Send, ShieldAlert, Stethoscope, Zap } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { useOpenBookingsBySpecialty } from "@/lib/db/realtime";
import { toastError, toastSuccess } from "@/lib/toast";
import type { ProSpecialty, VerificationStatus } from "@/lib/db/types";

const NAVY = "#0D0870";

const SPEC_LABEL: Record<string, string> = {
  nurse: "Soins infirmiers",
  physiotherapist: "Kinésithérapie",
  psychologist: "Psychologie",
  yoga_instructor: "Yoga",
};

type LiveBookingsFeedProps = { specialty: ProSpecialty };

export function LiveBookingsFeed({ specialty }: LiveBookingsFeedProps) {
  const { user } = useAuth();
  const { bookings, loading } = useOpenBookingsBySpecialty(specialty);
  const [bidFor, setBidFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [proStatus, setProStatus] = useState<VerificationStatus | null>(null);
  const approved = proStatus === "approved";

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    db.pros
      .get(user.id)
      .then((p) => { if (active) setProStatus(p?.verification_status ?? "pending"); })
      .catch(() => { if (active) setProStatus("pending"); });
    return () => { active = false; };
  }, [user?.id]);

  const submitBid = async (bookingId: string) => {
    if (!user?.id || submitting) return;
    if (!approved) {
      setErrorMessage("Votre compte doit être vérifié avant de faire une offre.");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 50) {
      setErrorMessage("Montant minimum 50 MAD.");
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await db.bids.create({ booking_id: bookingId, professional_id: user.id, price_mad: n });
      setBidFor(null);
      setAmount("");
      toastSuccess(`Offre de ${n} MAD envoyée ✓`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Envoi impossible.");
      toastError("Offre non envoyée");
    } finally {
      setSubmitting(false);
    }
  };

  const verificationBanner =
    proStatus && !approved ? (
      <View style={[styles.verifyBanner, proStatus === "rejected" && styles.verifyBannerRej]}>
        <ShieldAlert size={18} color={proStatus === "rejected" ? "#E24B4A" : "#B45309"} />
        <View style={{ flex: 1 }}>
          <Text style={styles.verifyTitle}>
            {proStatus === "rejected" ? "Compte non validé" : "Compte en cours de vérification"}
          </Text>
          <Text style={styles.verifySub}>
            {proStatus === "rejected"
              ? "Votre inscription a été refusée. Contactez le support CareLink."
              : "Vous pourrez faire des offres dès que l'équipe aura validé vos documents."}
          </Text>
        </View>
      </View>
    ) : null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View style={styles.list}>
        {verificationBanner}
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Stethoscope size={22} color={Colors.textSubtle} />
          </View>
          <Text style={styles.emptyTitle}>Aucune demande pour le moment</Text>
          <Text style={styles.emptySub}>Restez en ligne — les nouvelles demandes apparaîtront ici.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {verificationBanner}
      {bookings.map((booking) => {
        const urgent = booking.urgency === "urgent";
        const isBidding = bidFor === booking.id;
        return (
          <View key={booking.id} style={styles.card}>
            {/* Header */}
            <View style={styles.top}>
              <View style={styles.iconWrap}>
                <Stethoscope size={19} color={Colors.primary} strokeWidth={1.9} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title}>Demande de soin</Text>
                <Text style={styles.subtitle}>{SPEC_LABEL[booking.specialty] ?? "Nouveau patient"}</Text>
              </View>
              <View style={styles.priceBadge}>
                <Text style={styles.priceVal}>
                  {booking.budget_min_mad ?? 0}–{booking.budget_max_mad ?? 0}
                </Text>
                <Text style={styles.priceUnit}>MAD</Text>
              </View>
            </View>

            {urgent ? (
              <View style={styles.urgent}>
                <Zap size={12} color="#E24B4A" fill="#E24B4A" />
                <Text style={styles.urgentTxt}>Urgent</Text>
              </View>
            ) : null}

            {/* Meta */}
            <View style={styles.meta}>
              {booking.address ? (
                <View style={styles.metaItem}>
                  <MapPin size={13} color={Colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>{booking.address}</Text>
                </View>
              ) : null}
              {booking.scheduled_at ? (
                <View style={styles.metaItem}>
                  <Clock size={13} color={Colors.textMuted} />
                  <Text style={styles.metaText}>
                    {new Date(booking.scheduled_at).toLocaleString("fr-MA", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              ) : null}
              {booking.notes ? (
                <Text style={styles.note} numberOfLines={2}>“{booking.notes}”</Text>
              ) : null}
            </View>

            {/* CTA / bid */}
            {isBidding ? (
              <View style={styles.bidWrap}>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    style={styles.input}
                    placeholder="Votre offre"
                    placeholderTextColor={Colors.textSubtle}
                    autoFocus
                  />
                  <Text style={styles.inputUnit}>MAD</Text>
                </View>
                <TouchableOpacity style={styles.sendBtn} onPress={() => submitBid(booking.id)} disabled={submitting}>
                  {submitting ? <Loader2 size={16} color="white" /> : <Send size={15} color="white" strokeWidth={2.2} />}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setBidFor(null); setErrorMessage(null); }}>
                  <Text style={styles.cancelTxt}>Annuler</Text>
                </TouchableOpacity>
              </View>
            ) : !approved ? (
              <View style={styles.lockedBtn}>
                <Lock size={15} color={Colors.textMuted} />
                <Text style={styles.lockedTxt}>Vérification requise pour faire une offre</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.offerBtn}
                activeOpacity={0.9}
                onPress={() => { setBidFor(booking.id); setAmount(String(booking.budget_max_mad ?? "")); }}
              >
                <HandCoins size={17} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.offerTxt}>Faire une offre</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  emptyCard: { backgroundColor: "white", borderRadius: 18, paddingVertical: 28, paddingHorizontal: 20, alignItems: "center", gap: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  emptySub: { color: Colors.textMuted, fontSize: 12.5, textAlign: "center", lineHeight: 18 },

  list: { gap: 12 },
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
    shadowColor: NAVY,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center" },
  title: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: "800" },
  subtitle: { color: Colors.textMuted, fontSize: 12.5, marginTop: 1 },
  priceBadge: { alignItems: "flex-end", backgroundColor: Colors.surfaceWarm, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6 },
  priceVal: { color: NAVY, fontSize: 15, fontWeight: "800", lineHeight: 17 },
  priceUnit: { color: Colors.primary, fontSize: 9.5, fontWeight: "700", opacity: 0.7 },

  urgent: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#FDECEC", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginTop: 12 },
  urgentTxt: { color: "#E24B4A", fontSize: 11, fontWeight: "800" },

  meta: { gap: 7, marginTop: 12, marginBottom: 14 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  metaText: { flex: 1, color: Colors.textMuted, fontSize: 12.5 },
  note: { color: Colors.textMuted, fontSize: 12.5, fontStyle: "italic", lineHeight: 17 },

  offerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 15, backgroundColor: NAVY },
  offerTxt: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  lockedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 15, backgroundColor: "#F1F1F4" },
  lockedTxt: { color: Colors.textMuted, fontSize: 13.5, fontWeight: "700" },

  verifyBanner: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: "#FEF6E7", borderRadius: 14, padding: 13, borderWidth: 1, borderColor: "#F6E2B8" },
  verifyBannerRej: { backgroundColor: "#FDECEC", borderColor: "#F6C9C9" },
  verifyTitle: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "800" },
  verifySub: { color: Colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },

  bidWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", height: 50, borderRadius: 15, backgroundColor: Colors.input, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "#E7E4FA" },
  input: { flex: 1, color: NAVY, fontSize: 17, fontWeight: "800" },
  inputUnit: { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  sendBtn: { width: 50, height: 50, borderRadius: 15, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  cancelBtn: { height: 50, justifyContent: "center", paddingHorizontal: 4 },
  cancelTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: "600" },

  errorText: { color: Colors.danger, fontSize: 12.5, marginTop: 2, textAlign: "center" },
});
