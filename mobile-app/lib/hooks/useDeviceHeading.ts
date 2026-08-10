import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

/**
 * Live compass heading (0–360°, 0 = true north) for orienting the "you are
 * here" marker — same idea as Google Maps / Uber's directional blue-dot cone,
 * so the viewer can tell which way they're physically facing on the map.
 * Falls back to magnetic north when true-north isn't available (no location
 * fix yet) rather than reporting nothing.
 */
export function useDeviceHeading(enabled = true): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED || cancelled) return;
      const sub = await Location.watchHeadingAsync((h) => {
        if (cancelled) return;
        const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        setHeading(deg);
      });
      if (cancelled) {
        sub.remove();
        return;
      }
      subRef.current = sub;
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled]);

  return heading;
}
