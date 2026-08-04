/**
 * CareLink — tracking session data access.
 * ────────────────────────────────────────────────────────────────────────────
 * A tracking session is owned by the server (migration 0051): triggers on
 * `bookings` create it at acceptance, arm GPS at `en_route`, and close it
 * permanently on arrival/completion/cancellation. There is deliberately NO
 * create/update/delete here — the client cannot open a session, extend one, or
 * bring one back. Everything below is either a read of your own row or an RPC
 * that re-checks the caller server-side.
 */
import { supabase } from "@/lib/supabase";
import type { TrackingSession, UUID } from "./types";

/** Realtime topic carrying the professional's position (nurse → patient). */
export function proStreamTopic(bookingId: UUID): string {
  return `tracking:${bookingId}:pro`;
}

/** Realtime topic carrying the patient's opt-in position (patient → nurse). */
export function patientStreamTopic(bookingId: UUID): string {
  return `tracking:${bookingId}:patient`;
}

/** True while the patient's opt-in share is granted, un-revoked and unexpired.
 *  Mirrors `public.tracking_share_active()` — this copy is for RENDERING only;
 *  the server never trusts it. */
export function isShareActive(s: TrackingSession | null | undefined): boolean {
  if (!s?.patient_share_granted_at || s.patient_share_revoked_at) return false;
  if (!s.patient_share_expires_at) return false;
  return new Date(s.patient_share_expires_at).getTime() > Date.now();
}

export const tracking = {
  /** The session for a booking, or null when none exists / not a party to it. */
  async get(bookingId: UUID): Promise<TrackingSession | null> {
    const { data, error } = await supabase
      .from("tracking_sessions")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (error) throw error;
    return (data as TrackingSession) ?? null;
  },

  /**
   * Persist the professional's last-known position (cold-start seed only).
   * Rejected server-side unless the caller is the assigned pro on an ACTIVE
   * session, so it cannot be used to publish before departure or after arrival.
   * Throttled by the caller — see `lib/live-location.ts`.
   */
  async updatePosition(input: {
    bookingId: UUID;
    lat: number;
    lng: number;
    heading?: number | null;
    speed?: number | null;
    seq?: number | null;
  }): Promise<void> {
    const { error } = await supabase.rpc("update_tracking_position", {
      b_id: input.bookingId,
      p_lat: input.lat,
      p_lng: input.lng,
      p_heading: input.heading ?? null,
      p_speed: input.speed ?? null,
      p_seq: input.seq ?? null,
    });
    if (error) throw error;
  },

  /**
   * Patient consents to share their live location with the nurse. Server
   * clamps the window to ≤60 min and refuses unless the caller is the patient
   * on an active session. Granting is what makes the nurse's subscription to
   * the patient topic authorized at all.
   */
  async grantLiveShare(bookingId: UUID, minutes = 30): Promise<TrackingSession> {
    const { data, error } = await supabase.rpc("grant_patient_live_share", {
      b_id: bookingId,
      p_minutes: minutes,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as TrackingSession;
  },

  /** Patient withdraws consent. Takes effect on the next publish/join. */
  async revokeLiveShare(bookingId: UUID): Promise<void> {
    const { error } = await supabase.rpc("revoke_patient_live_share", { b_id: bookingId });
    if (error) throw error;
  },

  /** Patient said no. Recorded so the prompt is never shown twice this trip. */
  async declineLiveShare(bookingId: UUID): Promise<void> {
    const { error } = await supabase.rpc("decline_patient_live_share", { b_id: bookingId });
    if (error) throw error;
  },
};
