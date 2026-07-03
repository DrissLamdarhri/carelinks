/**
 * CareLink — Pins (v2, native-driven)
 * ────────────────────────────────────────────────────────────────────────────
 * THE FIX: the old ProPin computed pulse-ring size/opacity from a React
 * state variable (`animT`) passed down as a prop — meaning every parent
 * re-render (60×/sec) re-rendered every pin too.
 *
 * Now: each pin owns its own `Animated.Value` loops, started once in
 * useEffect, running entirely on the native thread (`useNativeDriver: true`).
 * The JS thread is never touched after mount. Pulse, float, and halo are
 * all native animations — this is what makes 10+ pins feel buttery smooth.
 */

import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GREEN, NAVY, specialtyColor } from "./engine";

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <View style={ss.stars}>
      <Text style={ss.starText}>{"★".repeat(full)}</Text>
      <Text style={ss.ratingNum}>{rating.toFixed(1)}</Text>
    </View>
  );
}

// ── Patient pin (native-driven halo pulse) ────────────────────────────────────
export function PatientPin({ color = NAVY, label = "Vous" }: { color?: string, label?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.32] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.14, 0.24, 0.08] });

  return (
    <View style={pat.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[pat.halo, { borderColor: color, transform: [{ scale: haloScale }], opacity: haloOpacity }]}
      />

      {label ? (
       <View style={pat.labelWrap} pointerEvents="none">
         <View style={[pat.labelPill, { backgroundColor: "#FFFFFF" }]}>
           <Text style={pat.labelText}>{label}</Text>
         </View>
       </View>
      ) : null}

      <View style={[pat.mid, { backgroundColor: color + "16" }]} />
      <View style={[pat.body, { backgroundColor: color }]}>
        <View style={pat.innerDot} />
      </View>
      <View style={[pat.stem, { backgroundColor: color }]} />
      <View style={[pat.stemGlow, { backgroundColor: color + "30" }]} />
    </View>
  );
}

const pat = StyleSheet.create({
  wrap: { alignItems: "center", width: 36, height: 54 },
  halo: { position: "absolute", width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, top: -4, left: -5 },
  labelWrap: { position: "absolute", top: -26, width: 80, alignItems: "center" },
  labelPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  labelText: { fontSize: 10, fontWeight: "700", color: "#111" },
  mid: { position: "absolute", width: 34, height: 34, borderRadius: 17, top: 1, left: 1 },
  body: {
    width: 30, height: 30, borderRadius: 15, borderBottomRightRadius: 4,
    transform: [{ rotate: "-45deg" }], alignItems: "center", justifyContent: "center",
    borderWidth: 2.5, borderColor: "#FFFFFF",
    shadowColor: NAVY, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  innerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF", transform: [{ rotate: "45deg" }] },
  stem: { width: 2.5, height: 7, marginTop: -1 },
  stemGlow: { width: 9, height: 3, borderRadius: 2, marginTop: 1 },
});

// ── Pro pin data type ─────────────────────────────────────────────────────────
export type ProPinData = {
  id: string;
  initials: string;
  name: string;
  shortName: string;
  specialty: string;
  distanceKm: number;
  rating: number;
  priceMad?: number;
  avatarUrl?: string | null;
  isEnRoute?: boolean;
  lat: number;
  lng: number;
};

// ── Single native pulse ring (self-contained, mounts once, never re-renders) ─
function PulseRing({ color, baseSize, delay }: { color: string; baseSize: number; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 1900, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);

  const scale   = v.interpolate({ inputRange: [0, 1], outputRange: [0.58, 1.35] });
  const opacity = v.interpolate({ inputRange: [0, 0.25, 0.7, 1], outputRange: [0, 0.4, 0.16, 0] });
  const offset  = -(baseSize - 50) / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        pin.pulseRing,
        {
          width: baseSize, height: baseSize, borderRadius: baseSize / 2,
          borderColor: color, top: offset, left: offset,
          opacity, transform: [{ scale }],
        },
      ]}
    />
  );
}

// ── Pro pin (native float + native pulse rings) ───────────────────────────────
type ProPinProps = {
  pro: ProPinData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  animT?: number;
};

export const ProPin = React.memo(function ProPin({ pro, isSelected, onSelect }: ProPinProps) {
  const color = specialtyColor(pro.specialty);
  const badge = pro.isEnRoute ? "cyan" : "green";

  // Native float — own loop, runs forever on native thread, zero JS cost after mount
  const floatV = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const phaseDelay = (pro.id.charCodeAt(0) % 5) * 120;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(phaseDelay),
        Animated.timing(floatV, { toValue: -5, duration: 1700, useNativeDriver: true }),
        Animated.timing(floatV, { toValue: 0,  duration: 1700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatV, pro.id]);

  // Selection scale — native too
  const scaleV = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(scaleV, {
      toValue: isSelected ? 1.14 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
  }, [isSelected, scaleV]);

  const handlePress = useCallback(() => onSelect(pro.id), [onSelect, pro.id]);

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={handlePress} style={pin.wrap}>
      <Animated.View style={{ transform: [{ translateY: floatV }] }}>
        {/* ── Popup card ── */}
        {isSelected && (
          <View style={[pin.card, { shadowColor: color }]}>
            <View style={[pin.cardAvatar, { backgroundColor: color }]}>
              {pro.avatarUrl ? (
                <Image source={{ uri: pro.avatarUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Text style={pin.cardAvatarText}>{pro.initials}</Text>
              )}
            </View>
            <View style={pin.cardInfo}>
              <Text style={pin.cardName} numberOfLines={1}>{pro.shortName}</Text>
              <Text style={pin.cardRole} numberOfLines={1}>{pro.specialty} · {pro.distanceKm.toFixed(1)} km</Text>
              <Stars rating={pro.rating} />
            </View>
            <View style={pin.cardTail} />
          </View>
        )}

        {/* ── Avatar circle ── */}
        <View style={pin.circleWrap}>
          <PulseRing color={color + "70"} baseSize={66} delay={0} />
          <PulseRing color={color + "50"} baseSize={66} delay={650} />

          <Animated.View style={[pin.circle, { backgroundColor: color + "22", transform: [{ scale: scaleV }] }]}>
            <View style={pin.avatarInner}>
              {pro.avatarUrl ? (
                <Image source={{ uri: pro.avatarUrl }} style={pin.avatarImg} resizeMode="cover" />
              ) : (
                <Text style={pin.circleText}>{pro.initials}</Text>
              )}
            </View>

            {/* Purple rim when en-route (visual emphasis for tracking) */}
            {pro.isEnRoute ? <View style={pin.avatarRim} pointerEvents="none" /> : null}

            <View style={[pin.badge, { backgroundColor: badge === "cyan" ? "#5BB8D4" : GREEN }]}>
              {badge === "cyan" ? <View style={pin.badgeDot} /> : <Text style={pin.badgeCheck}>✓</Text>}
            </View>
          </Animated.View>
        </View>

        {/* ── Name chip ── */}
        {!isSelected && (
          <View style={pin.chip}>
            <View style={[pin.chipDot, { backgroundColor: color }]} />
            <Text style={pin.chipName}>{pro.shortName.split(" ")[0]}</Text>
            <Text style={pin.chipDist}>{pro.distanceKm.toFixed(1)}km</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  stars: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  starText: { color: "#F59E0B", fontSize: 10 },
  ratingNum: { fontSize: 10, fontWeight: "700", color: "#111" },
});

const pin = StyleSheet.create({
  wrap: { alignItems: "center" },

  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF",
    borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, gap: 9,
    marginBottom: 6, minWidth: 170,
    shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    position: "relative",
  },
  cardAvatar: { width: 36, height: 36, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardAvatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 12, fontWeight: "700", color: "#111" },
  cardRole: { fontSize: 10, color: "#888", marginTop: 1 },
  cardTail: {
    position: "absolute", bottom: -7, left: "50%", marginLeft: -7,
    width: 14, height: 8, backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
  },

  circleWrap: { width: 50, height: 50, alignItems: "center", justifyContent: "center", position: "relative" },
  pulseRing: { position: "absolute", borderWidth: 1.5 },
  circle: {
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
    // subtle outer rim (handled by avatarInner), keep light bg for degraded cases
    borderWidth: 0, overflow: "visible",
    shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  avatarInner: {
    width: 48, height: 48, borderRadius: 24, overflow: "hidden",
    borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
    backgroundColor: "#F0F0F0",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarRim: { position: "absolute", width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: "#6B46C1", top: -1, left: -1 },
  circleText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", backgroundColor: "transparent" },

  badge: {
    position: "absolute", bottom: -1, right: -1, width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  badgeCheck: { color: "#FFFFFF", fontSize: 8, fontWeight: "800", lineHeight: 9 },

  chip: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 5,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  chipDot: { width: 5, height: 5, borderRadius: 3 },
  chipName: { fontSize: 10, fontWeight: "700", color: "#111" },
  chipDist: { fontSize: 10, color: "#888" },
});
