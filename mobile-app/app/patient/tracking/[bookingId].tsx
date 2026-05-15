import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessageCircle, Phone, X } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
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

const demoProStyles = [
  { left: "67%", top: "21%" },
  { left: "62%", top: "28%" },
  { left: "57%", top: "35%" },
  { left: "51%", top: "42%" },
  { left: "45%", top: "49%" },
] satisfies ViewStyle[];

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
  const [demoStep, setDemoStep] = useState(0);

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
            setEta(10);
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
      { lat: 33.8921, lng: -5.5520, at: new Date().toISOString() },
    ];

    let idx = 0;
    setPosition(demoPath[0]);
    setDemoStep(0);
    const iv = setInterval(() => {
      idx = Math.min(idx + 1, demoPath.length - 1);
      setPosition({ ...demoPath[idx], at: new Date().toISOString() });
      setDemoStep(idx);
    }, 900);

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
          {isDemoBooking ? (
            <View style={styles.demoMap}>
              <View style={styles.demoGrid} />
              <View style={styles.demoRoadVertical} />
              <View style={styles.demoRoadHorizontal} />
              <View style={styles.demoRoadShort} />
              <Svg width="100%" height="100%" viewBox="0 0 375 600" style={StyleSheet.absoluteFillObject}>
                <Path
                  d="M110 430 C150 390 165 350 205 325 C235 306 255 285 280 245"
                  stroke={Colors.primary}
                  strokeWidth={4}
                  strokeDasharray="8 7"
                  fill="none"
                  opacity={0.62}
                />
              </Svg>
              <View style={styles.demoPatientBlock}>
                <Text style={styles.demoPatientLabel}>Vous</Text>
                <View style={styles.demoPatientDot} />
              </View>
              <View style={[styles.demoProMarker, demoProStyles[demoStep]]}>
                {proProfile?.avatar_url ? (
                  <Image source={{ uri: proProfile.avatar_url }} style={styles.demoAvatar} resizeMode="cover" />
                ) : (
                  <View style={styles.demoAvatarFallback}>
                    <Text style={styles.demoAvatarFallbackText}>PRO</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <BookingMap initialLat={position.lat} initialLng={position.lng} radiusKm={3} />
          )}
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
        <View style={styles.progressBar}>
          <View style={[styles.progressBarFill, { width: `${Math.max(15, 100 - eta * 8)}%` }]} />
        </View>

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
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  etaPill: {
    borderRadius: 999,
    backgroundColor: "white",
    paddingHorizontal: 14,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  etaPillText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  mapWrap: {
    flex: 1,
    overflow: "hidden",
    paddingTop: 70,
    position: "relative",
  },
  demoMap: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#D6E6D2",
  },
  demoGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  demoRoadVertical: {
    position: "absolute",
    left: "58%",
    top: "10%",
    bottom: "8%",
    width: 22,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.46)",
  },
  demoRoadHorizontal: {
    position: "absolute",
    left: "12%",
    right: "14%",
    top: "48%",
    height: 18,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.46)",
  },
  demoRoadShort: {
    position: "absolute",
    left: "18%",
    top: "26%",
    width: "18%",
    height: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.34)",
  },
  demoProMarker: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "white",
    overflow: "hidden",
    backgroundColor: Colors.primary,
  },
  demoAvatar: {
    width: "100%",
    height: "100%",
  },
  demoAvatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  demoAvatarFallbackText: { color: "white", fontSize: 9, fontWeight: "700" },
  demoPatientBlock: {
    position: "absolute",
    left: "16%",
    top: "70%",
    alignItems: "center",
    gap: 4,
  },
  demoPatientLabel: {
    backgroundColor: Colors.primary,
    color: "white",
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  demoPatientDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: "white",
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
  progressBar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#EFEFEF",
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.primary,
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
