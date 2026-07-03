// /**
//  * CareLink — Live Tracking Screen (v4)
//  * ────────────────────────────────────────────────────────────────────────────
//  * Replaces the old green demoMap + BookingMap with the new branded MapCanvas.
//  *
//  * What changed vs old screen:
//  *   • demoMap (green View) → MapCanvas (cream SVG map, branded)
//  *   • Pro marker → ProPin circle with pulsing rings + float animation
//  *   • Patient marker → PatientPin teardrop (navy, pulsing halo)
//  *   • Dashed route SVG line connecting pro → patient (real coordinates)
//  *   • animT loop drives all pin animations (same as BookingMap)
//  *   • Pan offset locked to { x:0, y:0 } in tracking (map stays centered)
//  *   • Real mode: pro position from LiveTrackingChannel → projected to screen
//  *   • Demo mode: pro animates along demoPath toward patient
//  *
//  * Everything else (booking load, ETA countdown, bottom sheet,
//  * Appeler / Message / Terminer buttons) is unchanged.
//  */

// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//   ActivityIndicator,
//   Dimensions,
//   Linking,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import { useLocalSearchParams, useRouter } from "expo-router";
// import { MessageCircle, Phone, X } from "lucide-react-native";
// import Svg, { Line as SvgLine, Path as SvgPath } from "react-native-svg";
// import { Colors } from "@/lib/colors";
// import { db } from "@/lib/db/dal";
// import type { Booking, Profile } from "@/lib/db/types";
// import {
//   buildDemoBooking,
//   buildDemoProfile,
//   isDemoBookingId,
//   normalizeRouteParam,
// } from "@/lib/demo-booking";
// import { LiveTrackingChannel } from "@/components/LiveTrackingChannel";
// import {
//   MAP_CENTER,
//   NAVY,
//   centerWithOffset,
//   haversineKm,
//   project,
//   specialtyColor,
//   type LatLng,
// } from "@/components/map/engine";
// import { MapCanvas } from "@/components/map/MapCanvas";
// import { PatientPin, ProPin, type ProPinData } from "@/components/map/Pins";

// // ── Constants ─────────────────────────────────────────────────────────────────
// const ZOOM    = 7500;
// const SCREEN_W = Dimensions.get("window").width;
// const MAP_H   = 340;

// // ── Demo path (pro walks toward patient in Fès) ───────────────────────────────
// const PATIENT_COORD: LatLng = { lat: MAP_CENTER.lat, lng: MAP_CENTER.lng };

// const DEMO_PATH: LatLng[] = [
//   { lat: 34.050, lng: -4.985 },
//   { lat: 34.048, lng: -4.988 },
//   { lat: 34.046, lng: -4.991 },
//   { lat: 34.044, lng: -4.993 },
//   { lat: 34.042, lng: -4.996 },
//   { lat: 34.040, lng: -4.999 },
//   { lat: 34.038, lng: -5.001 },
// ];

// const DEMO_PRO_BASE: Omit<ProPinData, "lat" | "lng"> = {
//   id:          "tracking-pro",
//   initials:    "FZ",
//   name:        "Fatima Zahra",
//   shortName:   "Fatima Z.",
//   specialty:   "Infirmière",
//   distanceKm:  0.8,
//   rating:      4.9,
//   priceMad:    180,
//   isEnRoute:   true,
// };

// type TrackPosition = { lat: number; lng: number; at: string };

// export default function LiveTrackingScreen() {
//   const router   = useRouter();
//   const params   = useLocalSearchParams<{ bookingId?: string | string[] }>();
//   const bookingId    = normalizeRouteParam(params.bookingId);
//   const isDemoBooking = isDemoBookingId(bookingId);

//   // ── Data ──────────────────────────────────────────────────────────────────
//   const [booking,    setBooking]    = useState<Booking | null>(null);
//   const [proProfile, setProProfile] = useState<Profile | null>(null);
//   const [loading,    setLoading]    = useState(true);
//   const [eta,        setEta]        = useState(12);
//   const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
//   const [proCoord,   setProCoord]   = useState<LatLng>(DEMO_PATH[0]);
//   const [demoStep,   setDemoStep]   = useState(0);

//   // ── Animation ─────────────────────────────────────────────────────────────
//   const [animT, setAnimT] = useState(0);
//   const rafRef = useRef<number | null>(null);

//   useEffect(() => {
//     let last = performance.now();
//     const tick = (now: number) => {
//       setAnimT((t) => t + Math.min((now - last) / 1000, 0.05));
//       last = now;
//       rafRef.current = requestAnimationFrame(tick);
//     };
//     rafRef.current = requestAnimationFrame(tick);
//     return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
//   }, []);

//   // ── Load booking ──────────────────────────────────────────────────────────
//   useEffect(() => {
//     let cancelled = false;
//     const load = async () => {
//       if (!bookingId) { setLoading(false); setErrorMsg("Réservation introuvable."); return; }
//       setErrorMsg(null);
//       setLoading(true);
//       try {
//         if (isDemoBooking) {
//           const b = buildDemoBooking(bookingId);
//           if (!cancelled) {
//             setBooking(b);
//             setProProfile(buildDemoProfile(b.professional_id ?? ""));
//             setEta(10);
//           }
//           return;
//         }
//         const b = await db.bookings.get(bookingId);
//         let prof: Profile | null = null;
//         if (b.professional_id) prof = await db.profiles.get(b.professional_id).catch(() => null);
//         if (!cancelled) { setBooking(b); setProProfile(prof); }
//       } catch (e) {
//         if (!cancelled) setErrorMsg(e instanceof Error ? e.message : "Suivi indisponible.");
//       } finally {
//         if (!cancelled) setLoading(false);
//       }
//     };
//     void load();
//     return () => { cancelled = true; };
//   }, [bookingId, isDemoBooking]);

//   // ── Demo: step pro along path ─────────────────────────────────────────────
//   useEffect(() => {
//     if (!isDemoBooking) return;
//     let idx = 0;
//     setProCoord(DEMO_PATH[0]);
//     setDemoStep(0);
//     const iv = setInterval(() => {
//       idx = Math.min(idx + 1, DEMO_PATH.length - 1);
//       setProCoord({ ...DEMO_PATH[idx] });
//       setDemoStep(idx);
//       if (idx === DEMO_PATH.length - 1) clearInterval(iv);
//     }, 1100);
//     return () => clearInterval(iv);
//   }, [isDemoBooking]);

//   // ── ETA countdown ─────────────────────────────────────────────────────────
//   useEffect(() => {
//     const iv = setInterval(() => setEta((p) => Math.max(0, p - 1)), 2000);
//     return () => clearInterval(iv);
//   }, []);

//   // ── Supabase position handler ─────────────────────────────────────────────
//   const handlePosition = useCallback((pos: TrackPosition) => {
//     setProCoord({ lat: pos.lat, lng: pos.lng });
//   }, []);

//   // ── Projection (map is fixed — offset always 0,0) ─────────────────────────
//   const cx = useMemo(() => centerWithOffset({ x: 0, y: 0 }, ZOOM), []);

//   const proj = useCallback(
//     (coord: LatLng) => project(coord, cx, ZOOM, SCREEN_W, MAP_H),
//     [cx]
//   );

//   const proScreenPt     = useMemo(() => proj(proCoord),      [proj, proCoord]);
//   const patientScreenPt = useMemo(() => proj(PATIENT_COORD), [proj]);

//   // Float for pro pin
//   const proFloat = Math.sin(animT * 0.8 + 0.5) * 4;

//   // Build ProPinData for the tracking pro
//   const trackingPro: ProPinData = useMemo(() => ({
//     ...DEMO_PRO_BASE,
//     initials:  proProfile?.full_name?.split(" ").map((w) => w[0]).join("").slice(0, 2) ?? DEMO_PRO_BASE.initials,
//     name:      proProfile?.full_name ?? DEMO_PRO_BASE.name,
//     shortName: proProfile?.full_name?.split(" ").slice(0, 2).join(" ") ?? DEMO_PRO_BASE.shortName,
//     specialty: booking?.specialty?.replaceAll("_", " ") ?? DEMO_PRO_BASE.specialty,
//     distanceKm: haversineKm(proCoord, PATIENT_COORD),
//     avatarUrl: proProfile?.avatar_url ?? null,
//     lat: proCoord.lat,
//     lng: proCoord.lng,
//   }), [proProfile, booking, proCoord]);

//   const [selPro, setSelPro] = useState<string | null>(null);
//   const handleSelect = useCallback((id: string) => setSelPro((s) => s === id ? null : id), []);

//   const arrived  = eta === 0;
//   const proName  = proProfile?.full_name ?? "Professionnel";
//   const proPhone = proProfile?.phone ?? null;

//   return (
//     <View style={styles.root}>
//       {/* Supabase Realtime (non-visual) */}
//       {!isDemoBooking && bookingId ? (
//         <LiveTrackingChannel
//           bookingId={bookingId}
//           mode="watch"
//           onPosition={handlePosition}
//         />
//       ) : null}

//       {/* ── Map section ──────────────────────────────────────────────── */}
//       <View style={[styles.mapSection, { height: MAP_H }]}>

//         {/* SVG Map background */}
//         <MapCanvas
//           offset={{ x: 0, y: 0 }}
//           vw={SCREEN_W}
//           vh={MAP_H}
//           zoom={ZOOM}
//           showRadius={false}
//         />

//         {/* Dashed route line: pro → patient */}
//         <Svg
//           style={StyleSheet.absoluteFill}
//           width={SCREEN_W}
//           height={MAP_H}
//           pointerEvents="none"
//         >
//           <SvgPath
//             d={`M${proScreenPt.x.toFixed(1)},${(proScreenPt.y + proFloat).toFixed(1)} L${patientScreenPt.x.toFixed(1)},${patientScreenPt.y.toFixed(1)}`}
//             fill="none"
//             stroke="#6B46C1"
//             strokeWidth={4}
//             strokeDasharray="6 6"
//             strokeLinecap="round"
//             opacity={0.75}
//           />
//         </Svg>

//         {/* Patient pin */}
//         <View
//           pointerEvents="none"
//           style={[
//             styles.pinAbs,
//             {
//               left: patientScreenPt.x - 18,
//               top:  patientScreenPt.y - 50,
//               zIndex: 35,
//             },
//           ]}
//         >
//           <PatientPin color={Colors.primary} label={"Vous"} />
//         </View>

//         {/* Pro pin */}
//         <View
//           style={[
//             styles.pinAbs,
//             {
//               left:   proScreenPt.x - 25,
//               top:    proScreenPt.y - 25,
//               zIndex: selPro ? 50 : 30,
//             },
//           ]}
//           onStartShouldSetResponder={() => true}
//         >
//           <ProPin
//             pro={trackingPro}
//             // animT={animT}
//             isSelected={selPro === trackingPro.id}
//             onSelect={handleSelect}
//           />
//         </View>

//         {/* Header overlay: close + ETA pill */}
//         <View style={styles.header} pointerEvents="box-none">
//           <TouchableOpacity
//             style={styles.closeBtn}
//             onPress={() => router.replace("/patient")}
//           >
//             <X size={20} color={Colors.textPrimary} />
//           </TouchableOpacity>

//           <View style={styles.etaPill}>
//             <View
//               style={[
//                 styles.etaDot,
//                 { backgroundColor: arrived ? Colors.success : Colors.accent },
//               ]}
//             />
//             <Text style={styles.etaText}>
//               {arrived ? "Arrivé !" : `En route — ${eta} min`}
//             </Text>
//           </View>

//           <View style={{ width: 40 }} />
//         </View>

//         {/* Map credit */}
//         <Text style={styles.credit} pointerEvents="none">Fès · CareLink</Text>
//       </View>

//       {/* ── Bottom sheet ──────────────────────────────────────────────── */}
//       <View style={styles.sheet}>
//         <View style={styles.dragger} />

//         {/* Progress */}
//         <View style={styles.progressHead}>
//           <Text style={styles.progressLabel}>
//             {arrived ? "Le professionnel est arrivé" : "En route vers vous"}
//           </Text>
//           <Text style={styles.progressValue}>{arrived ? "Arrivé" : `${eta} min`}</Text>
//         </View>
//         <View style={styles.progressBar}>
//           <View
//             style={[
//               styles.progressFill,
//               { width: `${Math.max(10, 100 - eta * 8)}%` },
//             ]}
//           />
//         </View>

//         {/* Provider card */}
//         <View style={styles.providerCard}>
//           <View style={styles.providerMeta}>
//             <Text style={styles.providerName}>{proName}</Text>
//             <Text style={styles.providerSub}>
//               {booking?.specialty?.replaceAll("_", " ") ?? "Soin"}
//               {" · "}
//               {booking?.address ?? "Adresse"}
//             </Text>
//           </View>
//           <View style={styles.priceBlock}>
//             <Text style={styles.priceValue}>
//               {booking?.final_price_mad ?? booking?.budget_max_mad ?? "—"}
//             </Text>
//             <Text style={styles.priceUnit}>MAD</Text>
//           </View>
//         </View>

//         {/* Actions */}
//         <View style={styles.actionsRow}>
//           {proPhone ? (
//             <TouchableOpacity
//               style={styles.secondaryBtn}
//               onPress={() => void Linking.openURL(`tel:${proPhone}`)}
//             >
//               <Phone size={18} color={Colors.primary} />
//               <Text style={styles.secondaryBtnText}>Appeler</Text>
//             </TouchableOpacity>
//           ) : null}

//           <TouchableOpacity
//             style={styles.secondaryBtn}
//             onPress={() => { if (bookingId) router.push(`/patient/chat/${bookingId}`); }}
//           >
//             <MessageCircle size={18} color={Colors.primary} />
//             <Text style={styles.secondaryBtnText}>Message</Text>
//           </TouchableOpacity>

//           {arrived && (
//             <TouchableOpacity
//               style={styles.completeBtn}
//               onPress={() => { if (bookingId) router.replace(`/patient/rating/${bookingId}`); }}
//             >
//               <Text style={styles.completeBtnText}>Terminer</Text>
//             </TouchableOpacity>
//           )}
//         </View>

//         {loading && (
//           <View style={styles.loadingRow}>
//             <ActivityIndicator size="small" color={Colors.primary} />
//             <Text style={styles.loadingText}>Mise à jour du trajet…</Text>
//           </View>
//         )}
//         {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
//       </View>
//     </View>
//   );
// }

// // ── Styles ────────────────────────────────────────────────────────────────────
// const styles = StyleSheet.create({
//   root:       { flex: 1, backgroundColor: Colors.surfaceWarm },

//   // Map
//   mapSection: { position: "relative", overflow: "hidden" },
//   pinAbs:     { position: "absolute" },
//   credit: {
//     position: "absolute", bottom: 6, right: 10,
//     fontSize: 9, color: "rgba(13,8,112,0.3)", fontWeight: "500",
//   },

//   // Header
//   header: {
//     position: "absolute", top: 0, left: 0, right: 0,
//     paddingHorizontal: 20, paddingTop: 20,
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     zIndex: 60,
//   },
//   closeBtn: {
//     width: 40, height: 40, borderRadius: 20,
//     backgroundColor: "white",
//     alignItems: "center", justifyContent: "center",
//     shadowColor: "#000", shadowOpacity: 0.12,
//     shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
//     elevation: 4,
//   },
//   etaPill: {
//     borderRadius: 999,
//     backgroundColor: "white",
//     paddingHorizontal: 14, height: 36,
//     flexDirection: "row", alignItems: "center", gap: 7,
//     shadowColor: "#000", shadowOpacity: 0.1,
//     shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
//     elevation: 4,
//   },
//   etaDot:  { width: 8, height: 8, borderRadius: 4 },
//   etaText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },

//   // Sheet
//   sheet: {
//     flex: 1,
//     backgroundColor: "white",
//     borderTopLeftRadius: 24, borderTopRightRadius: 24,
//     marginTop: -18,
//     paddingHorizontal: 20, paddingTop: 0, paddingBottom: 20,
//   },
//   dragger: {
//     alignSelf: "center", width: 40, height: 4,
//     borderRadius: 2, backgroundColor: "#E0E0E0", marginVertical: 10,
//   },

//   // Progress
//   progressHead:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
//   progressLabel: { color: Colors.textMuted, fontSize: 12 },
//   progressValue: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
//   progressBar: {
//     height: 4, borderRadius: 999, backgroundColor: "#EFEFEF",
//     overflow: "hidden", marginTop: 8, marginBottom: 10,
//   },
//   progressFill: {
//     height: "100%", borderRadius: 999,
//     backgroundColor: Colors.primary,
//   },

//   // Provider
//   providerCard: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
//   providerMeta: { flex: 1 },
//   providerName: { color: Colors.textPrimary, fontSize: 15, fontWeight: "600" },
//   providerSub:  { color: Colors.textMuted, fontSize: 12 },
//   priceBlock:   { alignItems: "flex-end" },
//   priceValue:   { color: Colors.primary, fontSize: 20, fontWeight: "700" },
//   priceUnit:    { color: Colors.textMuted, fontSize: 11 },

//   // Actions
//   actionsRow: { flexDirection: "row", gap: 8 },
//   secondaryBtn: {
//     flex: 1, height: 46, borderRadius: 12,
//     borderWidth: 1, borderColor: "#E0E0E0",
//     alignItems: "center", justifyContent: "center",
//     flexDirection: "row", gap: 6,
//   },
//   secondaryBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "500" },
//   completeBtn: {
//     flex: 1, height: 46, borderRadius: 12,
//     backgroundColor: Colors.primary,
//     alignItems: "center", justifyContent: "center",
//   },
//   completeBtnText: { color: "white", fontSize: 13, fontWeight: "600" },

//   loadingRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
//   loadingText: { color: Colors.textMuted, fontSize: 12 },
//   errorText:   { marginTop: 8, color: Colors.danger, fontSize: 12 },
// });
/**
 * CareLink — Live Tracking Screen
 * 100% pixel-matched to the approved screenshot:
 *   • Green map takes ~75% of screen height
 *   • "Vous" dark navy pill + pulsing dot = patient marker
 *   • Pro circular avatar photo (not a pin shape)
 *   • Dashed navy line connecting pro → patient
 *   • "En route — X min" white pill in header (with colored dot)
 *   • X close button top-left
 *   • White bottom sheet: progress bar, provider card, Appeler + Message buttons
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Linking,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessageCircle, Phone, X } from "lucide-react-native";
import Svg, { Path as SvgPath } from "react-native-svg";
import { db } from "@/lib/db/dal";
import type { Booking, Profile } from "@/lib/db/types";
import {
  buildDemoBooking,
  buildDemoProfile,
  isDemoBookingId,
  normalizeRouteParam,
} from "@/lib/demo-booking";
import { LiveTrackingChannel } from "@/components/LiveTrackingChannel";
import { haversineKm } from "@/components/map/engine";

// ── Constants ─────────────────────────────────────────────────────────────────
const SCREEN_W  = Dimensions.get("window").width;
const SCREEN_H  = Dimensions.get("window").height;
const MAP_H     = Math.round(SCREEN_H * 0.72); // ~72% = exactly the screenshot ratio
const NAVY      = "#0D0870";

// ── Map colors (matching screenshot's soft green) ─────────────────────────────
const MAP_BG        = "#D4E8C2"; // light green land
const MAP_ROAD_W    = "rgba(255,255,255,0.75)";
const MAP_ROAD_GRAY = "rgba(200,200,200,0.5)";

// ── Demo path ─────────────────────────────────────────────────────────────────
type LatLng = { lat: number; lng: number };

const MAP_CENTER: LatLng = { lat: 34.037, lng: -5.004 };

const DEMO_PATH: LatLng[] = [
  { lat: 34.052, lng: -4.982 },
  { lat: 34.049, lng: -4.986 },
  { lat: 34.046, lng: -4.990 },
  { lat: 34.043, lng: -4.994 },
  { lat: 34.040, lng: -4.998 },
  { lat: 34.037, lng: -5.001 },
];

// Mercator projection
function project(coord: LatLng, center: LatLng, zoom: number, vw: number, vh: number) {
  const latScale = Math.cos((center.lat * Math.PI) / 180);
  return {
    x: vw / 2 + (coord.lng - center.lng) * zoom * latScale,
    y: vh / 2 - (coord.lat - center.lat) * zoom,
  };
}

const ZOOM = 7500;
const DEMO_SPEED_KMH = 28; // Demo vehicle speed used for ETA calculations (km/h)

// ── "Vous" patient pin (dark navy chip + pulsing dot) ─────────────────────────
function VousPin() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 0.1, 0] });

  return (
    <View style={vp.wrap} pointerEvents="none">
      {/* "Vous" chip */}
      <View style={vp.chip}>
        <Text style={vp.chipTxt}>Vous</Text>
      </View>
      {/* Connector stem */}
      <View style={vp.stem} />
      {/* Pulsing dot */}
      <View style={vp.dotContainer}>
        <Animated.View style={[vp.halo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]} />
        <View style={vp.dot} />
      </View>
    </View>
  );
}

const vp = StyleSheet.create({
  wrap:    { alignItems: "center" },
  chip: {
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: NAVY,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  chipTxt: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  stem:    { width: 2, height: 6, backgroundColor: NAVY, opacity: 0.5 },
  dotContainer: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  halo: {
    position: "absolute",
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: NAVY,
  },
  dot: {
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: NAVY,
    borderWidth: 2.5, borderColor: "#FFFFFF",
    shadowColor: NAVY, shadowOpacity: 0.5,
    shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
});

// ── Pro avatar circle (photo or initials, exact style from screenshot) ─────────
function ProAvatar({ uri, initials, size = 46 }: { uri?: string | null; initials: string; size?: number }) {
  return (
    <View style={[pa.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <View style={[pa.fallback, { backgroundColor: NAVY, borderRadius: size / 2 }]}>
          <Text style={[pa.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
        </View>
      )}
    </View>
  );
}

const pa = StyleSheet.create({
  wrap: { overflow: "hidden", borderWidth: 2.5, borderColor: "#FFFFFF" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  initials: { color: "#FFFFFF", fontWeight: "700" },
});

// ── Pro map pin (circular photo on the map, no card, just the circle) ─────────
function ProMapPin({ uri, initials, size = 46 }: { uri?: string | null; initials: string; size?: number }) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -4, duration: 1600, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0,  duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, [float]);

  return (
    <Animated.View style={[pm.wrap, { transform: [{ translateY: float }] }]}>
      {/* Outer glow ring */}
      <View style={[pm.glow, { width: size + 14, height: size + 14, borderRadius: (size + 14) / 2 }]} />
      {/* Circle photo */}
      <ProAvatar uri={uri} initials={initials} size={size} />
    </Animated.View>
  );
}

const pm = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", position: "relative" },
  glow: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.5)",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
});

// ── Inline SVG map (no external libs — pure View + SVG roads) ─────────────────
function MapBackground({ vw, vh }: { vw: number; vh: number }) {
  // Compute road paths centered on MAP_CENTER
  const proj = (lat: number, lng: number) =>
    project({ lat, lng }, MAP_CENTER, ZOOM, vw, vh);

  const roads: { pts: [number, number][]; w: number; color: string }[] = [
    // Horizontal major road
    { pts: [[-5.08, 34.037], [-4.94, 34.037]], w: 20, color: MAP_ROAD_W },
    // Horizontal minor
    { pts: [[-5.08, 34.050], [-4.94, 34.050]], w: 10, color: MAP_ROAD_W },
    { pts: [[-5.08, 34.022], [-4.94, 34.022]], w: 10, color: MAP_ROAD_GRAY },
    // Vertical major
    { pts: [[-4.995, 34.07], [-4.995, 34.00]], w: 20, color: MAP_ROAD_W },
    // Vertical minor
    { pts: [[-5.025, 34.07], [-5.025, 34.00]], w: 10, color: MAP_ROAD_GRAY },
    { pts: [[-4.965, 34.07], [-4.965, 34.00]], w: 10, color: MAP_ROAD_GRAY },
    // Diagonal
    { pts: [[-5.05, 34.06], [-4.96, 34.01]], w: 8, color: MAP_ROAD_GRAY },
  ];

  const makePath = (pts: [number, number][]) =>
    pts.map(([lng, lat], i) => {
      const p = proj(lat, lng);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ");

  return (
    <Svg style={StyleSheet.absoluteFill} width={vw} height={vh}>
      {roads.map((r, i) => (
        <SvgPath
          key={i}
          d={makePath(r.pts)}
          fill="none"
          stroke={r.color}
          strokeWidth={r.w}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

type TrackPosition = { lat: number; lng: number; at: string };

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LiveTrackingScreen() {
  const router        = useRouter();
  const params        = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId     = normalizeRouteParam(params.bookingId);
  const isDemoBooking = isDemoBookingId(bookingId);

  const [booking,    setBooking]    = useState<Booking | null>(null);
  const [proProfile, setProProfile] = useState<Profile | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [eta,        setEta]        = useState(10);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [proCoord,   setProCoord]   = useState<LatLng>(DEMO_PATH[0]);
  const [routeCoords, setRouteCoords] = useState<LatLng[] | null>(null);
  const [routeCenter, setRouteCenter] = useState<LatLng | null>(null);
  const [routeLoaded, setRouteLoaded] = useState(false);

  // Spring-animated pro position on screen
  const initPt    = project(DEMO_PATH[0], routeCenter ?? MAP_CENTER, ZOOM, SCREEN_W, MAP_H);
  const proAnimX  = useRef(new Animated.Value(initPt.x)).current;
  const proAnimY  = useRef(new Animated.Value(initPt.y)).current;
  const [svgPro,  setSvgPro]  = useState({ x: initPt.x, y: initPt.y });

  // Mirror animated X/Y into state for the SVG dashed line
  useEffect(() => {
    const ix = proAnimX.addListener(({ value }) => setSvgPro((p) => ({ ...p, x: value })));
    const iy = proAnimY.addListener(({ value }) => setSvgPro((p) => ({ ...p, y: value })));
    return () => { proAnimX.removeListener(ix); proAnimY.removeListener(iy); };
  }, [proAnimX, proAnimY]);

  // Re-spring when proCoord changes
  const proScreenPt = useMemo(
    () => project(proCoord, routeCenter ?? MAP_CENTER, ZOOM, SCREEN_W, MAP_H),
    [proCoord, routeCenter]
  );

  useEffect(() => {
    Animated.spring(proAnimX, { toValue: proScreenPt.x, useNativeDriver: false, friction: 7, tension: 55 }).start();
    Animated.spring(proAnimY, { toValue: proScreenPt.y, useNativeDriver: false, friction: 7, tension: 55 }).start();
  }, [proScreenPt.x, proScreenPt.y]);

  // Patient fixed point
  const patientPt = useMemo(
    () => project(routeCoords ? routeCoords[routeCoords.length - 1] : MAP_CENTER, routeCenter ?? MAP_CENTER, ZOOM, SCREEN_W, MAP_H),
    [routeCoords, routeCenter]
  );

  // ── Load booking ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!bookingId) { setLoading(false); setErrorMsg("Réservation introuvable."); return; }
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

        // attempt to extract booking coordinates (RPC may have stored them as booking_lat/booking_lng or lat/lng)
        const tryExtractCoords = (obj: any): LatLng | null => {
          if (!obj) return null;
          const lat = obj.booking_lat ?? obj.lat ?? obj.latitude ?? obj.p_lat ?? obj.b_lat ?? obj.location_lat;
          const lng = obj.booking_lng ?? obj.lng ?? obj.longitude ?? obj.p_lng ?? obj.b_lng ?? obj.location_lng;
          if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
          return null;
        };

        const bookingCoords = tryExtractCoords(b) ?? null;

        if (!cancelled) {
          setBooking(b);
          setProProfile(prof);
          if (bookingCoords) {
            // treat booking coords as destination route end
            setRouteCoords((prev) => prev ?? [bookingCoords]);
            setRouteCenter((c) => c ?? bookingCoords);
          }
        }
      } catch (e) {
        if (!cancelled) setErrorMsg(e instanceof Error ? e.message : "Suivi indisponible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [bookingId, isDemoBooking]);

  // ── Demo path animation (smooth, speed-based with real route fetch) ──────
  useEffect(() => {
    if (!isDemoBooking) return;
    let cancelled = false;

    // If route not loaded, fetch route from OSRM between a demo start and the patient center
    (async () => {
      try {
        // demo start (example in Fès outskirts) and destination (patient)
        const demoStart = DEMO_PATH[0];
        const dest = MAP_CENTER;
        const coordsStr = `${demoStart.lng},${demoStart.lat};${dest.lng},${dest.lat}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Routing error ${res.status}`);
        const body = await res.json();
        const coords: LatLng[] = body.routes && body.routes[0] && body.routes[0].geometry && body.routes[0].geometry.coordinates
          ? body.routes[0].geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }))
          : DEMO_PATH;

        if (cancelled) return;
        setRouteCoords(coords);

        // compute center of route for projection
        const avg = coords.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
        const center = { lat: avg.lat / coords.length, lng: avg.lng / coords.length };
        setRouteCenter(center);
        setRouteLoaded(true);

        // start smooth motion along route using speed
        const speedMps = (DEMO_SPEED_KMH * 1000) / 3600;
        const distMeters = (a: LatLng, b: LatLng) => haversineKm(a, b) * 1000;

        let current: LatLng = { ...coords[0] };
        let targetIdx = 1;

        const remainingMeters = (pos: LatLng, idx: number) => {
          let rem = distMeters(pos, coords[idx]);
          for (let i = idx; i < coords.length - 1; i++) rem += distMeters(coords[i], coords[i + 1]);
          return rem;
        };

        // initial ETA
        const initialRem = remainingMeters(current, 1);
        setEta(Math.max(0, Math.ceil(initialRem / speedMps / 60)));
        setProCoord({ ...current });

        const tickInterval = 1000;
        const iv = setInterval(() => {
          if (cancelled) return;
          if (targetIdx >= coords.length) {
            setEta(0);
            setProCoord({ ...coords[coords.length - 1] });
            clearInterval(iv);
            return;
          }

          const target = coords[targetIdx];
          const segDist = distMeters(current, target);
          if (segDist < 1) {
            current = { ...target };
            targetIdx += 1;
            setProCoord({ ...current });
            return;
          }

          const dt = tickInterval / 1000;
          const move = Math.min(1, (speedMps * dt) / segDist);
          current = {
            lat: current.lat + (target.lat - current.lat) * move,
            lng: current.lng + (target.lng - current.lng) * move,
          };

          setProCoord({ ...current });

          const rem = remainingMeters(current, targetIdx);
          const etaMin = Math.max(0, Math.ceil(rem / speedMps / 60));
          setEta(etaMin);

          if (targetIdx === coords.length - 1 && rem < 5) {
            setEta(0);
            setProCoord({ ...coords[coords.length - 1] });
            clearInterval(iv);
          }
        }, tickInterval);

        return () => clearInterval(iv);
      } catch (e) {
        // fallback to older local path if routing fails
        console.warn("Route fetch failed, using demo path", e);
        setRouteCoords(DEMO_PATH);
        setRouteCenter(MAP_CENTER);
        setRouteLoaded(true);
        setProCoord(DEMO_PATH[0]);
      }
    })();

    return () => { cancelled = true; };
  }, [isDemoBooking]);

  // ── Real booking route fetch: when booking + a pro origin or live origin available
  useEffect(() => {
    let cancelled = false;
    if (isDemoBooking) return;
    if (!booking) return;

    // find booking destination coords from booking row
    const tryExtractCoords = (obj: any): LatLng | null => {
      if (!obj) return null;
      const lat = obj.booking_lat ?? obj.lat ?? obj.latitude ?? obj.p_lat ?? obj.b_lat ?? obj.location_lat;
      const lng = obj.booking_lng ?? obj.lng ?? obj.longitude ?? obj.p_lng ?? obj.b_lng ?? obj.location_lng;
      if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
      return null;
    };

    const dest = tryExtractCoords(booking);
    if (!dest) {
      // no destination coords — cannot fetch route
      return;
    }

    const originCandidates: (LatLng | null)[] = [];
    // 1) liveProOrigin (first seen live position)
    if (liveProOrigin) originCandidates.push(liveProOrigin);
    // 2) professional last-known coords from pros table (via RPC stored fields) — attempt to fetch
    (async () => {
      try {
        if (booking.professional_id) {
          const fullPro = await db.pros.get(booking.professional_id);
          const pcoords = tryExtractCoords(fullPro);
          if (pcoords) originCandidates.push(pcoords);
        }
      } catch (e) {
        // ignore
      }

      // pick the first available origin
      const origin = originCandidates.find(Boolean) as LatLng | undefined;
      if (!origin) return;

      try {
        const coordsStr = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Routing error ${res.status}`);
        const body = await res.json();
        const coords: LatLng[] = body.routes && body.routes[0] && body.routes[0].geometry && body.routes[0].geometry.coordinates
          ? body.routes[0].geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }))
          : null;
        if (cancelled) return;
        if (!coords || coords.length === 0) return;
        setRouteCoords(coords);
        const avg = coords.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
        const center = { lat: avg.lat / coords.length, lng: avg.lng / coords.length };
        setRouteCenter(center);
        setRouteLoaded(true);

        // start movement along route (same logic as demo)
        const speedMps = (DEMO_SPEED_KMH * 1000) / 3600;
        const distMeters = (a: LatLng, b: LatLng) => haversineKm(a, b) * 1000;
        let current: LatLng = { ...coords[0] };
        let targetIdx = 1;
        const remainingMeters = (pos: LatLng, idx: number) => {
          let rem = distMeters(pos, coords[idx]);
          for (let i = idx; i < coords.length - 1; i++) rem += distMeters(coords[i], coords[i + 1]);
          return rem;
        };
        const initialRem = remainingMeters(current, 1);
        setEta(Math.max(0, Math.ceil(initialRem / speedMps / 60)));
        setProCoord({ ...current });

        const tickInterval = 1000;
        const iv = setInterval(() => {
          if (cancelled) return;
          if (targetIdx >= coords.length) {
            setEta(0);
            setProCoord({ ...coords[coords.length - 1] });
            clearInterval(iv);
            return;
          }
          const target = coords[targetIdx];
          const segDist = distMeters(current, target);
          if (segDist < 1) { current = { ...target }; targetIdx += 1; setProCoord({ ...current }); return; }
          const dt = tickInterval / 1000;
          const move = Math.min(1, (speedMps * dt) / segDist);
          current = { lat: current.lat + (target.lat - current.lat) * move, lng: current.lng + (target.lng - current.lng) * move };
          setProCoord({ ...current });
          const rem = remainingMeters(current, targetIdx);
          const etaMin = Math.max(0, Math.ceil(rem / speedMps / 60));
          setEta(etaMin);
          if (targetIdx === coords.length - 1 && rem < 5) { setEta(0); setProCoord({ ...coords[coords.length - 1] }); clearInterval(iv); }
        }, tickInterval);

        return () => clearInterval(iv);
      } catch (e) {
        console.warn("Route fetch for booking failed", e);
      }
    })();

    return () => { cancelled = true; };
  }, [booking, isDemoBooking]);

  // NOTE: ETA is now computed from demo motion (distance / speed). Remove the blind countdown.

  const [liveProOrigin, setLiveProOrigin] = useState<LatLng | null>(null);

  const handlePosition = useCallback((pos: TrackPosition) => {
    // keep animating pro position on screen
    setProCoord({ lat: pos.lat, lng: pos.lng });
    // capture first seen pro origin for routing (only if not demo)
    if (!isDemoBooking && !liveProOrigin) {
      setLiveProOrigin({ lat: pos.lat, lng: pos.lng });
    }
  }, [isDemoBooking, liveProOrigin]);

  // ── Derived values ────────────────────────────────────────────────────────
  const arrived      = eta === 0;
  const proName      = proProfile?.full_name ?? "Karim Benali";
  const proPhone     = proProfile?.phone     ?? null;
  const proAvatar    = proProfile?.avatar_url ?? null;
  const proInitials  = proName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const proSpecialty = booking?.specialty?.replaceAll("_", " ") ?? "Infirmier";
  const proPrice     = booking?.final_price_mad ?? booking?.budget_max_mad ?? 120;
  const progress     = Math.max(8, 100 - eta * 8);

  return (
    <View style={s.root}>
      {!isDemoBooking && bookingId ? (
        <LiveTrackingChannel bookingId={bookingId} mode="watch" onPosition={handlePosition} />
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  MAP — 72% of screen height, green background                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View style={[s.map, { height: MAP_H, backgroundColor: MAP_BG }]}>

        {/* Road network SVG */}
        <MapBackground vw={SCREEN_W} vh={MAP_H} />

        {/* Route: full path (if available) + moving dashed line pro → patient */}
        <Svg
          style={StyleSheet.absoluteFill}
          width={SCREEN_W}
          height={MAP_H}
          pointerEvents="none"
        >
          {routeCoords && routeCoords.length > 1 ? (
            <SvgPath
              d={routeCoords.map((p, i) => {
                const pt = project(p, routeCenter ?? MAP_CENTER, ZOOM, SCREEN_W, MAP_H);
                return `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
              }).join(" ")}
              fill="none"
              stroke="rgba(13,8,112,0.12)"
              strokeWidth={6}
              strokeLinecap="round"
            />
          ) : null}

          <SvgPath
            d={`M${svgPro.x.toFixed(1)},${svgPro.y.toFixed(1)} L${patientPt.x.toFixed(1)},${patientPt.y.toFixed(1)}`}
            fill="none"
            stroke={NAVY}
            strokeWidth={2.5}
            strokeDasharray="9 7"
            strokeLinecap="round"
            opacity={0.9}
          />
        </Svg>

        {/* "Vous" patient pin — fixed */}
        <View
          pointerEvents="none"
          style={[s.pinAbs, { left: patientPt.x - 24, top: patientPt.y - 50, zIndex: 20 }]}
        >
          <VousPin />
        </View>

        {/* Pro circular avatar — spring-animated */}
        <Animated.View
          style={[
            s.pinAbs,
            {
              left:   Animated.subtract(proAnimX, 30),
              top:    Animated.subtract(proAnimY, 30),
              zIndex: 25,
            },
          ]}
        >
          <ProMapPin uri={proAvatar} initials={proInitials} size={46} />
        </Animated.View>

        {/* ── Header: X + ETA pill ── */}
        <View style={s.header} pointerEvents="box-none">
          {/* X button — top left */}
          <TouchableOpacity style={s.closeBtn} onPress={() => router.replace("/patient")}>
            <X size={20} color="#1F2937" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* ETA pill — centred */}
          <View style={s.etaPill}>
            <View style={[s.etaDot, { backgroundColor: arrived ? "#16A34A" : "#22D3EE" }]} />
            <Text style={s.etaText}>
              {arrived ? "Arrivé !" : `En route — ${eta} min`}
            </Text>
          </View>

          {/* Spacer to balance the X */}
          <View style={{ width: 44 }} />
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  BOTTOM SHEET — white, rounded top corners, overlaps map by 20px  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View style={s.sheet}>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* Drag handle */}
          <View style={s.handle} />

          {/* Progress label + value */}
          <View style={s.progressRow}>
            <Text style={s.progressLabel}>
              {arrived ? "Le professionnel est arrivé" : "En route vers vous"}
            </Text>
            <Text style={s.progressValue}>{arrived ? "Arrivé" : `${eta} min`}</Text>
          </View>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress}%` as `${number}%` }]} />
          </View>

          {/* Provider card */}
          <View style={s.providerCard}>
            {/* Circular avatar with cyan status dot */}
            <View style={s.avatarWrap}>
              <ProAvatar uri={proAvatar} initials={proInitials} size={52} />
              <View style={s.statusDot} />
            </View>

            {/* Name / specialty / rating */}
            <View style={s.providerInfo}>
              <Text style={s.providerName} numberOfLines={1}>{proName}</Text>
              <Text style={s.providerSub} numberOfLines={1}>
                {proSpecialty}
                {booking?.address ? ` · ${booking.address.split(",")[0]}` : " · Pansement"}
              </Text>
              <View style={s.ratingRow}>
                <Text style={s.ratingStar}>★</Text>
                <Text style={s.ratingVal}>4.8</Text>
                <Text style={s.ratingCount}>(127)</Text>
              </View>
            </View>

            {/* Price */}
            <View style={s.priceBlock}>
              <Text style={s.priceVal}>{proPrice}</Text>
              <Text style={s.priceUnit}>MAD</Text>
            </View>
          </View>

          {/* ── Action buttons exactly as in screenshot ── */}
          <View style={s.actions}>
            <TouchableOpacity
              style={s.actionBtn}
              activeOpacity={0.75}
              onPress={() => proPhone ? void Linking.openURL(`tel:${proPhone}`) : null}
            >
              <Phone size={18} color="#1F2937" strokeWidth={2} />
              <Text style={s.actionTxt}>Appeler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.actionBtn}
              activeOpacity={0.75}
              onPress={() => { if (bookingId) router.push(`/patient/chat/${bookingId}`); }}
            >
              <MessageCircle size={18} color="#1F2937" strokeWidth={2} />
              <Text style={s.actionTxt}>Message</Text>
            </TouchableOpacity>
          </View>

          {/* "Terminer" only shows when arrived */}
          {arrived && (
            <TouchableOpacity
              style={s.completeBtn}
              onPress={() => { if (bookingId) router.replace(`/patient/rating/${bookingId}`); }}
            >
              <Text style={s.completeTxt}>Terminer la session</Text>
            </TouchableOpacity>
          )}

          {loading && (
            <View style={s.loadRow}>
              <ActivityIndicator size="small" color={NAVY} />
              <Text style={s.loadTxt}>Mise à jour…</Text>
            </View>
          )}
          {errorMsg ? <Text style={s.errTxt}>{errorMsg}</Text> : null}

        </ScrollView>

      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },

  // Map
  map: { position: "relative", overflow: "hidden", width: "100%" },
  pinAbs: { position: "absolute" },

  // Header overlay
  header: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: 52, paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 60,
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.14,
    shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  etaPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 999, paddingHorizontal: 18, height: 40,
    shadowColor: "#000", shadowOpacity: 0.12,
    shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  etaDot:  { width: 9, height: 9, borderRadius: 5 },
  etaText: { fontSize: 14, fontWeight: "700", color: "#111827" },

  // Bottom sheet
  sheet: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 22,
    paddingTop: 0,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: 38, height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginTop: 12, marginBottom: 16,
  },

  // Progress
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressLabel: { fontSize: 13, color: "#6B7280" },
  progressValue: { fontSize: 14, fontWeight: "800", color: NAVY },
  progressTrack: {
    height: 5, borderRadius: 999,
    backgroundColor: "#F3F4F6",
    overflow: "hidden", marginBottom: 18,
  },
  progressFill: {
    height: "100%", borderRadius: 999,
    backgroundColor: NAVY,
  },

  // Provider card
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  avatarWrap: { position: "relative", flexShrink: 0 },
  statusDot: {
    position: "absolute", bottom: 1, right: 1,
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: "#22D3EE",
    borderWidth: 2.5, borderColor: "#FFFFFF",
  },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 2 },
  providerSub:  { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  ratingRow:    { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingStar:   { color: "#FBBF24", fontSize: 14 },
  ratingVal:    { fontSize: 13, fontWeight: "700", color: "#111827" },
  ratingCount:  { fontSize: 12, color: "#9CA3AF" },
  priceBlock:   { alignItems: "flex-end" },
  priceVal:     { fontSize: 30, fontWeight: "800", color: NAVY, lineHeight: 34 },
  priceUnit:    { fontSize: 12, fontWeight: "500", color: "#6B7280" },

  // Action buttons — exactly two equal buttons side by side as in screenshot
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFAFA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  actionTxt: { fontSize: 15, fontWeight: "600", color: "#111827" },

  completeBtn: {
    marginTop: 14, height: 52, borderRadius: 16,
    backgroundColor: NAVY,
    alignItems: "center", justifyContent: "center",
  },
  completeTxt: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  loadRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  loadTxt:  { color: "#9CA3AF", fontSize: 12 },
  errTxt:   { marginTop: 8, color: "#EF4444", fontSize: 12 },
});
