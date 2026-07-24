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
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
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
//       if (!bookingId) { setLoading(false); setErrorMsg(t("reservation_not_found")); return; }
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
//         if (!cancelled) setErrorMsg(e instanceof Error ? e.message : t("tracking_unavailable"));
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
//             {arrived ? t("pro_arrived") : t("en_route_to_you")}
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
//               <Text style={styles.secondaryBtnText}>{t("call")}</Text>
//             </TouchableOpacity>
//           ) : null}

//           <TouchableOpacity
//             style={styles.secondaryBtn}
//             onPress={() => { if (bookingId) router.push(`/patient/chat/${bookingId}`); }}
//           >
//             <MessageCircle size={18} color={Colors.primary} />
//             <Text style={styles.secondaryBtnText}>{t("message_action")}</Text>
//           </TouchableOpacity>

//           {arrived && (
//             <TouchableOpacity
//               style={styles.completeBtn}
//               onPress={() => { if (bookingId) router.replace(`/patient/rating/${bookingId}`); }}
//             >
//               <Text style={styles.completeBtnText}>{t("finish")}</Text>
//             </TouchableOpacity>
//           )}
//         </View>

//         {loading && (
//           <View style={styles.loadingRow}>
//             <ActivityIndicator size="small" color={Colors.primary} />
//             <Text style={styles.loadingText}>{t("updating_route")}</Text>
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
  Share,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Crosshair, MessageCircle, Phone, Share2, X } from "lucide-react-native";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import { showToast } from "@/lib/toast";
import { DEFAULT_AVATAR } from "@/lib/colors";
import type { Booking, Profile } from "@/lib/db/types";
import {
  buildDemoBooking,
  buildDemoProfile,
  isDemoBookingId,
  normalizeRouteParam,
} from "@/lib/demo-booking";
import { supabase } from "@/lib/supabase";
import { LiveTrackingChannel } from "@/components/LiveTrackingChannel";
import { haversineKm, CREAM } from "@/components/map/engine";
import { CareLinkMapView } from "@/components/map/CareLinkMapView";
import { DEMO_DRIVER_AVATAR } from "@/lib/demo-avatars";
import { haptics } from "@/lib/haptics";

// ── Constants ─────────────────────────────────────────────────────────────────
const SCREEN_W  = Dimensions.get("window").width;
const SCREEN_H  = Dimensions.get("window").height;
const MAP_H     = Math.round(SCREEN_H * 0.72); // ~72% = exactly the screenshot ratio
const NAVY      = "#0D0870";

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

const DEMO_SPEED_KMH = 28; // Demo vehicle speed used for ETA calculations (km/h)

// ── Pro avatar circle (photo or initials, exact style from screenshot) ─────────
function ProAvatar({
  uri,
  source,
  initials,
  size = 46,
}: {
  uri?: string | null;
  source?: import("react-native").ImageSourcePropType;
  initials: string;
  size?: number;
}) {
  const img = source ?? (uri ? { uri } : DEFAULT_AVATAR);
  return (
    <View style={[pa.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {img ? (
        <Image
          source={img}
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

type TrackPosition = { lat: number; lng: number; at: string };

// ── Arrival confetti — pure RN primitives, native-driven, no external lib ─────
function ConfettiBurst() {
  const pieces = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      x: (Math.random() - 0.5) * 280,
      color: ["#0D0870", "#5BB8D4", "#22C55E", "#F59E0B", "#E24B4A"][i % 5],
      rot: (Math.random() - 0.5) * 720,
      v: new Animated.Value(0),
    })),
  ).current;
  useEffect(() => {
    Animated.stagger(
      28,
      pieces.map((p) => Animated.timing(p.v, { toValue: 1, duration: 1700, useNativeDriver: true })),
    ).start();
  }, [pieces]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "52%",
            width: 9,
            height: 9,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) },
              { translateY: p.v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -240, -180] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.rot}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

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
  const [recenterKey, setRecenterKey] = useState(0);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  // Pro identity from get_track_coords (authoritative even under hardened RLS).
  const [trackProMeta, setTrackProMeta] = useState<{ name: string | null; avatar: string | null }>({
    name: null,
    avatar: null,
  });

  // Index of the route point nearest the pro — splits traversed vs remaining
  const progressIdx = useMemo(() => {
    if (!routeCoords || routeCoords.length < 2) return 0;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < routeCoords.length; i++) {
      const d = haversineKm(proCoord, routeCoords[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }, [proCoord, routeCoords]);

  const patientCoord: LatLng =
    routeCoords && routeCoords.length ? routeCoords[routeCoords.length - 1] : MAP_CENTER;

  // Distance to patient, refreshed every 5 s. Reads latest coords via refs so the
  // interval is created ONCE (depending on proCoord would recreate it every tick
  // → runaway "maximum update depth").
  const proCoordRef = useRef(proCoord);
  proCoordRef.current = proCoord;
  const patientCoordRef = useRef(patientCoord);
  patientCoordRef.current = patientCoord;
  useEffect(() => {
    const update = () => setDistanceKm(haversineKm(proCoordRef.current, patientCoordRef.current));
    update();
    const iv = setInterval(update, 5000);
    return () => clearInterval(iv);
  }, []);

  // Fire a success haptic + confetti once, when the professional arrives.
  const arrivedHaptic = useRef(false);
  useEffect(() => {
    if (eta === 0 && !arrivedHaptic.current) {
      arrivedHaptic.current = true;
      haptics.success();
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(t);
    }
  }, [eta]);

  // ── Load booking ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!bookingId) { setLoading(false); setErrorMsg(t("reservation_not_found")); return; }
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
        if (!cancelled) setErrorMsg(e instanceof Error ? e.message : t("tracking_unavailable"));
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
    let iv: ReturnType<typeof setInterval> | undefined;

    // If route not loaded, fetch route from OSRM between a demo start and the patient center
    (async () => {
      try {
        // demo start (example in Fès outskirts) and destination (patient)
        const demoStart = DEMO_PATH[0];
        const dest = MAP_CENTER;
        const coordsStr = `${demoStart.lng},${demoStart.lat};${dest.lng},${dest.lat}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 5000); // don't hang → fall back to straight line
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timeoutId);
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

        const tickInterval = 120; // small, frequent steps → the marker glides
        iv = setInterval(() => {
          if (cancelled) return;
          if (targetIdx >= coords.length) {
            setEta(0);
            setProCoord({ ...coords[coords.length - 1] });
            if (iv) clearInterval(iv);
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
            if (iv) clearInterval(iv);
          }
        }, tickInterval);
      } catch (e) {
        // fallback to older local path if routing fails
        console.warn("Route fetch failed, using demo path", e);
        setRouteCoords(DEMO_PATH);
        setRouteCenter(MAP_CENTER);
        setRouteLoaded(true);
        setProCoord(DEMO_PATH[0]);
      }
    })();

    return () => { cancelled = true; if (iv) clearInterval(iv); };
  }, [isDemoBooking]);

  // ── Real booking route fetch: when booking + a pro origin or live origin available
  useEffect(() => {
    let cancelled = false;
    let iv: ReturnType<typeof setInterval> | undefined;
    if (isDemoBooking) return;
    if (!booking) return;

    // Destination (patient) + pro origin come from PostGIS via get_track_coords.
    // Fall back to a synthetic origin ~2.5 km away so the nurse always "comes to
    // you" exactly like the demo — even before the pro publishes a live GPS.
    (async () => {
      let destC: LatLng | null = null;
      let proOrigin: LatLng | null = null;
      // Destination = the patient's own live GPS (they're at the care location) —
      // real coords using only deployed infra, no RPC needed.
      try {
        destC = await geo.getCurrentPosition();
      } catch {
        // location denied/unavailable — fall through to other sources
      }
      // Pro origin = matched pro's coords from the public view (deployed).
      if (booking.professional_id) {
        try {
          proOrigin = await geo.getProCoords(booking.professional_id);
        } catch {
          // ignore
        }
      }
      // get_track_coords() is a supplementary source (street-address dest + pro
      // identity) used only when deployed; never required for real coords.
      try {
        const tc = await geo.getTrackCoords(booking.id);
        if (!destC) destC = tc.dest;
        if (!proOrigin) proOrigin = tc.pro;
        if (!cancelled && (tc.proName || tc.proAvatar)) {
          setTrackProMeta({ name: tc.proName, avatar: tc.proAvatar });
        }
      } catch {
        // RPC not deployed — fine, we already have real coords above
      }
      if (cancelled) return;
      const dest: LatLng = destC ?? MAP_CENTER; // demo center fallback → tracking still runs
      const synthetic: LatLng = { lat: dest.lat + 0.02, lng: dest.lng + 0.015 }; // ~2.5 km away
      const origin: LatLng = liveProOrigin ?? proOrigin ?? synthetic;

      // Road-following route (OSRM); straight line as a fallback so motion never stalls.
      let coords: LatLng[];
      try {
        const coordsStr = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Routing error ${res.status}`);
        const body = await res.json();
        coords =
          body.routes && body.routes[0]?.geometry?.coordinates
            ? body.routes[0].geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }))
            : [origin, dest];
      } catch {
        coords = [origin, dest];
      }
      if (cancelled || coords.length < 2) return;

      setRouteCoords(coords);
      const avg = coords.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
      setRouteCenter({ lat: avg.lat / coords.length, lng: avg.lng / coords.length });
      setRouteLoaded(true);

      // Movement along the route — identical glide to the demo.
      const speedMps = (DEMO_SPEED_KMH * 1000) / 3600;
      const distMeters = (a: LatLng, b: LatLng) => haversineKm(a, b) * 1000;
      let current: LatLng = { ...coords[0] };
      let targetIdx = 1;
      const remainingMeters = (pos: LatLng, idx: number) => {
        let rem = distMeters(pos, coords[idx]);
        for (let i = idx; i < coords.length - 1; i++) rem += distMeters(coords[i], coords[i + 1]);
        return rem;
      };
      setEta(Math.max(0, Math.ceil(remainingMeters(current, 1) / speedMps / 60)));
      setProCoord({ ...current });

      const tickInterval = 120; // small, frequent steps → the marker glides
      iv = setInterval(() => {
        if (cancelled) return;
        if (liveActiveRef.current) return; // real GPS is streaming → don't script
        if (targetIdx >= coords.length) {
          setEta(0);
          setProCoord({ ...coords[coords.length - 1] });
          if (iv) clearInterval(iv);
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
        setEta(Math.max(0, Math.ceil(rem / speedMps / 60)));
        if (targetIdx === coords.length - 1 && rem < 5) { setEta(0); setProCoord({ ...coords[coords.length - 1] }); if (iv) clearInterval(iv); }
      }, tickInterval);
    })();

    return () => { cancelled = true; if (iv) clearInterval(iv); };
  }, [booking, isDemoBooking]);

  // NOTE: ETA is now computed from demo motion (distance / speed). Remove the blind countdown.

  const [liveProOrigin, setLiveProOrigin] = useState<LatLng | null>(null);
  // Once the pro broadcasts real GPS, live positions win over the scripted glide.
  const liveActiveRef = useRef(false);

  // Drives the honest "waiting" label below: until the first real GPS frame
  // lands there is nothing to show, and a frozen map reads as a broken app.
  const [proLive, setProLive] = useState(false);

  const handlePosition = useCallback((pos: TrackPosition) => {
    liveActiveRef.current = true;
    setProLive(true);
    setProCoord({ lat: pos.lat, lng: pos.lng });
    // capture first seen pro origin for routing (only if not demo)
    if (!isDemoBooking && !liveProOrigin) {
      setLiveProOrigin({ lat: pos.lat, lng: pos.lng });
    }
  }, [isDemoBooking, liveProOrigin]);

  // Keep the patient's screen honest about where the mission actually is: the pro
  // advances `matched → en_route → in_progress → completed` on their side, and
  // without this subscription the patient only ever saw the status they arrived with.
  useEffect(() => {
    if (!bookingId || isDemoBooking) return;
    const channel = supabase
      .channel(`booking:track:${bookingId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => setBooking(payload.new as Booking),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, isDemoBooking]);

  // ── Derived values ────────────────────────────────────────────────────────
  const arrived      = eta === 0;
  const proName      = proProfile?.full_name ?? trackProMeta.name ?? (isDemoBooking ? "Karim Benali" : "Professionnel");
  const proPhone     = proProfile?.phone     ?? null;
  const proAvatar    = proProfile?.avatar_url ?? trackProMeta.avatar ?? (isDemoBooking ? "https://randomuser.me/api/portraits/men/32.jpg" : null);
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
      <View style={[s.map, { height: MAP_H, backgroundColor: CREAM }]}>

        {/* Real map (MapLibre) — patient + moving pro + road route */}
        <CareLinkMapView
          center={proCoord}
          patient={routeCoords && routeCoords.length ? routeCoords[routeCoords.length - 1] : MAP_CENTER}
          pro={{ ...proCoord, avatarSource: isDemoBooking ? DEMO_DRIVER_AVATAR : undefined, avatarUrl: proAvatar, initials: proInitials, specialty: proSpecialty, name: proName }}
          route={routeCoords ?? undefined}
          progressIdx={progressIdx}
          fitCoords={routeCoords ?? undefined}
          radiusKm={0}
          nightAuto
          recenterKey={recenterKey}
        />

        {/* Re-center FAB */}
        <TouchableOpacity
          style={s.recenterFab}
          onPress={() => setRecenterKey((k) => k + 1)}
          accessibilityRole="button"
          accessibilityLabel="Recentrer la carte"
        >
          <Crosshair size={20} color="#0D0870" strokeWidth={2.2} />
        </TouchableOpacity>

        {/* ── Header: X + ETA pill ── */}
        <View style={s.header} pointerEvents="box-none">
          {/* X button — top left */}
          <TouchableOpacity
            style={s.closeBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/patient/bookings"))}
            accessibilityRole="button"
            accessibilityLabel="Fermer le suivi"
          >
            <X size={20} color="#1F2937" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* ETA pill — centred */}
          <View style={s.etaPill}>
            <View style={[s.etaDot, { backgroundColor: arrived ? "#16A34A" : "#22D3EE" }]} />
            <Text style={s.etaText}>
              {arrived
                ? "Arrivé !"
                : `${distanceKm != null ? `${distanceKm.toFixed(1)} km · ` : ""}${eta} min`}
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
              {arrived
                ? t("pro_arrived")
                : !isDemoBooking && !proLive
                  ? t("waiting_pro_departure")
                  : t("en_route_to_you")}
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
              <ProAvatar
                uri={proAvatar}
                source={isDemoBooking ? DEMO_DRIVER_AVATAR : undefined}
                initials={proInitials}
                size={52}
              />
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

          {/* ── Action buttons ── */}
          <View style={s.actions}>
            <TouchableOpacity
              style={s.actionBtn}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Appeler le professionnel"
              onPress={() => {
                if (proPhone) void Linking.openURL(`tel:${proPhone}`);
                else showToast("Numéro indisponible — utilisez la messagerie 💬");
              }}
            >
              <Phone size={18} color="#1F2937" strokeWidth={2} />
              <Text style={s.actionTxt}>{t("call")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.actionBtn}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Partager le suivi"
              onPress={() =>
                void Share.share({ message: `Mon infirmier arrive dans ${eta} min — CareLinks` })
              }
            >
              <Share2 size={18} color="#1F2937" strokeWidth={2} />
              <Text style={s.actionTxt}>{t("share")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.actionBtn}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Envoyer un message"
              onPress={() => { if (bookingId) router.push(`/patient/chat/${bookingId}`); }}
            >
              <MessageCircle size={18} color="#1F2937" strokeWidth={2} />
              <Text style={s.actionTxt}>{t("message_action")}</Text>
            </TouchableOpacity>
          </View>

          {/* "Terminer" only shows when arrived */}
          {arrived && (
            <TouchableOpacity
              style={s.completeBtn}
              onPress={() => { if (bookingId) router.replace(`/patient/rating/${bookingId}`); }}
            >
              <Text style={s.completeTxt}>{t("end_session")}</Text>
            </TouchableOpacity>
          )}

          {loading && (
            <View style={s.loadRow}>
              <ActivityIndicator size="small" color={NAVY} />
              <Text style={s.loadTxt}>{t("updating")}</Text>
            </View>
          )}
          {errorMsg ? <Text style={s.errTxt}>{errorMsg}</Text> : null}

        </ScrollView>

      </View>

      {showConfetti ? <ConfettiBurst /> : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },

  // Map
  map: { position: "relative", overflow: "hidden", width: "100%" },
  pinAbs: { position: "absolute" },
  recenterFab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 55,
    shadowColor: "#0D0870",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },

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
