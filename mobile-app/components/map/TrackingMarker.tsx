/**
 * CareLink — the production tracking marker.
 * ────────────────────────────────────────────────────────────────────────────
 * The professional, on the map, while a patient waits for them. This is the
 * single most trust-bearing pixel in the product: it is what someone stares at
 * when they are anxious and want to know that help is genuinely coming.
 *
 * Purely presentational — position and bearing arrive as props. `LiveProMarker`
 * is the container that subscribes to the tracking store; keeping that split
 * means the per-frame re-render lands on the smallest possible leaf.
 *
 * HONEST SIGNALLING
 *
 * Every visual element here is load-bearing, and each one is switched off when
 * the thing it claims stops being true:
 *
 *  • The halo PULSES only while the position is genuinely live. A pulsing
 *    marker reads as "this is happening now"; leaving it pulsing over a frozen
 *    position is a small lie told convincingly, and it is exactly the kind of
 *    detail that destroys trust when a patient later realises the nurse had not
 *    moved for four minutes.
 *  • The heading arrow appears only while actually MOVING. A direction
 *    indicator on a stationary marker points somewhere meaningless.
 *  • Colour carries state (live / arrived / stale) and is paired with a shape
 *    change, never colour alone — roughly 1 in 12 men has a colour vision
 *    deficiency, and this is a healthcare product.
 */
import React, { memo, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { Check, Navigation, Pause } from "lucide-react-native";
import { useReducedMotion } from "@/lib/a11y";

const NAVY = "#0D0870";
const CYAN = "#22D3EE";
const GREEN = "#16A34A";
const AMBER = "#F59E0B";
const WHITE = "#FFFFFF";

/**
 * Diameter of the avatar disc.
 *
 * Deliberately small. The first version used 46px in a 96px box, and on a phone
 * that marker DOMINATED the map: it covered several streets, so every metre of
 * movement read as exaggerated and the eye tracked the badge instead of the
 * road. Uber, Bolt and Google Maps all keep the moving marker compact for
 * exactly this reason — the road is the subject, the marker is an annotation on
 * it. A smaller marker glued tightly to the route looks more real than a large
 * one with better maths behind it.
 */
const AVATAR = 28;
// Settled at 28 after 46 / 30 / 38.
//
// The earlier reasoning — "the marker is the hero of the screen" — was wrong.
// The ROAD is the subject; the marker annotates it. Identity already lives in
// the bottom sheet, where someone looks to answer "who is coming", while the
// map answers "where are they". A marker large enough to cover several streets
// makes every metre of movement read as exaggerated and pulls the eye onto the
// badge instead of the route. Every mature ride-hailing map keeps it small for
// this reason.
/** Full marker box — leaves room for the halo and the orbiting heading arrow. */
const BOX = 62;

export type TrackingStatus = "live" | "arrived" | "stale";

export type TrackingMarkerProps = {
  status: TrackingStatus;
  /** Travel heading in degrees; null hides the arrow. */
  bearing?: number | null;
  /** True while genuinely in motion — gates the heading arrow. */
  moving?: boolean;
  avatarUrl?: string | null;
  avatarSource?: ImageSourcePropType;
  /** Fallback when there is no photo. Never a stock face on a real identity. */
  initials?: string;
};

function statusColor(status: TrackingStatus): string {
  return status === "arrived" ? GREEN : status === "stale" ? AMBER : CYAN;
}

export const TrackingMarker = memo(function TrackingMarker({
  status,
  bearing,
  moving = false,
  avatarUrl,
  avatarSource,
  initials = "",
}: TrackingMarkerProps) {
  const reduced = useReducedMotion();
  const accent = statusColor(status);
  // Only a live, moving subject gets a direction indicator.
  const showHeading = status === "live" && moving && bearing != null;

  const [imgFailed, setImgFailed] = useState(false);
  const source: ImageSourcePropType | null = imgFailed
    ? null
    : (avatarSource ?? (avatarUrl ? { uri: avatarUrl } : null));

  // ── Halo ──────────────────────────────────────────────────────────────────
  // Two rings, half a period apart, so the ripple is continuous rather than
  // strobing. `useNativeDriver` keeps the whole animation off the JS thread —
  // it costs nothing per frame even while the marker is being repositioned
  // sixty times a second, which is precisely why a React Native marker can
  // afford this and a rasterised map symbol cannot.
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const pulsing = status === "live" && !reduced;

  useEffect(() => {
    if (!pulsing) {
      ringA.setValue(0);
      ringB.setValue(0);
      return;
    }
    const loop = (v: Animated.Value) =>
      Animated.loop(Animated.timing(v, { toValue: 1, duration: 2400, useNativeDriver: true }));
    const a = loop(ringA);
    a.start();
    const b = loop(ringB);
    const stagger = setTimeout(() => b.start(), 1200);
    return () => {
      a.stop();
      b.stop();
      clearTimeout(stagger);
    };
  }, [pulsing, ringA, ringB]);

  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 0.26, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
  });

  return (
    <View style={styles.box} pointerEvents="none">
      {pulsing ? (
        <>
          <Animated.View style={[styles.ring, { borderColor: accent }, ringStyle(ringA)]} />
          <Animated.View style={[styles.ring, { borderColor: accent }, ringStyle(ringB)]} />
        </>
      ) : null}

      {/* The arrow ORBITS the avatar rather than spinning in place: the rotation
          is applied to a full-size box with the arrow pinned to its top edge,
          so the indicator swings around the professional the way a compass
          needle does, instead of pivoting on their face. */}
      {showHeading ? (
        <View style={[styles.orbit, { transform: [{ rotate: `${bearing}deg` }] }]}>
          <View style={[styles.heading, { backgroundColor: accent }]}>
            <Navigation size={9} color={WHITE} fill={WHITE} strokeWidth={0} />
          </View>
        </View>
      ) : null}

      <View style={[styles.avatarRing, status === "arrived" && { borderColor: GREEN }]}>
        {source ? (
          <Image source={source} style={styles.avatar} onError={() => setImgFailed(true)} />
        ) : (
          <View style={[styles.avatar, styles.initialsWrap]}>
            <Text style={styles.initials}>{initials || "•"}</Text>
          </View>
        )}
      </View>

      {/* Status badge. Shape as well as colour — a plain coloured dot is
          invisible to a red/green colour-deficient viewer. */}
      <View style={[styles.badge, { backgroundColor: accent }]}>
        {status === "arrived" ? (
          <Check size={7} color={WHITE} strokeWidth={4} />
        ) : status === "stale" ? (
          <Pause size={6} color={WHITE} fill={WHITE} strokeWidth={0} />
        ) : (
          <View style={styles.liveDot} />
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  box: { width: BOX, height: BOX, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: BOX,
    height: BOX,
    borderRadius: BOX / 2,
    // Hairline. The halo is a hint that this is live, not a feature competing
    // with the street it sits on.
    borderWidth: 1.5,
  },
  orbit: {
    position: "absolute",
    width: BOX,
    height: BOX,
    alignItems: "center",
  },
  heading: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: WHITE,
    // Nudge so the arrow sits just outside the avatar ring.
    marginTop: (BOX - AVATAR) / 2 - 15,
  },
  avatarRing: {
    width: AVATAR + 5,
    height: AVATAR + 5,
    borderRadius: (AVATAR + 5) / 2,
    borderWidth: 2.5,
    borderColor: WHITE,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    // Deeper, softer shadow. On a tilted map a flat disc reads as a sticker
    // lying on the surface; a real drop shadow lifts it off the street and is
    // most of what makes the marker feel like an object in the scene rather
    // than an annotation drawn over it.
    shadowColor: "#000",
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 14,
  },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: NAVY },
  initialsWrap: { alignItems: "center", justifyContent: "center" },
  initials: { color: WHITE, fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  badge: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.75,
    borderColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    // Bottom-right of the avatar disc, inside the marker box.
    right: (BOX - AVATAR) / 2 - 4,
    bottom: (BOX - AVATAR) / 2 - 1,
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: WHITE },
});
