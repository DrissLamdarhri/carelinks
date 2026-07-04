import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * True when the OS "Reduce Motion" accessibility setting is on.
 * Gate `Animated.loop` / decorative animations with this (directive 8).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setReduced(v));
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
