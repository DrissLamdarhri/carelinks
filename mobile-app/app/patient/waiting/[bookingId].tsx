import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banknote, Bell, Clock3, Loader2, MapPin, X } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { getServiceTheme, isKineService } from "@/lib/service-theme";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import type { Booking } from "@/lib/db/types";
import { useBookingBids } from "@/lib/db/realtime";
import {
  buildDemoBids,
  buildDemoBooking,
  getDemoSpecialty,
  isDemoBookingId,
  normalizeRouteParam,
} from "@/lib/demo-booking";
import { LiveBidsFeed } from "../../../components/LiveBidsFeed";

export default function WaitingOffersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeRouteParam(params.bookingId);
  const isDemoBooking = isDemoBookingId(bookingId);

  const { pendingBids: livePendingBids } = useBookingBids(isDemoBooking ? null : bookingId);
  const pendingBids = useMemo(
    () => (isDemoBooking && bookingId ? buildDemoBids(bookingId) : livePendingBids),
    [bookingId, isDemoBooking, livePendingBids]
  );
  const offersCount = pendingBids.length;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const serviceKey = booking?.specialty ?? (isDemoBooking && bookingId ? getDemoSpecialty(bookingId) : null);
  const isKine = isKineService(serviceKey);
  const theme = useMemo(() => getServiceTheme(serviceKey) ?? ({
    primary: Colors.primary,
    surface: Colors.surfaceWarm,
    surfaceStrong: Colors.surfaceWarm,
    inputBorder: Colors.border,
    badgeBg: Colors.surfaceWarm,
  }), [serviceKey]);
  const radarBorder = isKine ? "rgba(6,95,70,0.24)" : "rgba(13,8,112,0.24)";

  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = animate(pulse1, 0);
    const a2 = animate(pulse2, 600);
    const a3 = animate(pulse3, 1200);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [pulse1, pulse2, pulse3]);

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
    let cancelled = false;
    const loadNearby = async () => {
      if (!bookingId) return;
      if (isDemoBooking) return;
      try {
        await geo.findProsNearBooking(bookingId, 15);
      } catch {
        if (!cancelled) {
          // Intentionally silent in the polished patient flow.
        }
      }
    };
    void loadNearby();
    const iv = isDemoBooking
      ? null
      : setInterval(() => {
          void loadNearby();
        }, 8000);
    return () => {
      cancelled = true;
      if (iv) clearInterval(iv);
    };
  }, [bookingId, isDemoBooking]);

  const handleCancel = async () => {
    if (!bookingId) return;
    setCancelError(null);
    setCancelling(true);
    try {
      if (isDemoBooking) {
        router.replace("/patient");
        return;
      }
      await db.bookings.setStatus(bookingId, "cancelled");
      router.replace("/patient");
    } catch (cancelErr) {
      setCancelError(cancelErr instanceof Error ? cancelErr.message : "Impossible d'annuler la demande.");
    } finally {
      setCancelling(false);
    }
  };

  const scheduledLabel = useMemo(() => {
    if (!booking?.scheduled_at) return "Flexible";
    return new Date(booking.scheduled_at).toLocaleString("fr-MA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [booking?.scheduled_at]);

  return (
    <View style={[styles.root, { backgroundColor: isKine ? theme.surface : Colors.surfaceWarm }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/patient")} style={styles.closeBtn}>
          <X size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recherche en cours</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.radarWrap}>
          {[pulse1, pulse2, pulse3].map((pulse, index) => (
            <Animated.View
              key={index}
              style={[
                styles.radarRing,
                {
                  borderColor: radarBorder,
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                  transform: [
                    {
                      scale: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2.2],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
          <View style={[styles.pinCircle, { backgroundColor: theme.primary }]}>
            <MapPin size={32} color="white" />
          </View>
        </View>

        <Text style={styles.searchTitle}>Recherche de professionnels</Text>
        <Text style={styles.searchSubtitle}>
          Nous cherchons les professionnels disponibles dans votre zone
        </Text>

        <View style={styles.realtimeRow}>
          <View style={[styles.realtimeDot, { backgroundColor: theme.primary }]} />
          <Text style={[styles.realtimeText, { color: theme.primary }]}>
            {isDemoBooking ? "Mode démo actif" : "Connexion temps réel active"}
          </Text>
        </View>

        {booking ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryIconWrap, { backgroundColor: theme.surfaceStrong }]}>
                <Clock3 size={15} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.summaryLabel}>Date & heure</Text>
                <Text style={styles.summaryValue}>{scheduledLabel}</Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={[styles.summaryIconWrap, { backgroundColor: theme.surfaceStrong }]}>
                <MapPin size={15} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.summaryLabel}>Adresse</Text>
                <Text style={styles.summaryValue}>{booking.address ?? "Non renseignée"}</Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={[styles.summaryIconWrap, { backgroundColor: theme.surfaceStrong }]}>
                <Banknote size={15} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.summaryLabel}>Votre budget</Text>
                <Text style={[styles.summaryPrice, { color: theme.primary }]}>
                  {booking.budget_max_mad ?? booking.budget_min_mad ?? "—"} MAD
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.summaryCard}>
            <Loader2 size={18} color={theme.primary} />
            <Text style={styles.summaryLabel}>Chargement de votre demande…</Text>
          </View>
        )}

        {offersCount > 0 ? (
          <View style={styles.previewWrap}>
            <View style={styles.previewHeader}>
              <View style={[styles.offersCountBubble, { backgroundColor: theme.primary }]}>
                <Text style={styles.offersCountText}>{offersCount}</Text>
              </View>
              <Bell size={16} color={theme.primary} />
              <Text style={styles.previewTitle}>Offres reçues en direct</Text>
            </View>
            <LiveBidsFeed
              bookingId={bookingId ?? ""}
              mockBids={isDemoBooking ? pendingBids : undefined}
              theme={theme}
              onAccepted={() => {
                if (bookingId) router.push(`/patient/tracking?bookingId=${encodeURIComponent(bookingId)}`);
              }}
            />
            <TouchableOpacity
              style={[styles.offersBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                if (bookingId) router.replace(`/patient/offers/${bookingId}`);
              }}
            >
              <Text style={styles.offersBtnText}>Voir toutes les offres</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.waitingRow}>
            <Loader2 size={14} color={Colors.textMuted} />
            <Text style={styles.waitingText}>En attente de réponses…</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleCancel} disabled={cancelling} style={styles.cancelBtn}>
          {cancelling ? <ActivityIndicator size="small" color={Colors.textMuted} /> : null}
          <Text style={styles.cancelBtnText}>Annuler la demande</Text>
        </TouchableOpacity>
        {bookingError ? <Text style={styles.errorText}>{bookingError}</Text> : null}
        {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: "600" },
  body: { flex: 1 },
  bodyContent: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  radarWrap: { width: 160, height: 160, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  radarRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "rgba(13,8,112,0.24)",
  },
  pinCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchTitle: { color: Colors.textPrimary, fontSize: 21, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  searchSubtitle: { color: Colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: 16 },
  realtimeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  realtimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  realtimeText: { color: Colors.primary, fontSize: 11 },
  nearbyCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    gap: 3,
  },
  nearbyTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  nearbySub: { color: Colors.textMuted, fontSize: 11 },
  summaryCard: {
    width: "100%",
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: { color: Colors.textMuted, fontSize: 12 },
  summaryValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: "500", maxWidth: 220 },
  summaryPrice: { color: Colors.primary, fontSize: 15, fontWeight: "700" },
  previewWrap: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  previewTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  offersBtn: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  offersCountBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  offersCountText: { color: "white", fontSize: 12, fontWeight: "700" },
  offersBtnText: { color: "white", fontSize: 14, fontWeight: "600" },
  waitingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  waitingText: { color: Colors.textMuted, fontSize: 13 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  cancelBtn: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cancelBtnText: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
