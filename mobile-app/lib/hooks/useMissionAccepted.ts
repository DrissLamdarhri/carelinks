/**
 * Pro side — "votre offre a été acceptée" → open the map, automatically.
 *
 * Why this exists: GPS broadcasting only runs while `/pro/tracking/[bookingId]`
 * is mounted. Before this hook, nothing took the professional there when a
 * patient accepted their bid — every route to that screen was a manual tap. So a
 * patient could pay and then stare at an empty map, and the booking sat in
 * `matched` until the 48h sweeper (migration 0027) settled it. Both symptoms
 * have the same cause: the pro never landed on the tracking screen.
 *
 * Mounted once in `app/pro/_layout.tsx` so it fires from any pro screen.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Booking } from "@/lib/db/types";

export function useMissionAccepted(onAccepted?: (booking: Booking) => void) {
  const router = useRouter();
  const { user } = useAuth();
  // Realtime can redeliver a row; navigating twice for the same mission would
  // stack duplicate tracking screens.
  const handled = useRef<Set<string>>(new Set());
  const cbRef = useRef(onAccepted);
  cbRef.current = onAccepted;

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`missions:pro:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `professional_id=eq.${user.id}`,
        },
        (payload) => {
          const booking = payload.new as Booking;
          if (booking.status !== "matched") return;
          if (handled.current.has(booking.id)) return;
          handled.current.add(booking.id);
          cbRef.current?.(booking);
          // Straight to the map: this both shows the mission and starts the
          // GPS broadcast the patient is waiting on.
          router.push(`/pro/tracking/${encodeURIComponent(booking.id)}`);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, router]);
}
