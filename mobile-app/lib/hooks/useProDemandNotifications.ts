/**
 * CareLink — useProDemandNotifications
 *
 * Drop this hook in any professional screen that renders <LiveBookingsFeed />.
 * It does two things:
 *   1. Resolves the authenticated professional's actual specialty from Supabase
 *      (so demands are always filtered to the right profession).
 *   2. Returns an `onNewDemand` callback that fires both a local push notification
 *      and inserts a row into the `notifications` table (for the bell badge)
 *      whenever a new matching booking appears in realtime.
 *
 * Usage:
 *   const { specialty, onNewDemand } = useProDemandNotifications();
 *   <LiveBookingsFeed specialty={specialty ?? "nurse"} onNewDemand={onNewDemand} />
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import {
  scheduleLocalDemandNotification,
  insertProDemandNotification,
} from "@/lib/push-native";
import type { Booking, ProSpecialty } from "@/lib/db/types";

export interface UseProDemandNotificationsResult {
  /** The professional's specialty sourced from their DB profile. Null while loading. */
  specialty: ProSpecialty | null;
  /**
   * Pass this as `onNewDemand` to <LiveBookingsFeed />.
   * Fires an immediate local push + inserts a bell notification row.
   */
  onNewDemand: (booking: Booking) => Promise<void>;
}

export function useProDemandNotifications(): UseProDemandNotificationsResult {
  const { user } = useAuth();
  const [specialty, setSpecialty] = useState<ProSpecialty | null>(null);

  // Fetch the pro's specialty once the user is known.
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    db.pros
      .get(user.id)
      .then((pro) => {
        if (active && pro?.specialty) setSpecialty(pro.specialty);
      })
      .catch((err) =>
        console.warn("[useProDemandNotifications] failed to fetch specialty:", err)
      );

    return () => {
      active = false;
    };
  }, [user?.id]);

  /**
   * Called by <LiveBookingsFeed> (via useOpenBookingsBySpecialty) each time a
   * new open booking matching the pro's specialty arrives via Supabase realtime.
   */
  const onNewDemand = useCallback(
    async (booking: Booking) => {
      if (!user?.id) return;

      // 1. Immediate local push — visible while app is in foreground.
      await scheduleLocalDemandNotification(booking.specialty);

      // 2. Persistent bell row — shows in NotificationBell even after the
      //    foreground alert is dismissed or the user reopens the app later.
      await insertProDemandNotification(user.id, booking.id, booking.specialty);
    },
    [user?.id]
  );

  return { specialty, onNewDemand };
}