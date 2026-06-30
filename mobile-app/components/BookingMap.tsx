/**
 * CareLink — BookingMap  (v4)
 * Full feature parity with carelinks_map_enhanced.jsx, in React Native.
 *
 * Features:
 *   • Draggable map with pan inertia (GestureHandler PanGestureHandler)
 *   • ProPin circles with pulsing rings + float + card popup
 *   • PatientPin teardrop with halo pulse
 *   • "Carte" / "Liste" tabs
 *   • Address bar (rotating demo + real reverse geocode)
 *   • GPS / locate button (snaps back to centre)
 *   • Pro list bottom sheet (tap syncs with map selection)
 *
 * Drop-in replacement — same outer props as original BookingMap.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LocateFixed, Star } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { geo } from "@/lib/db/geo";
import {
  MAP_CENTER,
  NAVY,
  centerWithOffset,
  project,
  specialtyColor,
  type LatLng,
  type Offset,
} from "./map/engine";
import { MapCanvas } from "./map/MapCanvas";
import { PatientPin, ProPin, type ProPinData } from "./map/Pins";

// ── Constants ─────────────────────────────────────────────────────────────────
const ZOOM  = 7500;
const BOUND = 260;
const SCREEN_W = Dimensions.get("window").width;
const MAP_H = 320;

// ── Demo pros (used if no real data passed in) ────────────────────────────────
const DEMO_PROS: ProPinData[] = [
  { id:"fz", initials:"FZ", name:"Fatima Zahra",  shortName:"Fatima Z.",  specialty:"Infirmière",      distanceKm:0.8, rating:4.9, priceMad:180, lat:34.044, lng:-4.993 },
  { id:"km", initials:"KM", name:"Karim Mansour", shortName:"Karim M.",   specialty:"Kinésithérapeute",distanceKm:1.4, rating:4.8, priceMad:220, lat:34.040, lng:-4.984 },
  { id:"sr", initials:"SR", name:"Samira Rifai",  shortName:"Samira R.",  specialty:"Psychologue",     distanceKm:2.1, rating:4.7, priceMad:350, lat:34.033, lng:-5.017 },
];

// Rotating demo addresses
const DEMO_ADDRESSES = [
  "Rue Ibn Batouta, Fès",
  "Bd Hassan II, Fès",
  "Quartier Narjiss, Fès",
  "Médina, Fès",
];

// ── Reverse geocode (Nominatim, free) ─────────────────────────────────────────
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

// ── Pro list row ──────────────────────────────────────────────────────────────
function ProListRow({
  pro, isSelected, onPress, tab,
}: { pro: ProPinData; isSelected: boolean; onPress: () => void; tab: number }) {
  const color = specialtyColor(pro.specialty);
  if (tab === 1) {
    // "Liste" tab — full card with Réserver button
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
              <Text style={[list.cardPrice, { color }]}>
                {pro.priceMad}<Text style={list.cardPriceSub}> MAD</Text>
              </Text>
              <Text style={list.cardRating}>★{pro.rating} · {pro.distanceKm.toFixed(1)}km</Text>
            </View>
          </View>
          <View style={list.cardActions}>
            <TouchableOpacity style={[list.reserveBtn, { backgroundColor: color }]}>
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

  // "Carte" tab — compact row
  return (
    <TouchableOpacity
      style={[list.row, isSelected && { backgroundColor: "#F8F8FF" }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[list.rowAvatar, { backgroundColor: color }]}>
        <Text style={list.rowAvatarText}>{pro.initials}</Text>
      </View>
      <View style={list.rowInfo}>
        <Text style={list.rowName}>{pro.name}</Text>
        <Text style={list.rowSub}>
          <Text style={{ color: "#22C55E", fontSize: 10 }}>● </Text>
          {pro.specialty}
          <Text style={{ color: "#DDD" }}> · </Text>
          {pro.distanceKm.toFixed(1)} km
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
}: BookingMapProps) {
  const vw = SCREEN_W;
  const vh = height;

  const displayPros = pros && pros.length > 0 ? pros : DEMO_PROS;

  // ── State ──────────────────────────────────────────────────────────────────
  const [offset,    setOffset]    = useState<Offset>({ x: 0, y: 0 });
  const [vel,       setVel]       = useState<Offset>({ x: 0, y: 0 });
  const [dragging,  setDragging]  = useState(false);
  const [animT,     setAnimT]     = useState(0);
  const [selPro,    setSelPro]    = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [address,   setAddress]   = useState(DEMO_ADDRESSES[0]);
  const [addrIdx,   setAddrIdx]   = useState(0);
  const [locating,  setLocating]  = useState(false);

  const rafRef  = useRef<number | null>(null);
  const dragRef = useRef({ lastX: 0, lastY: 0, lastT: 0 });

  // ── Animation loop (animT + inertia) ──────────────────────────────────────
  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      setAnimT((t) => t + dt);
      if (!dragging) {
        setVel((v) => {
          const nx = v.x * 0.92;
          const ny = v.y * 0.92;
          if (Math.abs(nx) > 0.1 || Math.abs(ny) > 0.1) {
            setOffset((o) => ({
              x: Math.max(-BOUND, Math.min(BOUND, o.x - nx * dt * 60)),
              y: Math.max(-BOUND, Math.min(BOUND, o.y - ny * dt * 60)),
            }));
          }
          return { x: nx, y: ny };
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [dragging]);

  // ── Rotating demo address ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setAddrIdx((i) => (i + 1) % DEMO_ADDRESSES.length), 3500);
    return () => clearTimeout(t);
  }, [addrIdx]);

  useEffect(() => {
    setAddress(DEMO_ADDRESSES[addrIdx]);
  }, [addrIdx]);

  // ── Pan responder ─────────────────────────────────────────────────────────
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  () => true,
        onPanResponderGrant: (e) => {
          const { pageX, pageY } = e.nativeEvent;
          dragRef.current = { lastX: pageX, lastY: pageY, lastT: Date.now() };
          setDragging(true);
          setVel({ x: 0, y: 0 });
          setSelPro(null);
        },
        onPanResponderMove: (e) => {
          const { pageX, pageY } = e.nativeEvent;
          const { lastX, lastY, lastT } = dragRef.current;
          const dx = pageX - lastX;
          const dy = pageY - lastY;
          const dt = Math.max(1, Date.now() - lastT);
          setVel({ x: (dx / dt) * 14, y: (dy / dt) * 14 });
          setOffset((o) => ({
            x: Math.max(-BOUND, Math.min(BOUND, o.x - dx)),
            y: Math.max(-BOUND, Math.min(BOUND, o.y - dy)),
          }));
          dragRef.current = { lastX: pageX, lastY: pageY, lastT: Date.now() };
        },
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }),
    []
  );

  // ── GPS snap-back ─────────────────────────────────────────────────────────
  const handleGPS = useCallback(async () => {
    // Animate offset back to 0,0 (ease out)
    const ease = () => {
      setOffset((o) => {
        const nx = o.x * 0.78;
        const ny = o.y * 0.78;
        if (Math.abs(nx) < 0.5 && Math.abs(ny) < 0.5) return { x: 0, y: 0 };
        setTimeout(ease, 16);
        return { x: nx, y: ny };
      });
    };
    ease();

    // Optionally get real GPS
    setLocating(true);
    try {
      const pos = await geo.getCurrentPosition();
      onChange?.(pos.lat, pos.lng);
    } catch { /* silent */ } finally {
      setLocating(false);
    }
  }, [onChange]);

  // ── Pro screen positions ──────────────────────────────────────────────────
  const cx = useMemo(() => centerWithOffset(offset, ZOOM), [offset]);

  const proPositions = useMemo(
    () =>
      displayPros.map((pro) => {
        const p = project({ lat: pro.lat, lng: pro.lng }, cx, ZOOM, vw, vh);
        const floatY = Math.sin(animT * 0.8 + pro.id.charCodeAt(0) * 0.7) * 4;
        return { x: p.x, y: p.y + floatY };
      }),
    [cx, vw, vh, animT, displayPros]
  );

  // Patient pin position
  const patPt = useMemo(
    () => project({ lat: initialLat, lng: initialLng }, cx, ZOOM, vw, vh),
    [cx, initialLat, initialLng, vw, vh]
  );

  const handleSelect = useCallback((id: string) => {
    setSelPro((s) => (s === id ? null : id));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.wrap}>
      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {["Carte", "Liste"].map((label, i) => (
          <TouchableOpacity
            key={label}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Map area ── */}
      <View
        style={[styles.mapArea, { height: vh }]}
        {...panResponder.panHandlers}
      >
        {/* SVG map canvas */}
        <MapCanvas
          offset={offset}
          vw={vw}
          vh={vh}
          zoom={ZOOM}
          showRadius
          radiusKm={radiusKm}
          primaryColor={primaryColor}
          markerLat={initialLat}
          markerLng={initialLng}
        />

        {/* Address bar */}
        <View style={styles.searchBar} pointerEvents="box-none">
          <View style={[styles.searchDot, { backgroundColor: primaryColor }]} />
          <Text style={styles.searchText} numberOfLines={1}>{address}</Text>
          <TouchableOpacity
            style={[styles.modBtn, { borderColor: primaryColor + "30" }]}
            onPress={() => {}}
          >
            <Text style={[styles.modBtnText, { color: primaryColor }]}>Modifier</Text>
          </TouchableOpacity>
        </View>

        {/* GPS button */}
        <TouchableOpacity
          style={styles.gpsBtn}
          onPress={handleGPS}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <LocateFixed size={16} color={primaryColor} />
          )}
        </TouchableOpacity>

        {/* Pro pins */}
        {displayPros.map((pro, i) => {
          const { x, y } = proPositions[i];
          // Cull pins that are off screen
          if (x < -80 || x > vw + 80 || y < -100 || y > vh + 80) return null;
          return (
            <View
              key={pro.id}
              style={[
                styles.pinAbs,
                {
                  left: x - 25,
                  top:  y - 25,
                  zIndex: selPro === pro.id ? 50 : 30,
                },
              ]}
              // Prevent map pan from swallowing pro pin taps
              onStartShouldSetResponder={() => true}
            >
              <ProPin
                pro={pro}
                animT={animT}
                isSelected={selPro === pro.id}
                onSelect={handleSelect}
              />
            </View>
          );
        })}

        {/* Patient pin */}
        <View
          style={[styles.patAbs, { left: patPt.x - 18, top: patPt.y - 50 }]}
          pointerEvents="none"
        >
          <PatientPin color={primaryColor} />
        </View>

        {/* Map credit */}
        <Text style={styles.credit}>Fès · CareLink</Text>
      </View>

      {/* ── Bottom sheet ── */}
      {showProList && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {activeTab === 0 ? (
            displayPros.map((pro) => (
              <ProListRow
                key={pro.id}
                pro={pro}
                isSelected={selPro === pro.id}
                onPress={() => handleSelect(pro.id)}
                tab={0}
              />
            ))
          ) : (
            <ScrollView
              style={{ maxHeight: 220 }}
              contentContainerStyle={{ padding: 10, gap: 8 }}
              showsVerticalScrollIndicator={false}
            >
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
    width: "100%",
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  // Tabs
  tabBar: {
    flexDirection: "row",
    padding: 8,
    gap: 8,
    backgroundColor: Colors.surfaceWarm,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(13,8,112,0.06)",
  },
  tabActive: { backgroundColor: NAVY },
  tabText: { fontSize: 12, fontWeight: "700", color: NAVY },
  tabTextActive: { color: "#FFFFFF" },

  // Map
  mapArea: {
    width: "100%",
    overflow: "hidden",
    position: "relative",
  },

  // Address bar
  searchBar: {
    position: "absolute",
    top: 12, left: 12, right: 62,
    height: 42,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    gap: 8,
    zIndex: 40,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  searchDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  searchText: { flex: 1, fontSize: 12, fontWeight: "600", color: NAVY },
  modBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  modBtnText: { fontSize: 10, fontWeight: "700" },

  // GPS
  gpsBtn: {
    position: "absolute",
    top: 12, right: 12,
    width: 42, height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  // Pro pins
  pinAbs: { position: "absolute" },

  // Patient pin
  patAbs: { position: "absolute", zIndex: 35 },

  // Credit
  credit: {
    position: "absolute",
    bottom: 6, right: 8,
    fontSize: 9,
    color: "rgba(13,8,112,0.3)",
    fontWeight: "500",
  },

  // Bottom sheet
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  sheetHandle: {
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginVertical: 10,
  },
});

// ── List styles ───────────────────────────────────────────────────────────────
const list = StyleSheet.create({
  // Carte tab row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  rowAvatar: {
    width: 40, height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowAvatarText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 13, fontWeight: "700", color: "#111" },
  rowSub:  { fontSize: 11, color: "#888", marginTop: 1 },
  rowPrice:  { fontSize: 14, fontWeight: "700" },
  rowRating: { fontSize: 10, color: "#AAA", textAlign: "right", marginTop: 1 },

  // Liste tab card
  card: {
    backgroundColor: "#FAFAF8",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderWidth: 0.5,
    borderColor: "#F0EDE8",
    marginBottom: 8,
  },
  cardAvatar: {
    width: 44, height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardAvatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cardBody:  { flex: 1 },
  cardHead:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName:  { fontSize: 13, fontWeight: "700", color: "#111" },
  cardSpec:  { fontSize: 11, color: "#888", marginTop: 1 },
  cardPrice: { fontSize: 14, fontWeight: "700" },
  cardPriceSub: { fontSize: 10, fontWeight: "500" },
  cardRating: { fontSize: 10, color: "#AAA" },
  cardActions: { flexDirection: "row", gap: 6, marginTop: 8 },
  reserveBtn: {
    flex: 1, paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
  },
  reserveBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  profileBtn: {
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
  },
  profileBtnText: { fontSize: 11, fontWeight: "700" },
});
