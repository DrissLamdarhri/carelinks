/**
 * CareLink — Live Tracking Screen (upgraded)
 * Uses TrackingMap (custom SVG, 100% free) instead of old BookingMap/demo.
 * Pro position updated via Supabase Realtime broadcast channel.
 */

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
import {
  buildDemoBooking,
  buildDemoProfile,
  isDemoBookingId,
  normalizeRouteParam,
} from "@/lib/demo-booking";
import { LiveTrackingChannel } from "@/components/LiveTrackingChannel";
import { TrackingMap } from "@/components/TrackingMap";
import { LatLng } from "@/lib/map/mapEngine";

// Patient default (Fès centre — will be replaced by real booking address)
const PATIENT_DEFAULT: LatLng = { lat: 34.037, lng: -5.004 };

// Demo: pro starts ~1.5 km away and walks toward patient
const DEMO_PRO_PATH: LatLng[] = [
  { lat: 34.048, lng: -5.012 },
  { lat: 34.046, lng: -5.01  },
  { lat: 34.044, lng: -5.009 },
  { lat: 34.042, lng: -5.008 },
  { lat: 34.04,  lng: -5.006 },
  { lat: 34.039, lng: -5.005 },
];

export default function LiveTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeRouteParam(params.bookingId);
  const isDemoBooking = isDemoBookingId(bookingId);

  const [booking, setBooking]       = useState<Booking | null>(null);
  const [proProfile, setProProfile] = useState<Profile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [eta, setEta]               = useState(12);
  const [errorMessage, setError]    = useState<string | null>(null);

  // GPS coordinates
  const [patientCoord, setPatientCoord] = useState<LatLng>(PATIENT_DEFAULT);
  const [proCoord, setProCoord]         = useState<LatLng | null>(null);
  const [demoStep, setDemoStep]         = useState(0);

  // ── Load booking ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!bookingId) { setLoading(false); setError("Réservation introuvable."); return; }
      setError(null);
      setLoading(true);
      try {
        if (isDemoBooking) {
          const b = buildDemoBooking(bookingId);
          if (!cancelled) {
            setBooking(b);
            setProProfile(buildDemoProfile(b.professional_id ?? ""));
            setEta(10);
            // Use demo patient coordinates
            setPatientCoord(PATIENT_DEFAULT);
            setProCoord(DEMO_PRO_PATH[0]);
          }
          return;
        }
        const b = await db.bookings.get(bookingId);
        let prof: Profile | null = null;
        if (b.professional_id) {
          prof = await db.profiles.get(b.professional_id).catch(() => null);
        }
        if (!cancelled) {
          setBooking(b);
          setProProfile(prof);
          // If booking has a stored location use it; otherwise default
          setPatientCoord(PATIENT_DEFAULT);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Suivi indisponible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [bookingId, isDemoBooking]);

  // ── Demo: animate pro along path ────────────────────────────────────────────
  useEffect(() => {
    if (!isDemoBooking) return;
    let idx = 0;
    setProCoord(DEMO_PRO_PATH[0]);
    setDemoStep(0);
    const iv = setInterval(() => {
      idx = Math.min(idx + 1, DEMO_PRO_PATH.length - 1);
      setProCoord({ ...DEMO_PRO_PATH[idx] });
      setDemoStep(idx);
      if (idx === DEMO_PRO_PATH.length - 1) clearInterval(iv);
    }, 1200);
    return () => clearInterval(iv);
  }, [isDemoBooking]);

  // ── ETA countdown ───────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => setEta((p) => Math.max(0, p - 1)), 2500);
    return () => clearInterval(iv);
  }, []);

  const arrived = eta === 0;
  const proName = proProfile?.full_name ?? "Professionnel";
  const proPhone = proProfile?.phone ?? null;

  return (
    <View style={styles.root}>
      {/* ── Supabase Realtime channel (non-visual) ─────────────────────────── */}
      {!isDemoBooking && bookingId ? (
        <LiveTrackingChannel
          bookingId={bookingId}
          mode="watch"
          onPosition={(next) => setProCoord({ lat: next.lat, lng: next.lng })}
        />
      ) : null}

      {/* ── Map section (full top half) ───────────────────────────────────── */}
      <View style={styles.mapSection}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.replace("/patient")}
        >
          <X size={20} color={Colors.textPrimary} />
        </TouchableOpacity>

        {/* Map — replaces both old demo and BookingMap */}
        <TrackingMap
          patientCoord={patientCoord}
          proCoord={proCoord}
          etaMin={eta}
          arrived={arrived}
          height={340}
        />
      </View>

      {/* ── Bottom sheet ─────────────────────────────────────────────────────── */}
      <View style={styles.bottomSheet}>
        <View style={styles.dragger} />

        {/* Progress */}
        <View style={styles.progressHead}>
          <Text style={styles.progressLabel}>
            {arrived ? "Le professionnel est arrivé" : "En route vers vous"}
          </Text>
          <Text style={styles.progressValue}>{arrived ? "Arrivé" : `${eta} min`}</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(10, 100 - eta * 8)}%` },
            ]}
          />
        </View>

        {/* Provider card */}
        <View style={styles.providerCard}>
          <View style={styles.providerMeta}>
            <Text style={styles.providerName}>{proName}</Text>
            <Text style={styles.providerSub}>
              {booking?.specialty?.replaceAll("_", " ") ?? "Soin"}
              {" · "}
              {booking?.address ?? "Adresse"}
            </Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.priceValue}>
              {booking?.final_price_mad ?? booking?.budget_max_mad ?? "—"}
            </Text>
            <Text style={styles.priceUnit}>MAD</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          {proPhone ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => void Linking.openURL(`tel:${proPhone}`)}
            >
              <Phone size={18} color={Colors.primary} />
              <Text style={styles.secondaryBtnText}>Appeler</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => { if (bookingId) router.push(`/patient/chat/${bookingId}`); }}
          >
            <MessageCircle size={18} color={Colors.primary} />
            <Text style={styles.secondaryBtnText}>Message</Text>
          </TouchableOpacity>
          {arrived && (
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => { if (bookingId) router.replace(`/patient/rating/${bookingId}`); }}
            >
              <Text style={styles.completeBtnText}>Terminer</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Mise à jour…</Text>
          </View>
        )}
        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },

  mapSection: { position: "relative" },
  closeBtn: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 20,
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
    elevation: 4,
  },

  bottomSheet: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  dragger: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    marginBottom: 12,
  },
  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: { color: Colors.textMuted, fontSize: 12 },
  progressValue: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  progressBar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#EFEFEF",
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
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
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  loadingText: { color: Colors.textMuted, fontSize: 12 },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
