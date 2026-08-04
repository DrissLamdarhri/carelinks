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
const AVATAR = 30;
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
    opacity: v.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 0.22, 0] }),
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
            <Navigation size={10} color={WHITE} fill={WHITE} strokeWidth={0} />
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
          <Check size={8} color={WHITE} strokeWidth={4} />
        ) : status === "stale" ? (
          <Pause size={7} color={WHITE} fill={WHITE} strokeWidth={0} />
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
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: WHITE,
    // Nudge so the arrow sits just outside the avatar ring.
    marginTop: (BOX - AVATAR) / 2 - 17,
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
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: NAVY },
  initialsWrap: { alignItems: "center", justifyContent: "center" },
  initials: { color: WHITE, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  badge: {
    position: "absolute",
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    borderColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    // Bottom-right of the avatar disc, inside the marker box.
    right: (BOX - AVATAR) / 2 - 5,
    bottom: (BOX - AVATAR) / 2 - 2,
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: WHITE },
});
