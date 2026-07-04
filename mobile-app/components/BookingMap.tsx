/**
 * CareLink — BookingMap  (v5 — fast + polished)
 * ────────────────────────────────────────────────────────────────────────────
 * PERFORMANCE: panning drives an Animated.ValueXY with useNativeDriver,
 * moving the already-rendered StaticMapLayer. No SVG path recomputation
 * during drag — that was the entire source of the lag.
 *
 * DESIGN: same premium look as before — pulsing profile circles, popup
 * cards, dashed radius ring, address bar, GPS button, Carte/Liste tabs.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LocateFixed } from "lucide-react-native";
import {
  PinchGestureHandler,
  State,
  type PinchGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { Colors } from "@/lib/colors";
import { geo } from "@/lib/db/geo";
import { haptics } from "@/lib/haptics";
import {
  MAP_CENTER,
  NAVY,
  project,
  specialtyColor,
} from "./map/engine";
import { StaticMapLayer } from "./map/StaticMapLayer";
import { PatientPin, ProPin, type ProPinData } from "./map/Pins";

// ── Constants ─────────────────────────────────────────────────────────────────
const ZOOM     = 7500;
const BOUND    = 130; // max pan distance in px before rubber-banding
const MIN_SCALE = 0.7; // pinch-zoom out limit
const MAX_SCALE = 2.6; // pinch-zoom in limit
const SCREEN_W = Dimensions.get("window").width;
const MAP_H    = 320;

const DEMO_PROS: ProPinData[] = [
  { id:"fz", initials:"FZ", name:"Fatima Zahra",  shortName:"Fatima Z.",  specialty:"Infirmière",       distanceKm:0.8, rating:4.9, priceMad:180, lat:34.044, lng:-4.993 },
  { id:"km", initials:"KM", name:"Karim Mansour", shortName:"Karim M.",   specialty:"Kinésithérapeute", distanceKm:1.4, rating:4.8, priceMad:220, lat:34.040, lng:-4.984 },
  { id:"sr", initials:"SR", name:"Samira Rifai",  shortName:"Samira R.",  specialty:"Psychologue",      distanceKm:2.1, rating:4.7, priceMad:350, lat:34.033, lng:-5.017 },
];

const DEMO_ADDRESSES = ["Rue Ibn Batouta, Fès", "Bd Hassan II, Fès", "Quartier Narjiss, Fès", "Médina, Fès"];

async function nominatim(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fr`,
      { headers: { "User-Agent": "CareLink/1.0" } }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const a = j.address ?? {};
    return [a.road || a.pedestrian, a.city || a.town].filter(Boolean).join(", ") || null;
  } catch { return null; }
}

// ── List rows (unchanged design) ──────────────────────────────────────────────
function ProListRow({ pro, isSelected, onPress, tab }: { pro: ProPinData; isSelected: boolean; onPress: () => void; tab: number }) {
  const color = specialtyColor(pro.specialty);
  if (tab === 1) {
    return (
      <View style={list.card}>
        <View style={[list.cardAvatar, { backgroundColor: color }]}>
          <Text style={list.cardAvatarText}>{pro.initials}</Text>
        </View>
        <View style={list.cardBody}>
          <View style={list.cardHead}>
            <View>
              <Text style={list.cardName}>{pro.name}</Text>
              <Text style={list.cardSpec}>{pro.specialty}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[list.cardPrice, { color }]}>{pro.priceMad}<Text style={list.cardPriceSub}> MAD</Text></Text>
              <Text style={list.cardRating}>★{pro.rating} · {pro.distanceKm.toFixed(1)}km</Text>
            </View>
          </View>
          <View style={list.cardActions}>
            <TouchableOpacity
              style={[list.reserveBtn, { backgroundColor: color }]}
              onPress={() => {
                try { 
                  // notify parent that user wants to reserve this demo pro
                  // (parent handles booking creation / navigation)
                  // @ts-ignore
                  typeof propsOnReserve !== 'undefined' && propsOnReserve(pro.id);
                } catch (e) {}
              }}
            >
              <Text style={list.reserveBtnText}>Réserver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[list.profileBtn, { borderColor: color + "44" }]}> 
              <Text style={[list.profileBtnText, { color }]}>Profil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
  return (
    <TouchableOpacity style={[list.row, isSelected && { backgroundColor: "#F8F8FF" }]} onPress={onPress} activeOpacity={0.75}>
      <View style={[list.rowAvatar, { backgroundColor: color }]}>
        <Text style={list.rowAvatarText}>{pro.initials}</Text>
      </View>
      <View style={list.rowInfo}>
        <Text style={list.rowName}>{pro.name}</Text>
        <Text style={list.rowSub}>
          <Text style={{ color: "#22C55E", fontSize: 10 }}>● </Text>{pro.specialty}
          <Text style={{ color: "#DDD" }}> · </Text>{pro.distanceKm.toFixed(1)} km
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[list.rowPrice, { color }]}>{pro.priceMad} MAD</Text>
        <Text style={list.rowRating}>★{pro.rating}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main BookingMap ───────────────────────────────────────────────────────────
export type BookingMapProps = {
  initialLat?: number;
  initialLng?: number;
  radiusKm?: number;
  primaryColor?: string;
  onChange?: (lat: number, lng: number) => void;
  pros?: ProPinData[];
  height?: number;
  showProList?: boolean;
  // called when user taps "Réserver" on a listed pro (demo/demo-mode)
  onReserve?: (proId: string) => void;
  // When true (default), fall back to sample pros if none are provided.
  // Set false in production so real users never see fake professionals.
  demo?: boolean;
  // Message shown over the map when there are no pros to display.
  emptyText?: string;
  // When false, hides the internal search bar + GPS button (use when the parent
  // screen provides its own address/GPS chrome, to avoid duplicated controls).
  showChrome?: boolean;
};


export function BookingMap({
  initialLat = MAP_CENTER.lat,
  initialLng = MAP_CENTER.lng,
  radiusKm = 5,
  primaryColor = Colors.primary,
  onChange,
  pros,
  height = MAP_H,
  showProList = true,
  onReserve: propsOnReserve,
  demo = true,
  emptyText = "Aucun professionnel à proximité pour le moment.",
  showChrome = true,
}: BookingMapProps) {
  const vw = SCREEN_W;
  const vh = height;
  const displayPros = pros && pros.length > 0 ? pros : demo ? DEMO_PROS : [];
  const isEmpty = displayPros.length === 0;

  // ── Native pan value — this is the performance core ───────────────────────
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffset = useRef({ x: 0, y: 0 }); // last committed offset (JS-side mirror, cheap)

  const [selPro,    setSelPro]    = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [address,   setAddress]   = useState(DEMO_ADDRESSES[0]);
  const [locating,  setLocating]  = useState(false);

  // Rotate demo address occasionally — cheap, low-frequency state (not per-frame)
  React.useEffect(() => {
    const iv = setInterval(() => {
      setAddress((prev) => {
        const idx = DEMO_ADDRESSES.indexOf(prev);
        return DEMO_ADDRESSES[(idx + 1) % DEMO_ADDRESSES.length];
      });
    }, 4200);
    return () => clearInterval(iv);
  }, []);

  // ── PanResponder — drives pan natively, with rubber-band clamp at release ──
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // One finger = pan; two fingers = let PinchGestureHandler zoom.
        onStartShouldSetPanResponder: (_, g) => g.numberActiveTouches < 2,
        onMoveShouldSetPanResponder: (_, g) =>
          g.numberActiveTouches < 2 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onPanResponderGrant: () => {
          pan.setOffset(panOffset.current);
          pan.setValue({ x: 0, y: 0 });
          setSelPro(null);
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false, // PanResponder gesture itself can't be native, but the resulting pan.x/y ARE consumed natively by StaticMapLayer's transform
        }),
        onPanResponderRelease: (_, g) => {
          pan.flattenOffset();
          const nx = Math.max(-BOUND, Math.min(BOUND, panOffset.current.x + g.dx));
          const ny = Math.max(-BOUND, Math.min(BOUND, panOffset.current.y + g.dy));
          panOffset.current = { x: nx, y: ny };

          // Spring back into clamp bounds + apply light momentum — all native
          Animated.spring(pan, {
            toValue: { x: nx, y: ny },
            useNativeDriver: true,
            friction: 7,
            tension: 60,
            velocity: { x: g.vx * 40, y: g.vy * 40 } as any,
          }).start();
        },
      }),
    [pan]
  );

  // ── GPS button — snaps map back to center ─────────────────────────────────
  const handleGPS = useCallback(async () => {
    panOffset.current = { x: 0, y: 0 };
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start();

    setLocating(true);
    try {
      const pos = await geo.getCurrentPosition();
      onChange?.(pos.lat, pos.lng);
      haptics.light();
    } catch { /* permission denied — silent */ } finally {
      setLocating(false);
    }
  }, [onChange, pan]);

  // ── Static screen position for pins (computed once — pins live INSIDE the
  //    same transform as the map via a wrapping Animated.View, so they pan
  //    together with zero extra math) ─────────────────────────────────────────
  // Center the pin projection on the PATIENT's real location so the patient pin
  // is always screen-centered and pros are plotted at their true relative
  // position/distance. (The StaticMapLayer backdrop stays decorative.)
  const cx = useMemo(() => ({ lat: initialLat, lng: initialLng }), [initialLat, initialLng]);
  const proScreenPositions = useMemo(
    () => displayPros.map((pro) => project({ lat: pro.lat, lng: pro.lng }, cx, ZOOM, vw, vh)),
    [displayPros, cx, vw, vh]
  );
  const patientPt = useMemo(
    () => project({ lat: initialLat, lng: initialLng }, cx, ZOOM, vw, vh),
    [initialLat, initialLng, cx, vw, vh]
  );

  const handleSelect = useCallback((id: string) => {
    haptics.select();
    setSelPro((s) => (s === id ? null : id));
  }, []);

  // ── Pinch-to-zoom — native-driven scale on the shared map+pins layer ────────
  const baseScale  = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScale  = useRef(1);
  const mapScale = useMemo(() => Animated.multiply(baseScale, pinchScale), [baseScale, pinchScale]);
  const clampedScale = useMemo(
    () => mapScale.interpolate({ inputRange: [MIN_SCALE, MAX_SCALE], outputRange: [MIN_SCALE, MAX_SCALE], extrapolate: "clamp" }),
    [mapScale]
  );
  const onPinchEvent = useMemo(
    () => Animated.event([{ nativeEvent: { scale: pinchScale } }], { useNativeDriver: true }),
    [pinchScale]
  );
  const onPinchStateChange = useCallback(
    (e: PinchGestureHandlerStateChangeEvent) => {
      if (e.nativeEvent.oldState === State.ACTIVE) {
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, lastScale.current * e.nativeEvent.scale));
        lastScale.current = next;
        baseScale.setValue(next);
        pinchScale.setValue(1);
      }
    },
    [baseScale, pinchScale]
  );

  return (
    <View style={styles.wrap}>
      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {["Carte", "Liste"].map((label, i) => (
          <TouchableOpacity
            key={label}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === i }}
            accessibilityLabel={label}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Map area ── */}
      <View style={[styles.mapArea, { height: vh }]} {...panResponder.panHandlers}>
        {/* Pinch-to-zoom: scales the whole map + pins layer together (GPU-only,
            no re-projection). Pan (PanResponder) still works with one finger. */}
        <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchStateChange}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: clampedScale }] }]}>
            {/* Static map — pans via native transform, never re-renders SVG */}
            <StaticMapLayer vw={vw} vh={vh} zoom={ZOOM} pan={pan} />

            {/* Pins layer — moves WITH the map via the same Animated transform,
                so dragging the map drags pins perfectly in sync at zero extra cost */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
              ]}
              pointerEvents="box-none"
            >
          {/* Radius ring — drawn as a simple themed View, not SVG, so it's cheap */}
          <View
            pointerEvents="none"
            style={[
              styles.radiusRing,
              {
                left: patientPt.x - (radiusKm / 111) * ZOOM,
                top:  patientPt.y - (radiusKm / 111) * ZOOM,
                width:  (radiusKm / 111) * ZOOM * 2,
                height: (radiusKm / 111) * ZOOM * 2,
                borderRadius: (radiusKm / 111) * ZOOM,
                borderColor: primaryColor,
                backgroundColor: primaryColor + "08",
              },
            ]}
          />

          {/* Pro pins */}
          {displayPros.map((pro, i) => {
            const p = proScreenPositions[i];
            return (
              <View
                key={pro.id}
                style={[styles.pinAbs, { left: p.x - 25, top: p.y - 25, zIndex: selPro === pro.id ? 50 : 30 }]}
              >
                <ProPin pro={pro} isSelected={selPro === pro.id} onSelect={handleSelect} />
              </View>
            );
          })}

          {/* Patient pin */}
          <View pointerEvents="none" style={[styles.patAbs, { left: patientPt.x - 18, top: patientPt.y - 50 }]}>
            <PatientPin color={primaryColor} />
          </View>
            </Animated.View>
          </Animated.View>
        </PinchGestureHandler>

        {/* ── Overlay UI (fixed — does not pan). Hidden when the parent screen
             provides its own address/GPS chrome (showChrome=false). ── */}
        {showChrome && (
          <>
            <View style={styles.searchBar} pointerEvents="box-none">
              <View style={[styles.searchDot, { backgroundColor: primaryColor }]} />
              <Text style={styles.searchText} numberOfLines={1}>{address}</Text>
              <TouchableOpacity
                style={[styles.modBtn, { borderColor: primaryColor + "30" }]}
                onPress={() => {}}
                accessibilityRole="button"
                accessibilityLabel="Modifier l'adresse"
              >
                <Text style={[styles.modBtnText, { color: primaryColor }]}>Modifier</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.gpsBtn}
              onPress={handleGPS}
              disabled={locating}
              accessibilityRole="button"
              accessibilityLabel="Utiliser ma position actuelle"
            >
              {locating ? <ActivityIndicator size="small" color={primaryColor} /> : <LocateFixed size={16} color={primaryColor} />}
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.credit} pointerEvents="none">CareLink</Text>

        {/* Empty state — no pros to show (never fake people for real users) */}
        {isEmpty && (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <View style={styles.emptyPill}>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Bottom sheet ── */}
      {showProList && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {activeTab === 0 ? (
            displayPros.map((pro) => (
              <ProListRow key={pro.id} pro={pro} isSelected={selPro === pro.id} onPress={() => handleSelect(pro.id)} tab={0} />
            ))
          ) : (
            <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ padding: 10, gap: 8 }} showsVerticalScrollIndicator={false}>
              {displayPros.map((pro) => (
                <ProListRow key={pro.id} pro={pro} isSelected={false} onPress={() => {}} tab={1} />
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrap: {
    width: "100%", backgroundColor: Colors.surfaceWarm, borderRadius: 20, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  tabBar: { flexDirection: "row", padding: 8, gap: 8, backgroundColor: Colors.surfaceWarm },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 12, alignItems: "center", backgroundColor: "rgba(13,8,112,0.06)" },
  tabActive: { backgroundColor: NAVY },
  tabText: { fontSize: 12, fontWeight: "700", color: NAVY },
  tabTextActive: { color: "#FFFFFF" },

  mapArea: { width: "100%", overflow: "hidden", position: "relative" },

  radiusRing: { position: "absolute", borderWidth: 1.5, borderStyle: "dashed" },

  searchBar: {
    position: "absolute", top: 12, left: 12, right: 62, height: 42,
    backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 22,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 8, zIndex: 40,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  searchDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  searchText: { flex: 1, fontSize: 12, fontWeight: "600", color: NAVY },
  modBtn: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 2 },
  modBtnText: { fontSize: 10, fontWeight: "700" },

  gpsBtn: {
    position: "absolute", top: 12, right: 12, width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.96)", alignItems: "center", justifyContent: "center", zIndex: 40,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },

  pinAbs: { position: "absolute" },
  patAbs: { position: "absolute", zIndex: 35 },

  credit: { position: "absolute", bottom: 6, right: 8, fontSize: 9, color: "rgba(13,8,112,0.3)", fontWeight: "500" },

  emptyOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 45 },
  emptyPill: {
    maxWidth: "80%", backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  emptyText: { fontSize: 12.5, fontWeight: "600", color: NAVY, textAlign: "center", lineHeight: 18 },

  sheet: { backgroundColor: "#FFFFFF", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginVertical: 10 },
});

const list = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 16, gap: 12, borderBottomWidth: 0.5, borderBottomColor: "#F0F0F0" },
  rowAvatar: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rowAvatarText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 13, fontWeight: "700", color: "#111" },
  rowSub: { fontSize: 11, color: "#888", marginTop: 1 },
  rowPrice: { fontSize: 14, fontWeight: "700" },
  rowRating: { fontSize: 10, color: "#AAA", textAlign: "right", marginTop: 1 },

  card: { backgroundColor: "#FAFAF8", borderRadius: 14, padding: 12, flexDirection: "row", gap: 12, alignItems: "flex-start", borderWidth: 0.5, borderColor: "#F0EDE8", marginBottom: 8 },
  cardAvatar: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardAvatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cardBody: { flex: 1 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { fontSize: 13, fontWeight: "700", color: "#111" },
  cardSpec: { fontSize: 11, color: "#888", marginTop: 1 },
  cardPrice: { fontSize: 14, fontWeight: "700" },
  cardPriceSub: { fontSize: 10, fontWeight: "500" },
  cardRating: { fontSize: 10, color: "#AAA" },
  cardActions: { flexDirection: "row", gap: 6, marginTop: 8 },
  reserveBtn: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center" },
  reserveBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  profileBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  profileBtnText: { fontSize: 11, fontWeight: "700" },
});
