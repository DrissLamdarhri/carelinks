import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { tr } from "@/lib/i18n";
import {
  onLivePosition,
  startLiveLocation,
  stopLiveLocation,
  type LivePosition,
} from "@/lib/live-location";
import { proStreamTopic } from "@/lib/db/tracking";

type LiveTrackingPayload = LivePosition;

type LiveTrackingChannelProps = {
  bookingId: string;
  mode: "broadcast" | "watch";
  onPosition: (position: LiveTrackingPayload) => void;
  /**
   * Broadcast mode only. Position is published ONLY while this is true (i.e.
   * while the booking is `en_route`). Sharing someone's location outside the
   * window they agreed to is not a feature.
   */
  active?: boolean;
};

/**
 * Bridges one side of a trip to the other.
 *
 *  • `watch`     — the patient. Subscribes to the booking's realtime channel.
 *  • `broadcast` — the pro. Starts the background location task (see
 *                  `lib/live-location.ts`, which owns the GPS and the sending)
 *                  and mirrors each fix back for the pro's own map.
 *
 * This component deliberately does NOT watch GPS itself any more. It used to,
 * which meant tracking died whenever the pro's screen locked.
 */
export function LiveTrackingChannel({
  bookingId,
  mode,
  onPosition,
  active = true,
}: LiveTrackingChannelProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  /** Highest sequence number accepted so far — see the ordering guard below. */
  const lastSeqRef = useRef(0);

  // Keep the latest callback without making it a subscription dependency —
  // an inline arrow from the parent would otherwise tear down and re-establish
  // the channel (or restart the GPS service) on every render.
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  // ── Patient: listen ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "watch" || !bookingId) return;
    // PRIVATE channel. The server evaluates `can_receive_pro_stream()`
    // (migration 0052) at join time: a client that is not the patient or the
    // assigned professional on a live session is refused by Postgres. Knowing
    // the booking UUID is not sufficient, which is the whole point.
    const channel = supabase.channel(proStreamTopic(bookingId), {
      config: { private: true },
    });
    channelRef.current = channel;
    channel.on("broadcast", { event: "position" }, ({ payload }) => {
      const typed = payload as LiveTrackingPayload;
      if (typeof typed?.lat !== "number" || typeof typed?.lng !== "number") return;
      // Realtime does not guarantee ordering. A packet that overtook another
      // must never drag the marker backwards, so anything older than the
      // newest fix already seen is dropped outright.
      const seq = typeof typed.seq === "number" ? typed.seq : null;
      if (seq != null) {
        if (seq <= lastSeqRef.current) return;
        lastSeqRef.current = seq;
      }
      onPositionRef.current(typed);
    });
    void channel.subscribe();
    return () => {
      lastSeqRef.current = 0;
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [bookingId, mode]);

  // ── Pro: publish ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "broadcast" || !bookingId) return;

    if (!active) {
      void stopLiveLocation();
      return;
    }

    let cancelled = false;
    const unsubscribe = onLivePosition((p) => {
      if (!cancelled) onPositionRef.current(p);
    });

    void (async () => {
      const result = await startLiveLocation(bookingId);
      if (cancelled || result.ok) return;
      Alert.alert(
        tr("allow_location_title"),
        result.reason === "permission-denied"
          ? tr("allow_location_broadcast")
          : "Impossible de démarrer le partage de position.",
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      // The trip is over (or this screen closed): stop the service so the
      // foreground notification goes away and we stop draining the battery.
      void stopLiveLocation();
    };
  }, [bookingId, mode, active]);

  return null;
}
