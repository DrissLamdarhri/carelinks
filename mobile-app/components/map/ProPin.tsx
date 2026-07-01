/**
 * CareLink — ProPin
 * The floating profile circle that appears on the map for each nearby pro.
 * Matches the screenshot exactly:
 *   • Rounded-square avatar with initials (or photo)
 *   • White card popup with name / specialty / distance / stars
 *   • Pulsing ring animation (Reanimated, with static fallback)
 *   • Status badge (green check = available, cyan dot = en route)
 *   • Tap to select / deselect
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
import { Star } from "lucide-react-native";
import { Colors } from "@/lib/colors";

// ── Specialty → color mapping ────────────────────────────────────────────────
export const SPECIALTY_COLORS: Record<string, string> = {
  nurse:        Colors.primary,      // navy  #0D0870
  infirmier:    Colors.primary,
  infirmière:   Colors.primary,
  kine:         "#065F46",           // deep green
  kiné:         "#065F46",
  physio:       "#065F46",
  psy:          "#5B21B6",           // violet
  psychiatre:   "#5B21B6",
  yoga:         "#0891B2",           // teal-blue
  general:      Colors.accent,       // cyan  #5BB8D4
  default:      Colors.primary,
};

export function specialtyColor(specialty?: string | null): string {
  if (!specialty) return SPECIALTY_COLORS.default;
  const key = specialty.toLowerCase();
  for (const [k, v] of Object.entries(SPECIALTY_COLORS)) {
    if (key.includes(k)) return v;
  }
  return SPECIALTY_COLORS.default;
}

// ── Star row ──────────────────────────────────────────────────────────────────
function StarRow({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={9}
          color="#F59E0B"
          fill={i < full ? "#F59E0B" : "transparent"}
          strokeWidth={1.5}
        />
      ))}
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

// ── Pulse ring (pure Animated — no Reanimated needed) ─────────────────────────
function PulseRing({
  color,
  size,
  delay,
  duration,
}: {
  color: string;
  size: number;
  delay: number;
  duration: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay, duration]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const opacity = anim.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0, 0.55, 0.3, 0],
  });

  const offset = -(size - 48) / 2;

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          top: offset,
          left: offset,
          opacity,
          transform: [{ scale }],
        },
      ]}
      pointerEvents="none"
    />
  );
}

// ── Main ProPin component ─────────────────────────────────────────────────────
export type ProPinData = {
  id: string;
  initials: string;
  name: string;
  specialty: string;         // e.g. "Infirmière", "Kiné", "Psy"
  distanceKm: number;
  rating: number;
  avatarUrl?: string | null;
  isEnRoute?: boolean;       // true → cyan pulse + cyan badge
  priceMad?: number;
};

type ProPinProps = {
  pro: ProPinData;
  isSelected: boolean;
  onPress?: (id: string) => void;
  onSelect?: (id: string) => void;
  animT?: number;
};

export function ProPin({ pro, isSelected, onPress, onSelect }: ProPinProps) {
  const color = specialtyColor(pro.specialty);
  const badgeColor = pro.isEnRoute ? Colors.accent : Colors.success;
  const pulseColor = pro.isEnRoute ? Colors.accent : color;

  // Float animation (idle vertical drift)
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  const handlePress = useCallback(() => {
    if (onSelect) return onSelect(pro.id);
    if (onPress) return onPress(pro.id);
  }, [onSelect, onPress, pro.id]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={styles.touchWrap}
    >
      <Animated.View
        style={[
          styles.pinWrap,
          { transform: [{ translateY: floatAnim }] },
        ]}
      >
        {/* ── Popup card (shows when selected) ──────────────────────── */}
        {isSelected && (
          <View style={[styles.card, { shadowColor: color }]}>
            {/* Avatar inside card */}
            <View style={[styles.cardAvatar, { backgroundColor: color }]}>
              {pro.avatarUrl ? (
                <Image
                  source={{ uri: pro.avatarUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.cardAvatarText}>{pro.initials}</Text>
              )}
            </View>

            {/* Info */}
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>
                {pro.name}
              </Text>
              <Text style={styles.cardRole} numberOfLines={1}>
                {pro.specialty} · {pro.distanceKm.toFixed(1)} km
              </Text>
              <StarRow rating={pro.rating} />
            </View>

            {/* Card tail */}
            <View style={styles.cardTail} />
          </View>
        )}

        {/* ── Avatar circle with pulse rings ────────────────────────── */}
        <View style={styles.avatarWrap}>
          {/* Outer pulse ring */}
          <PulseRing
            color={pulseColor + "55"}
            size={80}
            delay={0}
            duration={2000}
          />
          {/* Inner pulse ring */}
          <PulseRing
            color={pulseColor + "33"}
            size={64}
            delay={400}
            duration={2000}
          />

          {/* Halo background disc */}
          <View
            style={[
              styles.haloDisc,
              {
                backgroundColor: color + "18",
                borderColor: color + "30",
                borderWidth: isSelected ? 2.5 : 1.5,
              },
            ]}
          />

          {/* The avatar itself */}
          <View style={[styles.avatar, { backgroundColor: color }]}>
            {pro.avatarUrl ? (
              <Image
                source={{ uri: pro.avatarUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarText}>{pro.initials}</Text>
            )}

            {/* Status badge */}
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              {pro.isEnRoute ? (
                <View style={styles.badgeDot} />
              ) : (
                <Text style={styles.badgeCheck}>✓</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Name chip below avatar ─────────────────────────────────── */}
        {!isSelected && (
          <View style={styles.chip}>
            <View style={[styles.chipDot, { backgroundColor: color }]} />
            <Text style={styles.chipName} numberOfLines={1}>
              {pro.name.split(" ")[0]}
            </Text>
            <Text style={styles.chipDist}>{pro.distanceKm.toFixed(1)} km</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const AVATAR_SIZE = 48;
const HALO_SIZE   = 56;

const styles = StyleSheet.create({
  touchWrap: {
    alignItems: "center",
  },
  pinWrap: {
    alignItems: "center",
  },

  // ── Popup card ──────────────────────────────────────────────────────────────
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 6,
    minWidth: 190,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardAvatarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  cardInfo: {
    flex: 1,
    gap: 1,
  },
  cardName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  cardRole: {
    fontSize: 11,
    color: "#888780",
    marginTop: 1,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 3,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1A1A1A",
    marginLeft: 2,
  },
  cardTail: {
    position: "absolute",
    bottom: -7,
    left: "50%",
    marginLeft: -8,
    width: 16,
    height: 8,
    backgroundColor: "#FFFFFF",
    // triangle via clip
    transform: [{ rotate: "0deg" }],
  },

  // ── Avatar circle ────────────────────────────────────────────────────────────
  avatarWrap: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
  haloDisc: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  badgeCheck: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 10,
  },

  // ── Name chip ────────────────────────────────────────────────────────────────
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  chipDist: {
    fontSize: 10,
    color: "#888780",
  },
});
