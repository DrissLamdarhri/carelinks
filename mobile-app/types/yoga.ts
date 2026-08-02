/** Shared yoga types — mirrors the LIVE schema (checked directly against the
 *  Supabase project), not just the migration files: `yoga_sessions` has an
 *  `instructor_name` text column deployed ad-hoc (never in a migration) and
 *  is missing `city`/`instructor_id`, both added by migration 0041. */

export type YogaSessionStatus = "scheduled" | "completed" | "cancelled";

export interface YogaSession {
  id: string;
  title: string;
  description: string | null;
  instructor_id: string | null;
  /** Freeform snapshot, kept for legacy rows created before instructor_id existed. */
  instructor_name: string | null;
  level: string;
  image_url: string | null;
  starts_at: string;
  duration_min: number;
  capacity: number;
  price_mad: number;
  address: string | null;
  city: string | null;
  is_online: boolean;
  meeting_url: string | null;
  status: YogaSessionStatus;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

export interface YogaEnrollment {
  session_id: string;
  patient_id: string;
  booking_id: string | null;
  enrolled_at: string;
}

/** A session in the patient-facing catalog, with the client-visible fields derived. */
export interface YogaCatalogEntry extends YogaSession {
  instructorDisplayName: string;
  instructorAvatarUrl: string | null;
  enrolledCount: number;
  spotsLeft: number;
}

export type YogaBookingStatus = "open" | "matched" | "cancelled" | "completed";
export type YogaPaymentStatus = "pending" | "authorized" | "captured" | "refunded" | "failed" | null;

/** The joined view used by YogaBookingDetails — one query, not several. */
export interface YogaBookingDetails {
  booking_id: string;
  booking_status: YogaBookingStatus;
  final_price_mad: number | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  session: {
    id: string;
    title: string;
    address: string | null;
    city: string | null;
    starts_at: string;
    duration_min: number;
    status: YogaSessionStatus;
  } | null;
  instructor: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  payment: {
    status: YogaPaymentStatus;
    amount_mad: number | null;
  } | null;
}
