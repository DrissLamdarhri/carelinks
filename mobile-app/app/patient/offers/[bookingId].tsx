import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle,
  Clock3,
  Loader2,
  MapPin,
  Shield,
  SlidersHorizontal,
  Star,
} from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { db } from "@/lib/db/dal";
import type { Booking, Bid, Professional, Profile } from "@/lib/db/types";
import { useBookingBids } from "@/lib/db/realtime";
import {
  buildDemoBids,
  buildDemoBooking,
  buildDemoProfessional,
  buildDemoProfile,
  isDemoBookingId,
  normalizeRouteParam,
} from "@/lib/demo-booking";

type ProOfferMeta = {
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
  rating: number;
  reviewCount: number;
  yearsExperience: number | null;
  specialtyLabel: string;
  isVerified: boolean;
};

const specialtyLabels: Record<string, string> = {
  nurse: "Infirmier",
  psychologist: "Psychologue",
  physiotherapist: "Kinésithérapeute",
  yoga_instructor: "Instructeur Yoga",
};

function getMeta(profile: Profile | null, pro: Professional | null): ProOfferMeta {
  return {
    fullName: profile?.full_name || "Professionnel",
    avatarUrl: profile?.avatar_url || null,
    phone: profile?.phone || null,
    rating: pro?.rating_avg ?? 0,
    reviewCount: pro?.rating_count ?? 0,
    yearsExperience: pro?.years_experience ?? null,
    specialtyLabel: specialtyLabels[pro?.specialty ?? ""] ?? "Spécialiste",
    isVerified: pro?.verification_status === "approved",
  };
}

export default function NurseOffersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeRouteParam(params.bookingId);
  const isDemoBooking = isDemoBookingId(bookingId);

  const { bids: liveBids, loading: liveLoading, error } = useBookingBids(isDemoBooking ? null : bookingId);
  const [demoBids, setDemoBids] = useState<Bid[]>(() =>
    isDemoBooking && bookingId ? buildDemoBids(bookingId) : []
  );
  const bids = isDemoBooking ? demoBids : liveBids;
  const loading = isDemoBooking ? false : liveLoading;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hiddenOfferIds, setHiddenOfferIds] = useState<string[]>([]);
  const [liveMetaByProId, setLiveMetaByProId] = useState<Record<string, ProOfferMeta>>({});

  useEffect(() => {
    let cancelled = false;
    const loadBooking = async () => {
      setBookingError(null);
      if (!bookingId) {
        if (!cancelled) setBookingError("Réservation introuvable.");
        return;
      }

      try {
        if (isDemoBooking) {
          if (!cancelled) setBooking(buildDemoBooking(bookingId));
          return;
        }
        const next = await db.bookings.get(bookingId);
        if (!cancelled) setBooking(next);
      } catch (loadError) {
        if (!cancelled) {
          setBookingError(loadError instanceof Error ? loadError.message : "Impossible de charger la demande.");
        }
      }
    };
    void loadBooking();
    return () => {
      cancelled = true;
    };
  }, [bookingId, isDemoBooking]);

  useEffect(() => {
    if (!isDemoBooking || !bookingId) return;
    setDemoBids(buildDemoBids(bookingId));
  }, [bookingId, isDemoBooking]);

  const visibleOffers = useMemo(
    () =>
      bids
        .filter((offer) => !["rejected", "withdrawn"].includes(offer.status))
        .filter((offer) => !hiddenOfferIds.includes(offer.id))
        .sort((a, b) => a.price_mad - b.price_mad),
    [bids, hiddenOfferIds]
  );

  const demoMetaByProId = useMemo<Record<string, ProOfferMeta>>(() => {
    if (!isDemoBooking) return {};
    return Object.fromEntries(
      [...new Set(visibleOffers.map((offer) => offer.professional_id))].map((proId) => [
        proId,
        getMeta(buildDemoProfile(proId), buildDemoProfessional(proId)),
      ])
    );
  }, [isDemoBooking, visibleOffers]);
  const metaByProId = isDemoBooking ? demoMetaByProId : liveMetaByProId;

  useEffect(() => {
    const loadMeta = async () => {
      const uniqueProIds = [...new Set(visibleOffers.map((offer) => offer.professional_id))];
      if (isDemoBooking) return;
      const missingIds = uniqueProIds.filter((id) => !metaByProId[id]);
      if (missingIds.length === 0) return;

      const fetched = await Promise.all(
        missingIds.map(async (proId) => {
          try {
            const [profile, professional] = await Promise.all([
              db.profiles.get(proId).catch(() => null),
              db.pros.get(proId).catch(() => null),
            ]);
            return [proId, getMeta(profile as Profile | null, professional as Professional | null)] as const;
          } catch {
            return [proId, getMeta(null, null)] as const;
          }
        })
      );

      setLiveMetaByProId((prev) => ({ ...prev, ...Object.fromEntries(fetched) }));
    };
    void loadMeta();
  }, [isDemoBooking, visibleOffers]);

  const handleAccept = async (offer: Bid) => {
    if (!bookingId) return;
    setActionError(null);
    setActionId(offer.id);
    try {
      if (isDemoBooking) {
        setDemoBids((prev) =>
          prev.map((bid) => ({
            ...bid,
            status: bid.id === offer.id ? "accepted" : "rejected",
          }))
        );
        router.push(`/patient/tracking?bookingId=${encodeURIComponent(bookingId)}`);
        return;
      }
      // Atomic accept + match via SECURITY DEFINER RPC (RLS-safe; notifies pro).
      await db.bids.acceptAndMatch(offer.id);
      router.push(`/patient/tracking?bookingId=${encodeURIComponent(bookingId)}`);
    } catch (acceptError) {
      setActionError(acceptError instanceof Error ? acceptError.message : "Erreur lors de l'acceptation.");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (offerId: string) => {
    setActionError(null);
    setActionId(`${offerId}:reject`);
    try {
      if (isDemoBooking) {
        setDemoBids((prev) =>
          prev.map((bid) => (bid.id === offerId ? { ...bid, status: "rejected" } : bid))
        );
        setHiddenOfferIds((prev) => [...prev, offerId]);
        return;
      }
      await db.bids.setStatus(offerId, "rejected");
      setHiddenOfferIds((prev) => [...prev, offerId]);
    } catch (rejectError) {
      setActionError(rejectError instanceof Error ? rejectError.message : "Erreur lors du refus.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Offres reçues</Text>
          <View style={styles.headerIconBtn}>
            <SlidersHorizontal size={18} color={Colors.textPrimary} />
          </View>
        </View>
        {booking ? (
          <View style={styles.requestMetaRow}>
            <Text style={styles.requestBadge}>
              {specialtyLabels[booking.specialty] ?? booking.specialty}
            </Text>
            <Text style={styles.requestMetaText}>
              {booking.scheduled_at
                ? new Date(booking.scheduled_at).toLocaleTimeString("fr-MA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Horaire flexible"}
            </Text>
            <Text style={styles.requestMetaText}>·</Text>
            <Text style={styles.requestMetaText} numberOfLines={1}>
              {booking.address ?? "Adresse non renseignée"}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.countWrap}>
        {loading ? (
          <View style={styles.loadingRow}>
            <Loader2 size={15} color={Colors.textMuted} />
            <Text style={styles.countText}>Chargement des offres…</Text>
          </View>
        ) : (
          <Text style={styles.countText}>
            <Text style={styles.countStrong}>
              {visibleOffers.length} professionnel{visibleOffers.length === 1 ? "" : "s"}
            </Text>{" "}
            {visibleOffers.length === 1 ? "a répondu" : "ont répondu"}
          </Text>
        )}
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {!loading && visibleOffers.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Clock3 size={24} color={Colors.textSubtle} />
            </View>
            <Text style={styles.emptyTitle}>Aucune offre pour le moment</Text>
            <Text style={styles.emptyText}>Les professionnels consultent votre demande…</Text>
          </View>
        ) : null}

        {visibleOffers.map((offer) => {
          const pro = metaByProId[offer.professional_id] ?? getMeta(null, null);
          const isCounterOffer =
            booking?.budget_max_mad != null ? offer.price_mad > booking.budget_max_mad : false;
          const counterDelta =
            booking?.budget_max_mad != null ? offer.price_mad - booking.budget_max_mad : 0;

          return (
            <View key={offer.id} style={styles.card}>
              <View style={[styles.banner, isCounterOffer ? styles.bannerCounter : styles.bannerAccept]}>
                {!isCounterOffer ? (
                  <>
                    <CheckCircle size={12} color={Colors.primary} />
                    <Text style={styles.bannerAcceptText}>Accepte votre prix</Text>
                  </>
                ) : (
                  <Text style={styles.bannerCounterText}>
                    Contre-offre : {counterDelta > 0 ? "+" : ""}
                    {counterDelta} MAD
                  </Text>
                )}
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatarWrap}>
                    <View style={styles.avatarInner}>
                      <Text style={styles.avatarText}>
                        {pro.fullName
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </Text>
                    </View>
                    <View style={styles.verifiedDot}>
                      <Shield size={9} color="white" />
                    </View>
                  </View>

                  <View style={styles.proInfoWrap}>
                    <Text style={styles.proName}>{pro.fullName}</Text>
                    <View style={styles.ratingRow}>
                      <Star size={12} color="#FBBF24" fill="#FBBF24" />
                      <Text style={styles.ratingText}>
                        {pro.rating > 0 ? pro.rating.toFixed(1) : "Nouveau"}
                      </Text>
                      {pro.reviewCount > 0 ? (
                        <Text style={styles.reviewsText}>({pro.reviewCount} avis)</Text>
                      ) : null}
                    </View>
                    <View style={styles.specialtyRow}>
                      <Text style={styles.specialtyText}>{pro.specialtyLabel}</Text>
                      {pro.yearsExperience ? (
                        <Text style={styles.specialtyText}>· {pro.yearsExperience} ans exp.</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.priceWrap}>
                    <Text style={styles.priceValue}>{offer.price_mad}</Text>
                    <Text style={styles.priceUnit}>MAD</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <MapPin size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>Réponse en {offer.eta_min ?? 30} min</Text>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => handleAccept(offer)}
                    disabled={actionId !== null}
                    style={styles.acceptBtn}
                  >
                    {actionId === offer.id ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <CheckCircle size={15} color="white" />
                        <Text style={styles.acceptBtnText}>Accepter</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleReject(offer.id)}
                    disabled={actionId !== null}
                    style={styles.rejectBtn}
                  >
                    {actionId === `${offer.id}:reject` ? (
                      <ActivityIndicator size="small" color={Colors.textMuted} />
                    ) : (
                      <Text style={styles.rejectBtnText}>Refuser</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
        {bookingError ? <Text style={styles.errorText}>{bookingError}</Text> : null}
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => {
            if (bookingId) router.replace(`/patient/waiting/${bookingId}`);
          }}
          style={styles.footerBtn}
        >
          <Text style={styles.footerBtnText}>Modifier mon prix</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: {
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "600" },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  requestMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  requestBadge: {
    backgroundColor: Colors.surfaceWarm,
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "600",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  requestMetaText: { color: Colors.textMuted, fontSize: 12, maxWidth: 140 },
  countWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  countText: { color: Colors.textMuted, fontSize: 14 },
  countStrong: { color: Colors.primary, fontWeight: "700" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 18, gap: 10 },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { color: Colors.textMuted, fontSize: 15, fontWeight: "500" },
  emptyText: { color: Colors.textSubtle, fontSize: 12, marginTop: 3 },
  card: { backgroundColor: "white", borderRadius: 16, overflow: "hidden" },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  bannerAccept: { backgroundColor: Colors.surfaceWarm },
  bannerCounter: { backgroundColor: "#D8F0F4" },
  bannerAcceptText: { color: Colors.primary, fontSize: 10, fontWeight: "600" },
  bannerCounterText: { color: "#0891B2", fontSize: 10, fontWeight: "600" },
  cardBody: { padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  avatarWrap: { position: "relative" },
  avatarInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.primary, fontSize: 16, fontWeight: "700" },
  verifiedDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  proInfoWrap: { flex: 1 },
  proName: { color: Colors.textPrimary, fontSize: 15, fontWeight: "600" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "500" },
  reviewsText: { color: Colors.textMuted, fontSize: 11 },
  specialtyRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  specialtyText: { color: Colors.textMuted, fontSize: 11 },
  contactRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  callBtn: {
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
  },
  callBtnText: { color: "white", fontSize: 11, fontWeight: "500" },
  whatsBtn: {
    height: 26,
    borderRadius: 8,
    backgroundColor: "#25D366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
  },
  whatsBtnText: { color: "white", fontSize: 11, fontWeight: "500" },
  priceWrap: { alignItems: "flex-end" },
  priceValue: { color: Colors.primary, fontSize: 24, fontWeight: "800", lineHeight: 28 },
  priceUnit: { color: Colors.textMuted, fontSize: 11 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  acceptBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  acceptBtnText: { color: "white", fontSize: 13, fontWeight: "600" },
  rejectBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  rejectBtnText: { color: Colors.textMuted, fontSize: 13 },
  footer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  footerBtn: {
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  footerBtnText: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
