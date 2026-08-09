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
import { Home, Navigation } from "lucide-react-native";
import { specialtyColor } from "./engine";
import { useReducedMotion } from "@/lib/a11y";
import { useI18n } from "@/lib/i18n";

const NAVY = "#0D0870";
const GREEN = "#22C55E";
const CARD = "#FFFFFF";
const CYAN = "#22D3EE"; // "you are here" accent — matches the live/en-route dot used elsewhere

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
  const { t } = useI18n();
  const accent = driver ? "#0EA5E9" : specialtyColor(pro.specialty);
  const size = driver ? 52 : selected ? 56 : 46;
  const Container: React.ComponentType<any> = onPress ? Pressable : View;

  // Prefer a REAL photo (a bundled source, then the pro's uploaded avatar_url).
  // When a pro genuinely has no photo, fall back to a clean initials chip on the
  // specialty colour — honest and legible — rather than a grey silhouette blob.
  // We never paste a stock face onto a real person's identity.
  const [imgError, setImgError] = useState(false);
  const source: ImageSourcePropType | null =
    !imgError ? pro.avatarSource ?? (pro.avatarUrl ? { uri: pro.avatarUrl } : null) : null;

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
              {pro.priceMad ? `  ·  ${pro.priceMad} ${t("mad")}` : ""}
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

/** "You are here" — bright cyan puck (distinct from the navy destination pin
 *  at a glance) with two offset-phase ripple rings and a white halo so it
 *  reads clearly against both the light and dark map styles. Anchor center.
 *  Optional `heading` (0–360°, from the device compass) swaps the plain dot
 *  for a solid navy arrow that rotates to point exactly the way the viewer
 *  is physically facing — an unambiguous direction indicator, not a subtle
 *  cone. Falls back to the plain dot while no heading is available yet. */
export function MeMarker({ heading }: { heading?: number | null } = {}) {
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
    opacity: val.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.35, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.8] }) }],
  });

  return (
    <View style={styles.meWrap} pointerEvents="none">
      <Animated.View style={[styles.meRing, ringStyle(a)]} />
      <Animated.View style={[styles.meRing, ringStyle(b)]} />
      {heading != null ? (
        // Bold filled arrow (navy body, white outline) so it stays readable on
        // the dark map and the facing direction is unmistakable at a glance.
        <View style={[styles.meArrow, { transform: [{ rotate: `${heading}deg` }] }]}>
          <Navigation size={30} color="#FFFFFF" fill={NAVY} strokeWidth={2} />
        </View>
      ) : (
        <View style={styles.meHalo}>
          <View style={styles.meDot} />
        </View>
      )}
    </View>
  );
}

/** Destination drop-pin — bold navy teardrop with a white flag icon and a
 *  soft ground shadow, so it reads as clearly "planted" at the exact point
 *  rather than floating. Anchor bottom (the tail's point is the real coord). */
export function DestinationPin({ label }: { label?: string } = {}) {
  return (
    <View style={styles.destWrap} pointerEvents="none">
      {/* Ground contact. Without something on the surface the pin reads as
          hovering, especially on a tilted map — this ellipse is what visually
          plants it at the exact coordinate the route ends on. */}
      <View style={styles.destShadow} />
      <View style={styles.destPin}>
        <View style={styles.destInner}>
          <Home size={13} color={NAVY} strokeWidth={2.6} />
        </View>
      </View>
      {/* Tapered stem down to the anchor point, so the route can terminate
          INSIDE the marker rather than stopping beside it. */}
      <View style={styles.destStem} />
      <View style={styles.destTip} />
      {label ? <Text style={styles.destLabel}>{label}</Text> : null}
    </View>
  );
}


const styles = StyleSheet.create({
  // ── Destination pin ───────────────────────────────────────────────────────
  // Anchored at the TIP: the coordinate is the point of the stem, so the route
  // ends inside the marker instead of alongside it.
  destWrap: { alignItems: "center", width: 46 },
  destPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: NAVY,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  destInner: { alignItems: "center", justifyContent: "center" },
  destStem: { width: 3, height: 10, backgroundColor: NAVY, marginTop: -1 },
  destTip: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: NAVY,
    marginTop: -3,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  destShadow: {
    position: "absolute",
    bottom: 0,
    width: 20,
    height: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  destLabel: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "700",
    color: NAVY,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    overflow: "hidden",
  },
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

  /**
   * Sized to CONTAIN the ripple, not just the dot.
   *
   * This box was 34x34 — the size of the marker itself — while `meRing` is a
   * 34x34 FILLED disc that animates up to scale 2.8, i.e. ~95px. Everything
   * past the box edge is clipped to the box's rectangle, and a filled disc
   * clipped to a square IS a square: on the professional's night map that
   * rendered as a solid teal block sitting where the position marker should be.
   *
   * It only bit the "self" marker. `TrackingMarker`, which the patient sees,
   * scales its rings 0.55 -> 1.0 so they never reach the edge, and strokes them
   * (`borderWidth`) instead of filling them — so even at the boundary there is
   * no solid area to clip into a shape.
   *
   * 96 = 34 x 2.8 rounded up, so the largest ripple frame still finishes inside
   * the box. The marker's appearance, colours and animation are unchanged;
   * this only stops the clip. The box is transparent and `pointerEvents="none"`,
   * so a larger one costs nothing.
   */
  meWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  // NO elevation / shadow here. Android renders `elevation` as a shadow of the
  // view's RECTANGULAR bounds — it can't derive the silhouette from an SVG
  // child — so a drop shadow on this wrapper paints a visible grey box behind
  // the arrow. Contrast comes from the arrow's own white stroke instead.
  meArrow: { alignItems: "center", justifyContent: "center" },
  meRing: { position: "absolute", width: 34, height: 34, borderRadius: 17, backgroundColor: CYAN },
  meHalo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  meDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: CYAN,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: CYAN,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },

  destGroundShadow: {
    width: 16,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(13,8,112,0.28)",
    marginTop: 1,
  },
});
