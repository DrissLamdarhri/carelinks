/**
 * CareLink — ProPin & PatientPin
 * Animated profile circles for the map.
 * Direct port of ProPin() and PatientPin() from carelinks_map_enhanced.jsx.
 *
 * ProPin:
 *   • Two pulsing rings (size + opacity driven by animT)
 *   • Float animation (sine wave, vertical)
 *   • Popup card on select (name, spec, dist, stars, price)
 *   • Name chip when deselected
 *   • Green ✓ badge (available) or cyan • (en route)
 *
 * PatientPin:
 *   • Animated outer halo ring
 *   • Teardrop body (rotated square with dot inside)
 *   • Drop shadow stem
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

// ── Patient pin ───────────────────────────────────────────────────────────────
export function PatientPin({ color = NAVY }: { color?: string }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const haloScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const haloOpacity = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, 0.22, 0.08] });

  return (
    <View style={pat.wrap}>
      {/* Outer pulse halo */}
      <Animated.View
        pointerEvents="none"
        style={[
          pat.halo,
          { borderColor: color, transform: [{ scale: haloScale }], opacity: haloOpacity },
        ]}
      />
      {/* Mid disc */}
      <View style={[pat.mid, { backgroundColor: color + "16" }]} />
      {/* Teardrop */}
      <View style={[pat.body, { backgroundColor: color }]}>
        <View style={pat.innerDot} />
      </View>
      {/* Stem */}
      <View style={[pat.stem, { backgroundColor: color }]} />
      <View style={[pat.stemGlow, { backgroundColor: color + "30" }]} />
    </View>
  );
}

const pat = StyleSheet.create({
  wrap: { alignItems: "center", width: 36, height: 54 },
  halo: {
    position: "absolute",
    width: 46, height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    top: -4, left: -5,
  },
  mid: {
    position: "absolute",
    width: 34, height: 34,
    borderRadius: 17,
    top: 1, left: 1,
  },
  body: {
    width: 30, height: 30,
    borderRadius: 15,
    borderBottomRightRadius: 4,
    transform: [{ rotate: "-45deg" }],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: NAVY,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  innerDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },
  stem: { width: 2.5, height: 7, marginTop: -1 },
  stemGlow: { width: 9, height: 3, borderRadius: 2, marginTop: 1 },
});

// ── Pro pin data type ─────────────────────────────────────────────────────────
export type ProPinData = {
  id: string;
  initials: string;
  name: string;           // full: "Fatima Zahra"
  shortName: string;      // "Fatima Z."
  specialty: string;
  distanceKm: number;
  rating: number;
  priceMad?: number;
  avatarUrl?: string | null;
  isEnRoute?: boolean;
  lat: number;
  lng: number;
};

// ── Pro pin ───────────────────────────────────────────────────────────────────
type ProPinProps = {
  pro: ProPinData;
  animT: number;          // global animation time in seconds (from parent)
  isSelected: boolean;
  onSelect: (id: string) => void;
};

export function ProPin({ pro, animT, isSelected, onSelect }: ProPinProps) {
  const color  = specialtyColor(pro.specialty);
  const badge  = pro.isEnRoute ? "cyan" : "green";

  // Pulse ring sizes driven by animT (same formula as JSX reference)
  const phase  = animT * 2 + pro.id.charCodeAt(0) * 0.8;
  const p1size = 66 + Math.sin(phase) * 18;
  const p2size = 54 + Math.sin(phase - 1) * 12;
  const p1op   = (1 - (Math.sin(phase) + 1) / 2) * 0.42;
  const p2op   = (1 - (Math.sin(phase - 1) + 1) / 2) * 0.32;

  // Float: vertical sine drift
  const floatY = Math.sin(animT * 0.8 + pro.id.charCodeAt(0) * 0.7) * 4;

  const handlePress = useCallback(() => onSelect(pro.id), [onSelect, pro.id]);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      style={[pin.wrap, { transform: [{ translateY: floatY }] }]}
    >
      {/* ── Popup card (selected) ── */}
      {isSelected && (
        <View style={[pin.card, { shadowColor: color }]}>
          {/* Avatar */}
          <View style={[pin.cardAvatar, { backgroundColor: color }]}>
            {pro.avatarUrl ? (
              <Image
                source={{ uri: pro.avatarUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <Text style={pin.cardAvatarText}>{pro.initials}</Text>
            )}
          </View>
          {/* Info */}
          <View style={pin.cardInfo}>
            <Text style={pin.cardName} numberOfLines={1}>{pro.shortName}</Text>
            <Text style={pin.cardRole} numberOfLines={1}>
              {pro.specialty} · {pro.distanceKm.toFixed(1)} km
            </Text>
            <Stars rating={pro.rating} />
          </View>
          {/* Tail */}
          <View style={pin.cardTail} />
        </View>
      )}

      {/* ── Avatar circle ── */}
      <View style={pin.circleWrap}>
        {/* Outer pulse ring */}
        <View
          pointerEvents="none"
          style={[
            pin.pulseRing,
            {
              width: p1size,
              height: p1size,
              borderRadius: p1size / 2,
              borderColor: color,
              opacity: p1op,
              top: -(p1size - 50) / 2,
              left: -(p1size - 50) / 2,
            },
          ]}
        />
        {/* Inner pulse ring */}
        <View
          pointerEvents="none"
          style={[
            pin.pulseRing,
            {
              width: p2size,
              height: p2size,
              borderRadius: p2size / 2,
              borderColor: color,
              opacity: p2op,
              top: -(p2size - 50) / 2,
              left: -(p2size - 50) / 2,
            },
          ]}
        />
        {/* Circle */}
        <View
          style={[
            pin.circle,
            {
              backgroundColor: color,
              transform: [{ scale: isSelected ? 1.14 : 1 }],
            },
          ]}
        >
          {pro.avatarUrl ? (
            <Image
              source={{ uri: pro.avatarUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <Text style={pin.circleText}>{pro.initials}</Text>
          )}

          {/* Status badge */}
          <View
            style={[
              pin.badge,
              { backgroundColor: badge === "cyan" ? "#5BB8D4" : GREEN },
            ]}
          >
            {badge === "cyan" ? (
              <View style={pin.badgeDot} />
            ) : (
              <Text style={pin.badgeCheck}>✓</Text>
            )}
          </View>
        </View>
      </View>

      {/* ── Name chip (deselected) ── */}
      {!isSelected && (
        <View style={pin.chip}>
          <View style={[pin.chipDot, { backgroundColor: color }]} />
          <Text style={pin.chipName}>{pro.shortName.split(" ")[0]}</Text>
          <Text style={pin.chipDist}>{pro.distanceKm.toFixed(1)}km</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  stars: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  starText: { color: "#F59E0B", fontSize: 10 },
  ratingNum: { fontSize: 10, fontWeight: "700", color: "#111" },
});

const pin = StyleSheet.create({
  wrap: {
    alignItems: "center",
    // No position:absolute here — parent positions the whole pin
  },

  // Card popup
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 9,
    marginBottom: 6,
    minWidth: 170,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    position: "relative",
  },
  cardAvatar: {
    width: 36, height: 36,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardAvatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 12, fontWeight: "700", color: "#111" },
  cardRole: { fontSize: 10, color: "#888", marginTop: 1 },
  cardTail: {
    position: "absolute",
    bottom: -7,
    left: "50%",
    marginLeft: -7,
    width: 14, height: 8,
    backgroundColor: "#FFFFFF",
    // triangle clip
    transform: [{ skewX: "0deg" }],
    // RN doesn't support clipPath directly — use a rotated square trick
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },

  // Circle
  circleWrap: {
    width: 50, height: 50,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
  circle: {
    width: 50, height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  circleText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  badge: {
    position: "absolute",
    bottom: -1, right: -1,
    width: 16, height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  badgeCheck: { color: "#FFFFFF", fontSize: 8, fontWeight: "800", lineHeight: 9 },

  // Chip
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  chipDot: { width: 5, height: 5, borderRadius: 3 },
  chipName: { fontSize: 10, fontWeight: "700", color: "#111" },
  chipDist: { fontSize: 10, color: "#888" },
});
