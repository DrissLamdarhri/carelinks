/**
 * CareLink — premium map markers (real MapLibre map + SVG fallback).
 * Modern circular profile-photo pins (Bolt/Uber-grade) with driver heading,
 * spring-in popup, a dual-ring "you" location marker, and a destination pin.
 * Brand palette (navy / cream / cyan). Real RN views → photos + animations work.
 * All looping animations honour Reduce Motion and use the native driver.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { Flag } from "lucide-react-native";
import { specialtyColor } from "./engine";
import { DEFAULT_AVATAR } from "@/lib/colors";
import { useReducedMotion } from "@/lib/a11y";

const NAVY = "#0D0870";
const GREEN = "#22C55E";
const CARD = "#FFFFFF";

export type ProMarkerInfo = {
  /** Local (require'd) image — preferred, always renders. */
  avatarSource?: ImageSourcePropType;
  /** Remote URL fallback. */
  avatarUrl?: string | null;
  initials: string;
  specialty?: string;
  name?: string;
  rating?: number;
  distanceKm?: number;
  priceMad?: number;
};

/** Circular profile-photo marker with soft shadow, brand ring, online dot, and
 *  (driver mode) a heading triangle + spring-in info card. */
export function ProAvatarMarker({
  pro,
  selected = false,
  driver = false,
  bearing = 0,
  onPress,
}: {
  pro: ProMarkerInfo;
  selected?: boolean;
  driver?: boolean;
  /** Travel heading in degrees (driver mode) — rotates the pointer. */
  bearing?: number;
  onPress?: () => void;
}) {
  const accent = driver ? "#0EA5E9" : specialtyColor(pro.specialty);
  const size = driver ? 52 : selected ? 56 : 46;
  const Container: React.ComponentType<any> = onPress ? Pressable : View;

  // Always resolve to an image — a default portrait for profiles with no photo yet.
  const [imgError, setImgError] = useState(false);
  const source: ImageSourcePropType = !imgError
    ? pro.avatarSource ?? (pro.avatarUrl ? { uri: pro.avatarUrl } : DEFAULT_AVATAR)
    : DEFAULT_AVATAR;

  // Spring-in / spring-out popup card
  const [cardMounted, setCardMounted] = useState(selected);
  const cardScale = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (selected) {
      setCardMounted(true);
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }).start();
    } else {
      Animated.spring(cardScale, { toValue: 0, useNativeDriver: true, friction: 7, tension: 110 }).start(
        ({ finished }) => {
          if (finished) setCardMounted(false);
        },
      );
    }
  }, [selected, cardScale]);

  const hasCardContent = !!(pro.name || pro.rating != null);

  return (
    <Container style={styles.wrap} onPress={onPress} pointerEvents={onPress ? "auto" : "none"}>
      {cardMounted && hasCardContent ? (
        <Animated.View
          style={[
            styles.cardHolder,
            { opacity: cardScale, transform: [{ scale: cardScale }] },
          ]}
          pointerEvents="none"
        >
          <View style={styles.card}>
            {pro.name ? (
              <Text style={styles.cardName} numberOfLines={1}>
                {pro.name}
              </Text>
            ) : null}
            <Text style={styles.cardMeta} numberOfLines={1}>
              {pro.rating != null ? `★ ${pro.rating.toFixed(1)}` : ""}
              {pro.distanceKm != null ? `  ·  ${pro.distanceKm.toFixed(1)} km` : ""}
              {pro.priceMad ? `  ·  ${pro.priceMad} MAD` : ""}
            </Text>
            <View style={styles.cardTail} />
          </View>
        </Animated.View>
      ) : null}

      <View style={[styles.shadow, { width: size, height: size, borderRadius: size / 2 }]}>
        {/* driver: rotating pointer around the circle + soft active pulse */}
        {driver ? (
          <>
            <DriverPulse size={size} color={accent} />
            <View
              pointerEvents="none"
              style={[
                styles.headingLayer,
                { width: size + 24, height: size + 24, top: -12, left: -12, transform: [{ rotate: `${bearing}deg` }] },
              ]}
            >
              <View style={[styles.headingTri, { borderTopColor: accent }]} />
            </View>
          </>
        ) : null}

        <View
          style={[
            styles.avatar,
            { width: size, height: size, borderRadius: size / 2, borderColor: "#FFFFFF" },
          ]}
        >
          {source ? (
            <Image
              source={source}
              style={{ width: size, height: size }}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={[styles.fallback, { backgroundColor: accent }]}>
              <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{pro.initials}</Text>
            </View>
          )}
          <View
            pointerEvents="none"
            style={[styles.accentRing, { width: size, height: size, borderRadius: size / 2, borderColor: accent }]}
          />
          <View style={[styles.badge, { backgroundColor: driver ? "#0EA5E9" : GREEN }]} />
        </View>
      </View>
    </Container>
  );
}

/** Soft pulsing ring behind the moving driver — reads as "active / en route". */
function DriverPulse({ size, color }: { size: number; color: string }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, reduced]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.9] });
  const opacity = v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.28, 0] });
  const d = size + 8;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: d,
        height: d,
        borderRadius: d / 2,
        top: -4,
        left: -4,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

/** "You are here" — solid navy dot with two offset-phase ripple rings. */
export function MeMarker() {
  const reduced = useReducedMotion();
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const make = (val: Animated.Value) =>
      Animated.loop(Animated.timing(val, { toValue: 1, duration: 2200, useNativeDriver: true }));
    const la = make(a);
    la.start();
    const lb = make(b);
    const t = setTimeout(() => lb.start(), 1100); // half-phase offset → continuous ripple
    return () => {
      la.stop();
      lb.stop();
      clearTimeout(t);
    };
  }, [a, b, reduced]);

  const ringStyle = (val: Animated.Value) => ({
    opacity: val.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.32, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.7] }) }],
  });

  return (
    <View style={styles.meWrap} pointerEvents="none">
      <Animated.View style={[styles.meRing, ringStyle(a)]} />
      <Animated.View style={[styles.meRing, ringStyle(b)]} />
      <View style={styles.meDot} />
    </View>
  );
}

/** Destination drop-pin — white teardrop head with a navy flag icon. Anchor bottom. */
export function DestinationPin() {
  return (
    <View style={styles.destWrap} pointerEvents="none">
      <View style={styles.destHead}>
        <Flag size={15} color={NAVY} fill={NAVY} />
      </View>
      <View style={styles.destTail} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "flex-end" },

  cardHolder: { position: "absolute", bottom: "100%", marginBottom: 8, alignItems: "center" },

  // Transparent group — NO background box / elevation. The circle's own white
  // border + a soft iOS shadow give it depth without a square behind it.
  shadow: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: NAVY,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  avatar: {
    borderWidth: 3,
    overflow: "hidden",
    backgroundColor: "#E9E7F2",
    alignItems: "center",
    justifyContent: "center",
  },
  accentRing: { position: "absolute", top: -3, left: -3, borderWidth: 2 },
  fallback: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  initials: { color: "#FFFFFF", fontWeight: "800", letterSpacing: 0.3 },
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  headingLayer: { position: "absolute", alignItems: "center", justifyContent: "flex-end" },
  headingTri: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    maxWidth: 200,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  cardName: { fontSize: 13, fontWeight: "800", color: NAVY },
  cardMeta: { fontSize: 11, fontWeight: "600", color: "#6B6B7B", marginTop: 1 },
  cardTail: {
    position: "absolute",
    bottom: -5,
    width: 12,
    height: 12,
    backgroundColor: CARD,
    transform: [{ rotate: "45deg" }],
  },

  meWrap: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  meRing: { position: "absolute", width: 26, height: 26, borderRadius: 13, backgroundColor: NAVY },
  meDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: NAVY,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: NAVY,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },

  destWrap: { alignItems: "center", justifyContent: "flex-end" },
  destHead: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 2.5,
    borderColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: NAVY,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  destTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: NAVY,
    marginTop: -1,
  },
});
