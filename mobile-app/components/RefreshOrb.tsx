/**
 * CareLink — the refresh control.
 *
 * A four-state affordance — idle → loading → success → idle — rather than a
 * button that swaps itself for a platform spinner. The reason is that a generic
 * `ActivityIndicator` tells you something is happening but not WHAT, and on a
 * map it appears in a place the button was not, so the eye has to find it
 * again. Here the control stays exactly where it was and changes state in
 * place, which is what makes the interaction readable.
 *
 * Three timing decisions, all about honesty rather than decoration:
 *
 *  • `MIN_SPIN_MS` — a refresh that resolves in 80ms would otherwise flash and
 *    read as a glitch or as nothing at all. Holding the spin briefly is what
 *    makes a fast refresh legible as a refresh.
 *  • `SUCCESS_MS` — the tick is shown long enough to be seen and no longer. It
 *    is a confirmation, not a state to live in.
 *  • A failure returns straight to idle without a tick. Claiming success for a
 *    request that failed is the one thing this component must never do; the
 *    caller surfaces the error, this just declines to lie about it.
 *
 * Colour comes from the caller so each surface keeps its own identity — navy on
 * patient screens, purple on the psychologist map — and defaults to the brand
 * primary. Animation is native-driver only (transform/opacity), so the loop
 * runs off the JS thread and does not compete with map rendering.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, RefreshCw } from "lucide-react-native";
import { Colors, Shadows } from "@/lib/colors";
import { useReducedMotion } from "@/lib/a11y";

export type RefreshState = "idle" | "loading" | "success";

const MIN_SPIN_MS = 520;
const SUCCESS_MS = 520;

export type RefreshOrbProps = {
  /** The work to run. Rejecting returns to idle WITHOUT the success tick. */
  onRefresh: () => Promise<unknown> | unknown;
  /** Brand colour for this surface. Defaults to CareLink navy. */
  accent?: string;
  /** Darker partner for the fill gradient. Derived-ish default suits navy. */
  accentDark?: string;
  size?: number;
  /** Accessibility label — pass t("refresh"). */
  label?: string;
  /** Lets the host show its own "updating…" copy alongside. */
  onStateChange?: (state: RefreshState) => void;
  style?: StyleProp<ViewStyle>;
};

export function RefreshOrb({
  onRefresh,
  accent = Colors.primary,
  accentDark = Colors.primaryDark,
  size = 52,
  label,
  onStateChange,
  style,
}: RefreshOrbProps) {
  const reduced = useReducedMotion();
  const [state, setState] = useState<RefreshState>("idle");

  const spin = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  // Report upward without making the parent a dependency of the effect below.
  const notify = useRef(onStateChange);
  notify.current = onStateChange;
  useEffect(() => { notify.current?.(state); }, [state]);

  // ── The spin + halo loop, running only while loading ──────────────────────
  useEffect(() => {
    if (state !== "loading" || reduced) return;
    spin.setValue(0);
    const rotate = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(halo, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    rotate.start();
    pulse.start();
    return () => {
      rotate.stop();
      pulse.stop();
      halo.setValue(0);
    };
  }, [state, reduced, spin, halo]);

  const run = useCallback(async () => {
    if (state !== "idle") return; // a second tap mid-refresh is not a refresh
    setState("loading");
    const startedAt = Date.now();
    let ok = true;
    try {
      await onRefresh();
    } catch {
      ok = false;
    }
    // Hold the spin long enough to be seen, then confirm.
    const remaining = MIN_SPIN_MS - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    if (!ok) {
      setState("idle");
      return;
    }
    setState("success");
    setTimeout(() => setState("idle"), SUCCESS_MS);
  }, [state, onRefresh]);

  const filled = state !== "idle";
  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Pressable
      onPress={run}
      disabled={state !== "idle"}
      onPressIn={() => Animated.spring(press, { toValue: 0.92, useNativeDriver: true, friction: 7 }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 5 }).start()}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: state === "loading" }}
      // Generous padding: the halo is drawn outside the button and would be
      // clipped to the pressable's own box without it.
      style={[s.wrap, { padding: size * 0.22 }, style]}
    >
      <Animated.View style={{ transform: [{ scale: press }] }}>
        {/* Soft bloom while working — the "something is happening here" glow. */}
        {state === "loading" ? (
          <Animated.View
            pointerEvents="none"
            style={[
              s.halo,
              {
                width: size, height: size, borderRadius: size / 2, backgroundColor: accent,
                opacity: halo.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.22, 0] }),
                transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
              },
            ]}
          />
        ) : null}

        {/* The travelling arc. A ring with three transparent sides reads as an
            arc without pulling in an SVG just to draw a stroke. */}
        {state === "loading" ? (
          <Animated.View
            pointerEvents="none"
            style={[
              s.arc,
              {
                width: size + 10, height: size + 10, borderRadius: (size + 10) / 2,
                top: -5, left: -5, borderColor: "transparent", borderTopColor: accent,
                transform: [{ rotate: rotation }],
              },
            ]}
          />
        ) : null}

        <View style={[s.orb, { width: size, height: size, borderRadius: size / 2 }]}>
          {filled ? (
            <LinearGradient
              colors={[accent, accentDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
            />
          ) : null}

          {state === "success" ? (
            <Check size={size * 0.42} color="#FFFFFF" strokeWidth={3.2} />
          ) : state === "loading" ? (
            <Animated.View style={{ transform: [{ rotate: rotation }] }}>
              <RefreshCw size={size * 0.42} color="#FFFFFF" strokeWidth={2.6} />
            </Animated.View>
          ) : (
            <RefreshCw size={size * 0.42} color={accent} strokeWidth={2.6} />
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * The companion caption. Separate from the orb because it belongs to the
 * surface being refreshed — on a map it sits over the map, not over the button.
 */
export function RefreshingPill({
  text,
  accent = Colors.primary,
  accentDark = Colors.primaryDark,
  visible,
  style,
}: {
  text: string;
  accent?: string;
  accentDark?: string;
  visible: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(v, {
      toValue: visible ? 1 : 0,
      duration: reduced ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, v, reduced]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.pillWrap,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] },
        style,
      ]}
    >
      <LinearGradient
        colors={[accent, accentDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.pill}
      >
        <Sparkle />
        <Text style={s.pillTxt}>{text}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

/** Small twinkle, so the pill reads as activity rather than a static badge. */
function Sparkle() {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, reduced]);
  return (
    <Animated.View
      style={{
        opacity: reduced ? 0.9 : v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
      }}
    >
      <RefreshCw size={12} color="#FFFFFF" strokeWidth={2.8} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute" },
  arc: { position: "absolute", borderWidth: 3 },
  orb: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    ...Shadows.md,
  },
  pillWrap: { alignSelf: "flex-start" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    ...Shadows.md,
  },
  pillTxt: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
});
