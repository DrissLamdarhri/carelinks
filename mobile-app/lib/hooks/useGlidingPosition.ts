import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/components/map/engine";

/**
 * Smoothly animates toward a moving target lat/lng instead of snapping the
 * marker on every GPS fix — turns discrete ~2-3s position updates into a
 * continuous glide, the way Uber/InDrive's driver dot moves. Purely a
 * rendering concern: callers should still use the raw target for anything
 * that needs the true current fix (progress matching, deviation checks).
 */
export function useGlidingPosition(target: LatLng | null, durationMs = 1400): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(target);
  const posRef = useRef<LatLng | null>(target);
  const fromRef = useRef<LatLng | null>(target);
  const toRef = useRef<LatLng | null>(target);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!target) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      posRef.current = null;
      setPos(null);
      return;
    }

    fromRef.current = posRef.current ?? target;
    toRef.current = target;
    startRef.current = Date.now();

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - t) * (1 - t); // ease-out — quick start, gentle settle
      const from = fromRef.current!;
      const to = toRef.current!;
      const next = { lat: from.lat + (to.lat - from.lat) * eased, lng: from.lng + (to.lng - from.lng) * eased };
      posRef.current = next;
      setPos(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, durationMs]);

  return pos;
}
