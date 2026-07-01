/**
 * Hook for managing booking notifications
 * Integrates with the admin notification system
 */

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Booking } from "@/lib/db/types";
import { notifyAdminNewBooking, notifyAdminBookingStatusChange } from "@/lib/admin/booking-notifications";

/**
 * Hook to listen for booking changes and notify admin
 * Usage: useBookingNotifications(bookingId, userId)
 */
export function useBookingNotifications(bookingId: string | null, userId: string | null) {
  useEffect(() => {
    if (!bookingId || !userId) return;

    // Subscribe to booking changes (supabase realtime v2 typing differs from older API)
    const subscription = (supabase as any)
      .from(`bookings:id=eq.${bookingId}`)
      .on("*", (payload: any) => {
        const booking = payload.new as Booking;

        if (payload.eventType === "INSERT") {
          // Nouvelle réservation créée
          notifyAdminNewBooking(booking);
        } else if (payload.eventType === "UPDATE") {
          // Réservation mise à jour
          const oldBooking = payload.old as Booking;
          if (oldBooking.status !== booking.status) {
            notifyAdminBookingStatusChange(booking, oldBooking.status);
          }
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [bookingId, userId]);
}

/**
 * Helper function to trigger a booking notification manually
 */
export async function triggerBookingNotification(booking: Booking, type: "create" | "update", previousStatus?: string) {
  if (type === "create") {
    await notifyAdminNewBooking(booking);
  } else if (type === "update" && previousStatus) {
    await notifyAdminBookingStatusChange(booking, previousStatus);
  }
}

/**
 * Hook to listen for admin booking notifications
 */
export function useAdminBookingNotifications(onNotification: (payload: Record<string, unknown>) => void) {
  useEffect(() => {
    const subscription = supabase
      .realtime.channel("admin-notifications")
      .on("broadcast", { event: "booking_event" }, (message) => {
        onNotification(message.payload);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [onNotification]);
}
