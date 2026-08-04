import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import type { LatLng } from "@/components/map/engine";

/**
 * The device's own position, watched only while the screen needs it.
 *
 * This is for DISPLAY on the local map (showing a pro where they are before
 * they've set off, for instance). It never publishes anything — while a trip
 * is en route, `lib/live-location.ts` owns the GPS and is the sole writer, so
 * callers should pass `enabled: false` for the duration to avoid running two
 * watches against the same sensor.
 */
export function useForegroundPosition(enabled = true): LatLng | null {
  const [position, setPosition] = useState<LatLng | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (!granted || cancelled) return;
      try {
        const sub = await Location.watchPositionAsync(
          // Balanced, not BestForNavigation: nobody is navigating yet, and a
          // constant high-accuracy fix on the "waiting" screen is pure drain.
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 15 },
          (loc) => {
            if (cancelled) return;
            setPosition({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          },
        );
        if (cancelled) {
          sub.remove();
          return;
        }
        subRef.current = sub;
      } catch {
        /* no fix available — callers render their "waiting" state */
      }
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled]);

  return position;
}
