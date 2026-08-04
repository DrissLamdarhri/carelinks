// import { useEffect, useState } from "react";
// import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
// import { Clock, HandCoins, Loader2, Lock, MapPin, Send, ShieldAlert, Stethoscope, Zap } from "lucide-react-native";
// import { Colors } from "@/lib/colors";
// import { useI18n } from "@/lib/i18n";
// import { useAuth } from "@/lib/auth-context";
// import { db } from "@/lib/db/dal";
// import { useOpenBookingsBySpecialty } from "@/lib/db/realtime";
// import { toastError, toastSuccess } from "@/lib/toast";
// import type { ProSpecialty, VerificationStatus } from "@/lib/db/types";

// const NAVY = "#0D0870";

// const SPEC_LABEL: Record<string, string> = {
//   nurse: "spec_nurse",
//   physiotherapist: "spec_physio",
//   psychologist: "spec_psy",
//   yoga_instructor: "spec_yoga",
// };

// type LiveBookingsFeedProps = { specialty: ProSpecialty };

// export function LiveBookingsFeed({ specialty }: LiveBookingsFeedProps) {
//   const { user } = useAuth();
//   const { t } = useI18n();
//   const { bookings, loading } = useOpenBookingsBySpecialty(specialty);
//   const [bidFor, setBidFor] = useState<string | null>(null);
//   const [amount, setAmount] = useState("");
//   const [submitting, setSubmitting] = useState(false);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);
//   const [proStatus, setProStatus] = useState<VerificationStatus | null>(null);
//   const approved = proStatus === "approved";

//   useEffect(() => {
//     if (!user?.id) return;
//     let active = true;
//     db.pros
//       .get(user.id)
//       .then((p) => { if (active) setProStatus(p?.verification_status ?? "pending"); })
//       .catch(() => { if (active) setProStatus("pending"); });
//     return () => { active = false; };
//   }, [user?.id]);

//   const submitBid = async (bookingId: string) => {
//     if (!user?.id || submitting) return;
//     if (!approved) {
//       setErrorMessage(t("must_verify_to_offer"));
//       return;
//     }
//     const n = Number(amount);
//     if (!Number.isFinite(n) || n < 50) {
//       setErrorMessage(t("min_amount_50"));
//       return;
//     }
//     setErrorMessage(null);
//     setSubmitting(true);
//     try {
//       await db.bids.create({ booking_id: bookingId, professional_id: user.id, price_mad: n });
//       setBidFor(null);
//       setAmount("");
//       toastSuccess(`Offre de ${n} MAD envoyée ✓`);
//     } catch (error) {
//       setErrorMessage(error instanceof Error ? error.message : t("send_failed"));
//       toastError(t("offer_not_sent"));
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const verificationBanner =
//     proStatus && !approved ? (
//       <View style={[styles.verifyBanner, proStatus === "rejected" && styles.verifyBannerRej]}>
//         <ShieldAlert size={18} color={proStatus === "rejected" ? "#E24B4A" : "#B45309"} />
//         <View style={{ flex: 1 }}>
//           <Text style={styles.verifyTitle}>
//             {proStatus === "rejected" ? t("account_rejected") : t("account_pending")}
//           </Text>
//           <Text style={styles.verifySub}>
//             {proStatus === "rejected"
//               ? t("registration_rejected_msg")
//               : t("pending_offer_msg")}
//           </Text>
//         </View>
//       </View>
//     ) : null;

//   if (loading) {
//     return (
//       <View style={styles.center}>
//         <ActivityIndicator size="small" color={Colors.primary} />
//       </View>
//     );
//   }

//   if (bookings.length === 0) {
//     return (
//       <View style={styles.list}>
//         {verificationBanner}
//         <View style={styles.emptyCard}>
//           <View style={styles.emptyIcon}>
//             <Stethoscope size={22} color={Colors.textSubtle} />
//           </View>
//           <Text style={styles.emptyTitle}>{t("no_requests_now")}</Text>
//           <Text style={styles.emptySub}>{t("stay_online_msg")}</Text>
//         </View>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.list}>
//       {verificationBanner}
//       {bookings.map((booking) => {
//         const urgent = booking.urgency === "urgent";
//         const isBidding = bidFor === booking.booking_id;
//         return (
//           <View key={booking.booking_id} style={styles.card}>
//             {/* Header */}
//             <View style={styles.top}>
//               <View style={styles.iconWrap}>
//                 <Stethoscope size={19} color={Colors.primary} strokeWidth={1.9} />
//               </View>
//               <View style={{ flex: 1, minWidth: 0 }}>
//                 <Text style={styles.title}>{t("care_request")}</Text>
//                 <Text style={styles.subtitle}>{SPEC_LABEL[booking.specialty] ? t(SPEC_LABEL[booking.specialty]) : t("new_patient")}</Text>
//               </View>
//               <View style={styles.priceBadge}>
//                 <Text style={styles.priceVal}>
//                   {booking.budget_min_mad ?? 0}–{booking.budget_max_mad ?? 0}
//                 </Text>
//                 <Text style={styles.priceUnit}>MAD</Text>
//               </View>
//             </View>

//             {urgent ? (
//               <View style={styles.urgent}>
//                 <Zap size={12} color="#E24B4A" fill="#E24B4A" />
//                 <Text style={styles.urgentTxt}>{t("urgent")}</Text>
//               </View>
//             ) : null}

//             {/* Meta */}
//             <View style={styles.meta}>
//               {booking.address ? (
//                 <View style={styles.metaItem}>
//                   <MapPin size={13} color={Colors.textMuted} />
//                   <Text style={styles.metaText} numberOfLines={1}>{formatAddress(booking.address) || t("at_home")}</Text>
//                 </View>
//               ) : null}
//               {booking.scheduled_at ? (
//                 <View style={styles.metaItem}>
//                   <Clock size={13} color={Colors.textMuted} />
//                   <Text style={styles.metaText}>
//                     {new Date(booking.scheduled_at).toLocaleString("fr-MA", {
//                       day: "numeric",
//                       month: "short",
//                       hour: "2-digit",
//                       minute: "2-digit",
//                     })}
//                   </Text>
//                 </View>
//               ) : null}
//               {booking.notes ? (
//                 <Text style={styles.note} numberOfLines={2}>“{booking.notes}”</Text>
//               ) : null}
//             </View>

//             {/* CTA / bid */}
//             {isBidding ? (
//               <View style={styles.bidWrap}>
//                 <View style={styles.inputWrap}>
//                   <TextInput
//                     value={amount}
//                     onChangeText={setAmount}
//                     keyboardType="numeric"
//                     style={styles.input}
//                     placeholder={t("your_offer_ph")}
//                     placeholderTextColor={Colors.textSubtle}
//                     autoFocus
//                   />
//                   <Text style={styles.inputUnit}>MAD</Text>
//                 </View>
//                 <TouchableOpacity style={styles.sendBtn} onPress={() => submitBid(booking.booking_id)} disabled={submitting}>
//                   {submitting ? <Loader2 size={16} color="white" /> : <Send size={15} color="white" strokeWidth={2.2} />}
//                 </TouchableOpacity>
//                 <TouchableOpacity style={styles.cancelBtn} onPress={() => { setBidFor(null); setErrorMessage(null); }}>
//                   <Text style={styles.cancelTxt}>{t("cancel")}</Text>
//                 </TouchableOpacity>
//               </View>
//             ) : !approved ? (
//               <View style={styles.lockedBtn}>
//                 <Lock size={15} color={Colors.textMuted} />
//                 <Text style={styles.lockedTxt}>{t("verification_required")}</Text>
//               </View>
//             ) : (
//               <TouchableOpacity
//                 style={styles.offerBtn}
//                 activeOpacity={0.9}
//                 onPress={() => { setBidFor(booking.booking_id); setAmount(String(booking.budget_max_mad ?? "")); }}
//               >
//                 <HandCoins size={17} color="#FFFFFF" strokeWidth={2} />
//                 <Text style={styles.offerTxt}>{t("make_offer")}</Text>
//               </TouchableOpacity>
//             )}
//           </View>
//         );
//       })}
//       {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   center: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
//   emptyCard: { backgroundColor: "white", borderRadius: 18, paddingVertical: 28, paddingHorizontal: 20, alignItems: "center", gap: 8 },
//   emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center", marginBottom: 4 },
//   emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
//   emptySub: { color: Colors.textMuted, fontSize: 12.5, textAlign: "center", lineHeight: 18 },

//   list: { gap: 12 },
//   card: {
//     backgroundColor: "white",
//     borderRadius: 18,
//     padding: 16,
//     shadowColor: NAVY,
//     shadowOpacity: 0.08,
//     shadowRadius: 14,
//     shadowOffset: { width: 0, height: 6 },
//     elevation: 3,
//   },

//   top: { flexDirection: "row", alignItems: "center", gap: 12 },
//   iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center" },
//   title: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: "800" },
//   subtitle: { color: Colors.textMuted, fontSize: 12.5, marginTop: 1 },
//   priceBadge: { alignItems: "flex-end", backgroundColor: Colors.surfaceWarm, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 6 },
//   priceVal: { color: NAVY, fontSize: 15, fontWeight: "800", lineHeight: 17 },
//   priceUnit: { color: Colors.primary, fontSize: 9.5, fontWeight: "700", opacity: 0.7 },

//   urgent: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#FDECEC", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginTop: 12 },
//   urgentTxt: { color: "#E24B4A", fontSize: 11, fontWeight: "800" },

//   meta: { gap: 7, marginTop: 12, marginBottom: 14 },
//   metaItem: { flexDirection: "row", alignItems: "center", gap: 7 },
//   metaText: { flex: 1, color: Colors.textMuted, fontSize: 12.5 },
//   note: { color: Colors.textMuted, fontSize: 12.5, fontStyle: "italic", lineHeight: 17 },

//   offerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 15, backgroundColor: NAVY },
//   offerTxt: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
//   lockedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 15, backgroundColor: "#F1F1F4" },
//   lockedTxt: { color: Colors.textMuted, fontSize: 13.5, fontWeight: "700" },

//   verifyBanner: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: "#FEF6E7", borderRadius: 14, padding: 13, borderWidth: 1, borderColor: "#F6E2B8" },
//   verifyBannerRej: { backgroundColor: "#FDECEC", borderColor: "#F6C9C9" },
//   verifyTitle: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "800" },
//   verifySub: { color: Colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },

//   bidWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
//   inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", height: 50, borderRadius: 15, backgroundColor: Colors.input, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "#E7E4FA" },
//   input: { flex: 1, color: NAVY, fontSize: 17, fontWeight: "800" },
//   inputUnit: { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
//   sendBtn: { width: 50, height: 50, borderRadius: 15, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
//   cancelBtn: { height: 50, justifyContent: "center", paddingHorizontal: 4 },
//   cancelTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: "600" },

//   errorText: { color: Colors.danger, fontSize: 12.5, marginTop: 2, textAlign: "center" },
// });
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Clock, HandCoins, Loader2, Lock, MapPin, Send, ShieldAlert, Stethoscope, Zap } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { useOpenBookingsBySpecialty } from "@/lib/db/realtime";
import { toastError, toastSuccess } from "@/lib/toast";
import { careLabel } from "@/lib/care-label";
import type { OpenDemand, ProSpecialty, VerificationStatus } from "@/lib/db/types";

const NAVY = "#0D0870";

type LiveBookingsFeedProps = {
  specialty: ProSpecialty;
  /**
   * Optional callback fired for every new open booking that arrives via
   * Supabase realtime. Pass the value returned by useProDemandNotifications()
   * to get automatic push notifications + bell rows for the professional.
   */
  onNewDemand?: (demand: OpenDemand) => void;
};

export function LiveBookingsFeed({ specialty, onNewDemand }: LiveBookingsFeedProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  // Wire onNewDemand into the realtime subscription so professionals are notified
  // the moment a matching demand appears — even before they look at the feed.
  // Newest first, full stop — the hook already returns them that way (DB query
  // orders by created_at desc, realtime inserts prepend). Urgent/emergency get
  // their own push notification + red/amber badge instead of jumping the
  // queue — pinning them to the top meant a stale, never-expired emergency
  // request could sit above brand-new normal ones indefinitely.
  const { bookings, loading } = useOpenBookingsBySpecialty(specialty, { onNewDemand });
  const [bidFor, setBidFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [proStatus, setProStatus] = useState<VerificationStatus | null>(null);
  const approved = proStatus === "approved";

  /** The demand the bid sheet is open for, resolved from the live feed so the
   *  sheet closes by itself if the request is taken or expires underneath it. */
  const biddingOn = bidFor ? bookings.find((b) => b.booking_id === bidFor) ?? null : null;
  useEffect(() => {
    if (bidFor && !biddingOn) {
      setBidFor(null);
      setAmount("");
    }
  }, [bidFor, biddingOn]);

  const closeBid = () => {
    Keyboard.dismiss();
    setBidFor(null);
    setAmount("");
    setErrorMessage(null);
  };

  /** min / midpoint / max of the posted budget, deduped and sane. */
  const suggestions = (() => {
    const lo = Number(biddingOn?.budget_min_mad ?? 0);
    const hi = Number(biddingOn?.budget_max_mad ?? 0);
    if (!lo && !hi) return [];
    const mid = Math.round((lo + hi) / 2 / 10) * 10;
    return [...new Set([lo, mid, hi].filter((v) => v >= 50))];
  })();

  // The sheet is positioned by hand against the measured keyboard rather than
  // trusting KeyboardAvoidingView: inside a Modal on Android the view is not
  // resized by the window manager, so `behavior="padding"` lifts nothing.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboardHeight(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
      setErrorMessage(t("must_verify_to_offer"));
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 50) {
      setErrorMessage(t("min_amount_50"));
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await db.bids.create({ booking_id: bookingId, professional_id: user.id, price_mad: n });
      Keyboard.dismiss();
      setBidFor(null);
      setAmount("");
      toastSuccess(`Offre de ${n} MAD envoyée ✓`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("send_failed"));
      toastError(t("offer_not_sent"));
    } finally {
      setSubmitting(false);
    }
  };

  // Urgent/emergency: no bidding — first approved, online pro to tap this
  // claims the job outright at the posted price (0034_urgent_auto_dispatch.sql
  // does the race-safe compare-and-swap; a losing claim throws and the card
  // disappears anyway once open_demands drops the row for everyone else).
  const claimNow = async (bookingId: string) => {
    if (!user?.id || claimingId) return;
    if (!approved) {
      setErrorMessage(t("must_verify_to_offer"));
      return;
    }
    setErrorMessage(null);
    setClaimingId(bookingId);
    try {
      await db.bookings.claimOpenDemand(bookingId);
      toastSuccess(t("urgent_claimed"));
    } catch (error) {
      toastError(error instanceof Error ? error.message : t("urgent_claim_failed"));
    } finally {
      setClaimingId(null);
    }
  };

  const verificationBanner =
    proStatus && !approved ? (
      <View style={[styles.verifyBanner, proStatus === "rejected" && styles.verifyBannerRej]}>
        <ShieldAlert size={18} color={proStatus === "rejected" ? "#E24B4A" : "#B45309"} />
        <View style={{ flex: 1 }}>
          <Text style={styles.verifyTitle}>
            {proStatus === "rejected" ? t("account_rejected") : t("account_pending")}
          </Text>
          <Text style={styles.verifySub}>
            {proStatus === "rejected"
              ? t("registration_rejected_msg")
              : t("pending_offer_msg")}
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
          <Text style={styles.emptyTitle}>{t("no_requests_now")}</Text>
          <Text style={styles.emptySub}>{t("stay_online_msg")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {verificationBanner}
      {bookings.map((booking) => {
        const urgent = booking.urgency === "urgent";
        const emergency = booking.urgency === "emergency";
        const isPriority = urgent || emergency;
        const isBidding = bidFor === booking.booking_id;
        const isClaiming = claimingId === booking.booking_id;
        return (
          <View key={booking.booking_id} style={styles.card}>
            {/* Header */}
            <View style={styles.top}>
              <View style={styles.iconWrap}>
                <Stethoscope size={19} color={Colors.primary} strokeWidth={1.9} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title}>{t("care_request")}</Text>
                <Text style={styles.subtitle}>{booking.specialty ? careLabel(booking, t) : t("new_patient")}</Text>
              </View>
              <View style={styles.priceBadge}>
                <Text style={styles.priceVal}>
                  {booking.budget_min_mad ?? 0}–{booking.budget_max_mad ?? 0}
                </Text>
                <Text style={styles.priceUnit}>MAD</Text>
              </View>
            </View>

            {isPriority ? (
              <View style={[styles.urgent, emergency && styles.emergency]}>
                <Zap size={12} color={emergency ? "#FFFFFF" : "#E24B4A"} fill={emergency ? "#FFFFFF" : "#E24B4A"} />
                <Text style={[styles.urgentTxt, emergency && styles.emergencyTxt]}>{emergency ? t("urg_emergency") : t("urgent")}</Text>
              </View>
            ) : null}

            {/* Meta */}
            <View style={styles.meta}>
              {/* District + city only. The exact address is deliberately withheld
                  until this pro is assigned to the job — see migration 0028. */}
              <View style={styles.metaItem}>
                <MapPin size={13} color={Colors.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>{booking.area_label || t("at_home")}</Text>
              </View>
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

            </View>

            {/* CTA / bid — urgent & emergency skip bidding entirely: claim now, first come first served */}
            {isPriority && !approved ? (
              <View style={styles.lockedBtn}>
                <Lock size={15} color={Colors.textMuted} />
                <Text style={styles.lockedTxt}>{t("verification_required")}</Text>
              </View>
            ) : isPriority ? (
              <TouchableOpacity
                style={[styles.offerBtn, styles.claimBtn]}
                activeOpacity={0.9}
                disabled={isClaiming}
                onPress={() => claimNow(booking.booking_id)}
              >
                {isClaiming ? <Loader2 size={17} color="#FFFFFF" /> : <Zap size={17} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />}
                <Text style={styles.offerTxt}>{t("urgent_claim_now")}</Text>
              </TouchableOpacity>
            ) : isBidding ? (
              // The amount is typed in the sheet below, not here. Keeping the
              // card's own state visible matters: the pro should be able to see
              // WHICH request they're bidding on behind the sheet.
              <View style={[styles.offerBtn, styles.offerBtnActive]}>
                <HandCoins size={17} color={NAVY} strokeWidth={2} />
                <Text style={[styles.offerTxt, { color: NAVY }]}>{t("your_offer_ph")}</Text>
              </View>
            ) : !approved ? (
              <View style={styles.lockedBtn}>
                <Lock size={15} color={Colors.textMuted} />
                <Text style={styles.lockedTxt}>{t("verification_required")}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.offerBtn}
                activeOpacity={0.9}
                onPress={() => { setBidFor(booking.booking_id); setAmount(String(booking.budget_max_mad ?? "")); }}
              >
                <HandCoins size={17} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.offerTxt}>{t("make_offer")}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
      {errorMessage && !biddingOn ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {/* ── Bid sheet ────────────────────────────────────────────────────────
          The amount used to be an autofocused input inline in the card. That
          card sits inside a vertical list, inside a horizontal pager, under a
          fixed header — so the soft keyboard covered the very field it had just
          focused, and the pro could not see what they were typing. Nothing
          about scroll-into-view is reliable through three nested scrollables.

          A sheet sidesteps the whole problem: it is positioned against the
          bottom of the window and lifted by the measured keyboard height, so it
          is correct by construction no matter what is behind it. */}
      <Modal
        visible={!!biddingOn}
        transparent
        animationType="slide"
        onRequestClose={closeBid}
        statusBarTranslucent
      >
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={closeBid} accessibilityLabel={t("cancel")} />
          <View style={[styles.sheet, { paddingBottom: 22 + keyboardHeight }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t("make_offer")}</Text>
            {biddingOn ? (
              <Text style={styles.sheetSub}>
                {careLabel(biddingOn, t)} · {t("budget")} {biddingOn.budget_min_mad ?? 0}–{biddingOn.budget_max_mad ?? 0} MAD
              </Text>
            ) : null}

            {/* Three taps that cover most real bids, so the keyboard is
                optional rather than mandatory. */}
            {suggestions.length ? (
              <View style={styles.chipRow}>
                {suggestions.map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.chip, Number(amount) === v && styles.chipOn]}
                    onPress={() => setAmount(String(v))}
                  >
                    <Text style={[styles.chipTxt, Number(amount) === v && styles.chipTxtOn]}>{v} MAD</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={styles.inputWrap}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                style={styles.input}
                placeholder={t("your_offer_ph")}
                placeholderTextColor={Colors.textSubtle}
                autoFocus
                returnKeyType="send"
                onSubmitEditing={() => biddingOn && submitBid(biddingOn.booking_id)}
              />
              <Text style={styles.inputUnit}>MAD</Text>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeBid}>
                <Text style={styles.cancelTxt}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, submitting && styles.sendBtnBusy]}
                onPress={() => biddingOn && submitBid(biddingOn.booking_id)}
                disabled={submitting}
              >
                {submitting ? <Loader2 size={16} color="white" /> : <Send size={15} color="white" strokeWidth={2.2} />}
                <Text style={styles.sendTxt}>{t("make_offer")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  emergency: { backgroundColor: "#E24B4A" },
  urgentTxt: { color: "#E24B4A", fontSize: 11, fontWeight: "800" },
  emergencyTxt: { color: "#FFFFFF" },
  claimBtn: { backgroundColor: "#E24B4A" },

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

  inputWrap: { flexDirection: "row", alignItems: "center", height: 54, borderRadius: 15, backgroundColor: Colors.input, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "#E7E4FA" },
  input: { flex: 1, color: NAVY, fontSize: 19, fontWeight: "800" },
  inputUnit: { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  sendBtn: { flex: 1, flexDirection: "row", gap: 8, height: 52, borderRadius: 15, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  sendBtnBusy: { opacity: 0.6 },
  sendTxt: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  cancelBtn: { height: 52, justifyContent: "center", paddingHorizontal: 18 },
  cancelTxt: { color: Colors.textMuted, fontSize: 14, fontWeight: "600" },

  offerBtnActive: { backgroundColor: Colors.surfaceWarm, borderWidth: 1.5, borderColor: NAVY },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(17,24,39,0.45)" },
  sheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 10, gap: 12,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", marginBottom: 4 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  sheetSub: { color: Colors.textMuted, fontSize: 13, marginTop: -6, textTransform: "capitalize" },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceWarm, borderWidth: 1.5, borderColor: "transparent" },
  chipOn: { borderColor: NAVY, backgroundColor: "#FFFFFF" },
  chipTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: "700" },
  chipTxtOn: { color: NAVY },
  sheetActions: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },

  errorText: { color: Colors.danger, fontSize: 12.5, marginTop: 2, textAlign: "center" },
});