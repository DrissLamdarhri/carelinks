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
 *
 * ── Why there is a "seed" step ──────────────────────────────────────────────
 * `watchPositionAsync` does not call back until the criteria below are met.
 * With Balanced accuracy indoors that first callback can be tens of seconds
 * away, and with `distanceInterval: 15` a pro standing still may get nothing at
 * all after it. On the pro tracking screen that meant `nurse` stayed null, so
 * no route was ever requested — the blue line only appeared once the departure
 * button started the high-accuracy background service. Reported from the field
 * as "the pro has no hint of the route, it only shows up after he taps".
 *
 * A cached last-known fix answers instantly and costs nothing, and a one-shot
 * `getCurrentPositionAsync` covers a device with no cache. Both are superseded
 * by the watch as soon as it produces something real.
 */

/** Only ever prompt once per app launch, whatever mounts/unmounts. */
let promptedThisSession = false;

export type ForegroundPositionOptions = {
  /**
   * Ask for permission if the user has never been asked. A DENIED status is
   * never re-prompted — Android would show nothing and iOS would silently
   * no-op, so all a retry does is add latency. Leave this false on screens
   * where location is incidental.
   */
  request?: boolean;
};

export function useForegroundPosition(
  enabled = true,
  { request = false }: ForegroundPositionOptions = {},
): LatLng | null {
  const [position, setPosition] = useState<LatLng | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    /** Never let a stale seed overwrite a fresher watch callback. */
    let gotLiveFix = false;
    const seed = (p: LatLng) => {
      if (!cancelled && !gotLiveFix) setPosition(p);
    };

    void (async () => {
      let { granted, canAskAgain, status } = await Location.getForegroundPermissionsAsync();
      if (
        !granted &&
        request &&
        !promptedThisSession &&
        canAskAgain &&
        status === Location.PermissionStatus.UNDETERMINED
      ) {
        promptedThisSession = true;
        granted = (await Location.requestForegroundPermissionsAsync()).granted;
      }
      if (!granted || cancelled) return;

      // 1. Cached fix — instant, free, usually within a few hundred metres.
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
        if (last) seed({ lat: last.coords.latitude, lng: last.coords.longitude });
      } catch {
        /* no cache — the one-shot below covers it */
      }

      // 2. One real fix, so a device with an empty cache isn't left blank
      //    while the watch waits for its criteria.
      void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((loc) => seed({ lat: loc.coords.latitude, lng: loc.coords.longitude }))
        .catch(() => {});

      // 3. The ongoing watch.
      try {
        const sub = await Location.watchPositionAsync(
          // Balanced, not BestForNavigation: nobody is navigating yet, and a
          // constant high-accuracy fix on the "waiting" screen is pure drain.
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 15 },
          (loc) => {
            if (cancelled) return;
            gotLiveFix = true;
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
  }, [enabled, request]);

  return position;
}
