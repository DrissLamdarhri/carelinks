/**
 * CareLink — Live Tracking Screen (v4)
 * ────────────────────────────────────────────────────────────────────────────
 * Replaces the old green demoMap + BookingMap with the new branded MapCanvas.
 *
 * What changed vs old screen:
 *   • demoMap (green View) → MapCanvas (cream SVG map, branded)
 *   • Pro marker → ProPin circle with pulsing rings + float animation
 *   • Patient marker → PatientPin teardrop (navy, pulsing halo)
 *   • Dashed route SVG line connecting pro → patient (real coordinates)
 *   • animT loop drives all pin animations (same as BookingMap)
 *   • Pan offset locked to { x:0, y:0 } in tracking (map stays centered)
 *   • Real mode: pro position from LiveTrackingChannel → projected to screen
 *   • Demo mode: pro animates along demoPath toward patient
 *
 * Everything else (booking load, ETA countdown, bottom sheet,
 * Appeler / Message / Terminer buttons) is unchanged.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessageCircle, Phone, X } from "lucide-react-native";
import Svg, { Line as SvgLine, Path as SvgPath } from "react-native-svg";
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
import {
  MAP_CENTER,
  NAVY,
  centerWithOffset,
  haversineKm,
  project,
  specialtyColor,
  type LatLng,
} from "@/components/map/engine";
import { MapCanvas } from "@/components/map/MapCanvas";
import { PatientPin, ProPin, type ProPinData } from "@/components/map/Pins";

// ── Constants ─────────────────────────────────────────────────────────────────
const ZOOM    = 7500;
const SCREEN_W = Dimensions.get("window").width;
const MAP_H   = 340;

// ── Demo path (pro walks toward patient in Fès) ───────────────────────────────
const PATIENT_COORD: LatLng = { lat: MAP_CENTER.lat, lng: MAP_CENTER.lng };

const DEMO_PATH: LatLng[] = [
  { lat: 34.050, lng: -4.985 },
  { lat: 34.048, lng: -4.988 },
  { lat: 34.046, lng: -4.991 },
  { lat: 34.044, lng: -4.993 },
  { lat: 34.042, lng: -4.996 },
  { lat: 34.040, lng: -4.999 },
  { lat: 34.038, lng: -5.001 },
];

const DEMO_PRO_BASE: Omit<ProPinData, "lat" | "lng"> = {
  id:          "tracking-pro",
  initials:    "FZ",
  name:        "Fatima Zahra",
  shortName:   "Fatima Z.",
  specialty:   "Infirmière",
  distanceKm:  0.8,
  rating:      4.9,
  priceMad:    180,
  isEnRoute:   true,
};

type TrackPosition = { lat: number; lng: number; at: string };

export default function LiveTrackingScreen() {
  const router   = useRouter();
  const params   = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId    = normalizeRouteParam(params.bookingId);
  const isDemoBooking = isDemoBookingId(bookingId);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [booking,    setBooking]    = useState<Booking | null>(null);
  const [proProfile, setProProfile] = useState<Profile | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [eta,        setEta]        = useState(12);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [proCoord,   setProCoord]   = useState<LatLng>(DEMO_PATH[0]);
  const [demoStep,   setDemoStep]   = useState(0);

  // ── Animation ─────────────────────────────────────────────────────────────
  const [animT, setAnimT] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      setAnimT((t) => t + Math.min((now - last) / 1000, 0.05));
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // ── Load booking ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!bookingId) { setLoading(false); setErrorMsg("Réservation introuvable."); return; }
      setErrorMsg(null);
      setLoading(true);
      try {
        if (isDemoBooking) {
          const b = buildDemoBooking(bookingId);
          if (!cancelled) {
            setBooking(b);
            setProProfile(buildDemoProfile(b.professional_id ?? ""));
            setEta(10);
          }
          return;
        }
        const b = await db.bookings.get(bookingId);
        let prof: Profile | null = null;
        if (b.professional_id) prof = await db.profiles.get(b.professional_id).catch(() => null);
        if (!cancelled) { setBooking(b); setProProfile(prof); }
      } catch (e) {
        if (!cancelled) setErrorMsg(e instanceof Error ? e.message : "Suivi indisponible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [bookingId, isDemoBooking]);

  // ── Demo: step pro along path ─────────────────────────────────────────────
  useEffect(() => {
    if (!isDemoBooking) return;
    let idx = 0;
    setProCoord(DEMO_PATH[0]);
    setDemoStep(0);
    const iv = setInterval(() => {
      idx = Math.min(idx + 1, DEMO_PATH.length - 1);
      setProCoord({ ...DEMO_PATH[idx] });
      setDemoStep(idx);
      if (idx === DEMO_PATH.length - 1) clearInterval(iv);
    }, 1100);
    return () => clearInterval(iv);
  }, [isDemoBooking]);

  // ── ETA countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => setEta((p) => Math.max(0, p - 1)), 2000);
    return () => clearInterval(iv);
  }, []);

  // ── Supabase position handler ─────────────────────────────────────────────
  const handlePosition = useCallback((pos: TrackPosition) => {
    setProCoord({ lat: pos.lat, lng: pos.lng });
  }, []);

  // ── Projection (map is fixed — offset always 0,0) ─────────────────────────
  const cx = useMemo(() => centerWithOffset({ x: 0, y: 0 }, ZOOM), []);

  const proj = useCallback(
    (coord: LatLng) => project(coord, cx, ZOOM, SCREEN_W, MAP_H),
    [cx]
  );

  const proScreenPt     = useMemo(() => proj(proCoord),      [proj, proCoord]);
  const patientScreenPt = useMemo(() => proj(PATIENT_COORD), [proj]);

  // Float for pro pin
  const proFloat = Math.sin(animT * 0.8 + 0.5) * 4;

  // Build ProPinData for the tracking pro
  const trackingPro: ProPinData = useMemo(() => ({
    ...DEMO_PRO_BASE,
    initials:  proProfile?.full_name?.split(" ").map((w) => w[0]).join("").slice(0, 2) ?? DEMO_PRO_BASE.initials,
    name:      proProfile?.full_name ?? DEMO_PRO_BASE.name,
    shortName: proProfile?.full_name?.split(" ").slice(0, 2).join(" ") ?? DEMO_PRO_BASE.shortName,
    specialty: booking?.specialty?.replaceAll("_", " ") ?? DEMO_PRO_BASE.specialty,
    distanceKm: haversineKm(proCoord, PATIENT_COORD),
    avatarUrl: proProfile?.avatar_url ?? null,
    lat: proCoord.lat,
    lng: proCoord.lng,
  }), [proProfile, booking, proCoord]);

  const [selPro, setSelPro] = useState<string | null>(null);
  const handleSelect = useCallback((id: string) => setSelPro((s) => s === id ? null : id), []);

  const arrived  = eta === 0;
  const proName  = proProfile?.full_name ?? "Professionnel";
  const proPhone = proProfile?.phone ?? null;

  return (
    <View style={styles.root}>
      {/* Supabase Realtime (non-visual) */}
      {!isDemoBooking && bookingId ? (
        <LiveTrackingChannel
          bookingId={bookingId}
          mode="watch"
          onPosition={handlePosition}
        />
      ) : null}

      {/* ── Map section ──────────────────────────────────────────────── */}
      <View style={[styles.mapSection, { height: MAP_H }]}>

        {/* SVG Map background */}
        <MapCanvas
          offset={{ x: 0, y: 0 }}
          vw={SCREEN_W}
          vh={MAP_H}
          zoom={ZOOM}
          showRadius={false}
        />

        {/* Dashed route line: pro → patient */}
        <Svg
          style={StyleSheet.absoluteFill}
          width={SCREEN_W}
          height={MAP_H}
          pointerEvents="none"
        >
          <SvgPath
            d={`M${proScreenPt.x.toFixed(1)},${(proScreenPt.y + proFloat).toFixed(1)} L${patientScreenPt.x.toFixed(1)},${patientScreenPt.y.toFixed(1)}`}
            fill="none"
            stroke={NAVY}
            strokeWidth={2.5}
            strokeDasharray="9 7"
            strokeLinecap="round"
            opacity={0.38}
          />
        </Svg>

        {/* Patient pin */}
        <View
          pointerEvents="none"
          style={[
            styles.pinAbs,
            {
              left: patientScreenPt.x - 18,
              top:  patientScreenPt.y - 50,
              zIndex: 35,
            },
          ]}
        >
          <PatientPin color={Colors.primary} />
        </View>

        {/* Pro pin */}
        <View
          style={[
            styles.pinAbs,
            {
              left:   proScreenPt.x - 25,
              top:    proScreenPt.y - 25,
              zIndex: selPro ? 50 : 30,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <ProPin
            pro={trackingPro}
            animT={animT}
            isSelected={selPro === trackingPro.id}
            onSelect={handleSelect}
          />
        </View>

        {/* Header overlay: close + ETA pill */}
        <View style={styles.header} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.replace("/patient")}
          >
            <X size={20} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.etaPill}>
            <View
              style={[
                styles.etaDot,
                { backgroundColor: arrived ? Colors.success : Colors.accent },
              ]}
            />
            <Text style={styles.etaText}>
              {arrived ? "Arrivé !" : `En route — ${eta} min`}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Map credit */}
        <Text style={styles.credit} pointerEvents="none">Fès · CareLink</Text>
      </View>

      {/* ── Bottom sheet ──────────────────────────────────────────────── */}
      <View style={styles.sheet}>
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

        {/* Actions */}
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
            <Text style={styles.loadingText}>Mise à jour du trajet…</Text>
          </View>
        )}
        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.surfaceWarm },

  // Map
  mapSection: { position: "relative", overflow: "hidden" },
  pinAbs:     { position: "absolute" },
  credit: {
    position: "absolute", bottom: 6, right: 10,
    fontSize: 9, color: "rgba(13,8,112,0.3)", fontWeight: "500",
  },

  // Header
  header: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 60,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.12,
    shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  etaPill: {
    borderRadius: 999,
    backgroundColor: "white",
    paddingHorizontal: 14, height: 36,
    flexDirection: "row", alignItems: "center", gap: 7,
    shadowColor: "#000", shadowOpacity: 0.1,
    shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  etaDot:  { width: 8, height: 8, borderRadius: 4 },
  etaText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },

  // Sheet
  sheet: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -18,
    paddingHorizontal: 20, paddingTop: 0, paddingBottom: 20,
  },
  dragger: {
    alignSelf: "center", width: 40, height: 4,
    borderRadius: 2, backgroundColor: "#E0E0E0", marginVertical: 10,
  },

  // Progress
  progressHead:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { color: Colors.textMuted, fontSize: 12 },
  progressValue: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  progressBar: {
    height: 4, borderRadius: 999, backgroundColor: "#EFEFEF",
    overflow: "hidden", marginTop: 8, marginBottom: 10,
  },
  progressFill: {
    height: "100%", borderRadius: 999,
    backgroundColor: Colors.primary,
  },

  // Provider
  providerCard: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  providerMeta: { flex: 1 },
  providerName: { color: Colors.textPrimary, fontSize: 15, fontWeight: "600" },
  providerSub:  { color: Colors.textMuted, fontSize: 12 },
  priceBlock:   { alignItems: "flex-end" },
  priceValue:   { color: Colors.primary, fontSize: 20, fontWeight: "700" },
  priceUnit:    { color: Colors.textMuted, fontSize: 11 },

  // Actions
  actionsRow: { flexDirection: "row", gap: 8 },
  secondaryBtn: {
    flex: 1, height: 46, borderRadius: 12,
    borderWidth: 1, borderColor: "#E0E0E0",
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "500" },
  completeBtn: {
    flex: 1, height: 46, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  completeBtnText: { color: "white", fontSize: 13, fontWeight: "600" },

  loadingRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  loadingText: { color: Colors.textMuted, fontSize: 12 },
  errorText:   { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
