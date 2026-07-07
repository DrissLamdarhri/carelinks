/**
 * Admin Booking Notifications System
 * Gère les notifications et l'enregistrement des réservations pour le panel admin
 */

import type { Booking } from "@/lib/db/types";
import { supabase, SUPABASE_URL } from "@/lib/supabase";

export interface AdminBookingLog {
  id: string;
  booking_id: string;
  patient_id: string;
  professional_id: string | null;
  specialty: string;
  status: string;
  urgency: string;
  scheduled_at: string | null;
  address: string | null;
  price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  notification_sent_at: string | null;
  is_psychologist: boolean;
  alert_level: "normal" | "high" | "critical";
}

/**
 * Envoie une notification de réservation au panel admin
 */
export async function notifyAdminNewBooking(booking: Booking): Promise<void> {
  try {
    const isPsychologist = booking.specialty === "psychologist";
    const isUrgent = booking.urgency === "urgent" || booking.urgency === "emergency";
    
    let alertLevel: "normal" | "high" | "critical" = "normal";
    if (isPsychologist && isUrgent) {
      alertLevel = "critical";
    } else if (isPsychologist || isUrgent) {
      alertLevel = "high";
    }

    // Call server-side function to ensure admin logs & notifications are created (service role write, respects RLS)
    try {
      const { data } = await supabase.auth.getSession();
      const token = (data as any)?.session?.access_token;
      const fnUrl = `${SUPABASE_URL}/functions/v1/server/make-server-aa5d1aa6/admin/log-booking`;
      await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ booking_id: booking.id }),
      });
    } catch (e) {
      console.error("Erreur en appelant la function log-booking:", e);
    }
  } catch (error) {
    console.error("Erreur lors de la notification admin:", error);
  }
}

/**
 * Envoie une notification quand une réservation change de statut
 */
export async function notifyAdminBookingStatusChange(
  booking: Booking,
  previousStatus: string
): Promise<void> {
  try {
    const isPsychologist = booking.specialty === "psychologist";

    // Skip client-side update of admin_booking_logs: the DB trigger `booking_status_change_trigger` updates the log when bookings.status changes.
    // Just broadcast the status change to admin clients.

    await broadcastAdminNotification({
      type: "booking_status_change",
      booking_id: booking.id,
      previous_status: previousStatus,
      new_status: booking.status,
      is_psychologist: isPsychologist,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erreur lors de la notification de changement de statut:", error);
  }
}

/**
 * Diffuse une notification en temps réel aux administrateurs
 */
async function broadcastAdminNotification(payload: Record<string, unknown>): Promise<void> {
  try {
    await supabase.realtime.channel("admin-notifications").send({
      type: "broadcast",
      event: "booking_event",
      payload,
    });
  } catch (error) {
    console.error("Erreur lors de la diffusion de la notification:", error);
  }
}

/**
 * Récupère toutes les réservations pour le panel admin
 */
export async function fetchAdminBookings(filters?: {
  specialty?: string;
  alertLevel?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminBookingLog[]> {
  try {
    let query = supabase.from("admin_booking_logs").select("*");

    if (filters?.specialty) {
      query = query.eq("specialty", filters.specialty);
    }
    if (filters?.alertLevel) {
      query = query.eq("alert_level", filters.alertLevel);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error("Erreur lors de la récupération des réservations admin:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Erreur lors de la récupération des réservations:", error);
    return [];
  }
}

/**
 * Récupère les réservations prioritaires (psychologues + urgentes)
 */
export async function fetchPriorityBookings(): Promise<AdminBookingLog[]> {
  try {
    const { data, error } = await supabase
      .from("admin_booking_logs")
      .select("*")
      .in("alert_level", ["high", "critical"])
      .order("alert_level", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Erreur lors de la récupération des réservations prioritaires:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Erreur lors de la récupération des réservations prioritaires:", error);
    return [];
  }
}

/**
 * Obtient les statistiques des réservations pour l'admin
 */
export async function fetchBookingStats(): Promise<{
  total: number;
  psychologist: number;
  urgent: number;
  critical: number;
  today: number;
}> {
  try {
    const today = new Date().toISOString().split("T")[0];
    
    const [total, psychologist, urgent, critical, todayCount] = await Promise.all([
      supabase.from("admin_booking_logs").select("id", { count: "exact", head: true }),
      supabase
        .from("admin_booking_logs")
        .select("id", { count: "exact", head: true })
        .eq("is_psychologist", true),
      supabase
        .from("admin_booking_logs")
        .select("id", { count: "exact", head: true })
        .eq("alert_level", "high"),
      supabase
        .from("admin_booking_logs")
        .select("id", { count: "exact", head: true })
        .eq("alert_level", "critical"),
      supabase
        .from("admin_booking_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59`),
    ]);

    return {
      total: total.count ?? 0,
      psychologist: psychologist.count ?? 0,
      urgent: urgent.count ?? 0,
      critical: critical.count ?? 0,
      today: todayCount.count ?? 0,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { total: 0, psychologist: 0, urgent: 0, critical: 0, today: 0 };
  }
}
