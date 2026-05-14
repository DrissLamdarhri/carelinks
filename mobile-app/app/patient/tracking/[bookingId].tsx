import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessageCircle, Phone, X } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { db } from "@/lib/db/dal";
import type { Booking, Profile } from "@/lib/db/types";
import { buildDemoBooking, buildDemoProfile, isDemoBookingId, normalizeRouteParam } from "@/lib/demo-booking";
import { BookingMap } from "@/components/BookingMap";
import { LiveTrackingChannel } from "@/components/LiveTrackingChannel";

type TrackPosition = {
  lat: number;
  lng: number;
  at: string;
};

const DEFAULT_TRACK_POS: TrackPosition = {
  lat: 33.5731,
  lng: -7.5898,
  at: new Date().toISOString(),
};

export default function LiveTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeRouteParam(params.bookingId);
  const isDemoBooking = isDemoBookingId(bookingId);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [proProfile, setProProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState(12);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [position, setPosition] = useState<TrackPosition>(DEFAULT_TRACK_POS);

  useEffect(() => {
    let cancelled = false;
    const loadBooking = async () => {
      if (!bookingId) {
        setLoading(false);
        setErrorMessage("Réservation introuvable.");
        return;
      }

      setErrorMessage(null);
      setLoading(true);
      try {
        if (isDemoBooking) {
          const nextBooking = buildDemoBooking(bookingId);
          if (!cancelled) {
            setBooking(nextBooking);
            setProProfile(buildDemoProfile(nextBooking.professional_id ?? ""));
            setEta(4);
          }
          return;
        }

        const nextBooking = await db.bookings.get(bookingId);
        let nextProfile: Profile | null = null;
        if (nextBooking.professional_id) {
          nextProfile = await db.profiles.get(nextBooking.professional_id).catch(() => null);
        }
        if (!cancelled) {
          setBooking(nextBooking);
          setProProfile(nextProfile);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Suivi indisponible.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadBooking();
    return () => {
      cancelled = true;
    };
  }, [bookingId, isDemoBooking]);

  useEffect(() => {
    if (!isDemoBooking) return;
    const demoPath: TrackPosition[] = [
      { lat: 33.8951, lng: -5.5473, at: new Date().toISOString() },
      { lat: 33.8943, lng: -5.5485, at: new Date().toISOString() },
      { lat: 33.8935, lng: -5.5498, at: new Date().toISOString() },
      { lat: 33.8928, lng: -5.5511, at: new Date().toISOString() },
    ];

    let idx = 0;
    setPosition(demoPath[0]);
    const iv = setInterval(() => {
      idx = Math.min(idx + 1, demoPath.length - 1);
      setPosition({ ...demoPath[idx], at: new Date().toISOString() });
    }, 3000);

    return () => clearInterval(iv);
  }, [isDemoBooking]);

  useEffect(() => {
    const iv = setInterval(() => {
      setEta((prev) => Math.max(0, prev - 1));
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const arrived = eta === 0;
  const proName = proProfile?.full_name || "Professionnel";
  const proPhone = proProfile?.phone || null;

  return (
    <View style={styles.root}>
      {!isDemoBooking && bookingId ? (
        <LiveTrackingChannel
          bookingId={bookingId}
          mode="watch"
          onPosition={(next) => setPosition(next)}
        />
      ) : null}

      <View style={styles.mapSection}>
        <View style={styles.headerOverlay}>
          <TouchableOpacity onPress={() => router.replace("/patient")} style={styles.closeBtn}>
            <X size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.etaPill}>
            <View
              style={[
                styles.dot,
                { backgroundColor: arrived ? Colors.primary : Colors.accent },
              ]}
            />
            <Text style={styles.etaPillText}>{arrived ? "Arrivé !" : `En route — ${eta} min`}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.mapWrap}>
          <BookingMap
            initialLat={position.lat}
            initialLng={position.lng}
            radiusKm={2}
          />
        </View>
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.dragger} />
        <View style={styles.progressHead}>
          <Text style={styles.progressLabel}>
            {arrived ? "Le professionnel est arrivé" : "En route vers vous"}
          </Text>
          <Text style={styles.progressValue}>{arrived ? "Arrivé" : `${eta} min`}</Text>
        </View>
        <Text style={styles.positionLabel}>
          Position en direct: {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
        </Text>

        <View style={styles.providerCard}>
          <View style={styles.providerMeta}>
            <Text style={styles.providerName}>{proName}</Text>
            <Text style={styles.providerSub}>
              {booking?.specialty?.replaceAll("_", " ") || "Soin"} · {booking?.address || "Adresse"}
            </Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.priceValue}>{booking?.final_price_mad ?? booking?.budget_max_mad ?? "—"}</Text>
            <Text style={styles.priceUnit}>MAD</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {proPhone ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                void Linking.openURL(`tel:${proPhone}`);
              }}
            >
              <Phone size={18} color={Colors.primary} />
              <Text style={styles.secondaryBtnText}>Appeler</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              if (bookingId) router.push(`/patient/chat/${bookingId}`);
            }}
          >
            <MessageCircle size={18} color={Colors.primary} />
            <Text style={styles.secondaryBtnText}>Message</Text>
          </TouchableOpacity>
          {arrived ? (
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => {
                if (bookingId) router.replace(`/patient/rating/${bookingId}`);
              }}
            >
              <Text style={styles.completeBtnText}>Terminer</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Mise à jour du trajet…</Text>
          </View>
        ) : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  mapSection: { flex: 1, minHeight: 340, position: "relative" },
  headerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 5,
    paddingHorizontal: 20,
    paddingTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  etaPill: {
    borderRadius: 999,
    backgroundColor: "white",
    paddingHorizontal: 14,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  etaPillText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  mapWrap: {
    flex: 1,
    overflow: "hidden",
    paddingTop: 70,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  bottomSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -18,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  },
  dragger: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    marginBottom: 10,
  },
  progressHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { color: Colors.textMuted, fontSize: 12 },
  progressValue: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  positionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 12,
  },
  providerCard: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  providerMeta: { flex: 1 },
  providerName: { color: Colors.textPrimary, fontSize: 15, fontWeight: "600" },
  providerSub: { color: Colors.textMuted, fontSize: 12 },
  priceBlock: { alignItems: "flex-end" },
  priceValue: { color: Colors.primary, fontSize: 20, fontWeight: "700" },
  priceUnit: { color: Colors.textMuted, fontSize: 11 },
  actionsRow: { flexDirection: "row", gap: 8 },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "500" },
  completeBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  completeBtnText: { color: "white", fontSize: 13, fontWeight: "600" },
  loadingWrap: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  loadingText: { color: Colors.textMuted, fontSize: 12 },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
