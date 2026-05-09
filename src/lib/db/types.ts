// Typed schema for CareLink DB. Mirrors /supabase/schema.sql EXACTLY.
// Column names, enum values, and nullability match the PostgreSQL DDL.

export type UUID = string;
export type ISODate = string; // ISO-8601 timestamp string

// ── Enums (must match schema.sql exactly) ────────────────────────────────────

export type UserRole = "patient" | "professional" | "admin";

export type ProSpecialty =
  | "nurse"
  | "psychologist"
  | "yoga_instructor"
  | "physiotherapist";

export type VerificationStatus = "pending" | "approved" | "rejected";

export type BookingStatus =
  | "open"
  | "matched"
  | "in_progress"
  | "completed"
  | "cancelled";

export type BidStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export type UrgencyLevel = "normal" | "urgent" | "emergency";

export type NotificationKind =
  | "new_bid"
  | "bid_accepted"
  | "booking_status"
  | "message"
  | "system";

// ── Table 1 : profiles ────────────────────────────────────────────────────────
export interface Profile {
  id: UUID;
  role: UserRole;
  full_name: string;
  phone: string | null;          // E.164 +212…
  avatar_url: string | null;
  city: string | null;
  language: string | null;       // default 'fr'
  created_at: ISODate;
  updated_at: ISODate;
}

// ── Table 2 : patients ────────────────────────────────────────────────────────
export interface Patient {
  id: UUID;
  date_of_birth: string | null;  // DATE
  gender: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  created_at: ISODate;
}

// ── Table 3 : services ────────────────────────────────────────────────────────
export interface Service {
  id: UUID;
  specialty: ProSpecialty;
  name: string;
  description: string | null;
  base_price_mad: number | null;
  duration_min: number | null;
  is_active: boolean;
  created_at: ISODate;
}

// ── Table 4 : professionals ───────────────────────────────────────────────────
export interface Professional {
  id: UUID;
  specialty: ProSpecialty;
  bio: string | null;
  years_experience: number;
  hourly_rate_mad: number | null;
  verification_status: VerificationStatus;
  verified_at: ISODate | null;
  verified_by: UUID | null;
  rejection_reason: string | null;
  rating_avg: number;           // maintained by trigger
  rating_count: number;
  total_bookings: number;
  is_available: boolean;
  service_radius_km: number;
  created_at: ISODate;
  updated_at: ISODate;
}

// ── Table 5 : pro_services ────────────────────────────────────────────────────
export interface ProService {
  professional_id: UUID;
  service_id: UUID;
  custom_price_mad: number | null;
}

// ── Table 6 : pro_documents ───────────────────────────────────────────────────
export interface ProDocument {
  id: UUID;
  professional_id: UUID;
  doc_type: string;              // 'diploma' | 'license' | 'id'
  storage_path: string;
  is_verified: boolean;
  uploaded_at: ISODate;
}

// ── Table 7 : bookings ────────────────────────────────────────────────────────
export interface Booking {
  id: UUID;
  patient_id: UUID;
  service_id: UUID | null;       // nullable — set null on service delete
  specialty: ProSpecialty;
  professional_id: UUID | null;  // null until matched
  status: BookingStatus;
  urgency: UrgencyLevel;
  scheduled_at: ISODate | null;
  address: string | null;
  notes: string | null;
  budget_min_mad: number | null;
  budget_max_mad: number | null;
  final_price_mad: number | null;
  created_at: ISODate;
  updated_at: ISODate;
  completed_at: ISODate | null;
  cancelled_at: ISODate | null;
  cancel_reason: string | null;
}

// ── Table 8 : bids ────────────────────────────────────────────────────────────
export interface Bid {
  id: UUID;
  booking_id: UUID;
  professional_id: UUID;
  price_mad: number;
  eta_min: number | null;
  message: string | null;
  status: BidStatus;
  created_at: ISODate;
  responded_at: ISODate | null;
}

// ── Table 9 : ratings ─────────────────────────────────────────────────────────
export interface Rating {
  id: UUID;
  booking_id: UUID;
  patient_id: UUID;
  professional_id: UUID;
  stars: number;                 // 1-5
  comment: string | null;
  created_at: ISODate;
}

// ── Table 10 : yoga_sessions ──────────────────────────────────────────────────
export interface YogaSession {
  id: UUID;
  instructor_id: UUID;
  title: string;
  description: string | null;
  starts_at: ISODate;
  duration_min: number;
  capacity: number;
  price_mad: number;
  address: string | null;
  is_online: boolean;
  meeting_url: string | null;
  created_at: ISODate;
}

// ── Table 11 : yoga_enrollments ───────────────────────────────────────────────
export interface YogaEnrollment {
  session_id: UUID;
  patient_id: UUID;
  enrolled_at: ISODate;
}

// ── Table 12 : messages ───────────────────────────────────────────────────────
export interface Message {
  id: UUID;
  booking_id: UUID;
  sender_id: UUID;
  body: string;
  created_at: ISODate;
}

// ── Table 13 : notifications ──────────────────────────────────────────────────
export interface Notification {
  id: UUID;
  user_id: UUID;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: ISODate;
}

// ── View : v_pros_public (public-safe pro profile) ────────────────────────────
export interface PublicPro {
  id: UUID;
  full_name: string;
  avatar_url: string | null;
  specialty: ProSpecialty;
  bio: string | null;
  years_experience: number;
  city: string | null;
  rating_avg: number;
  rating_count: number;
  verification_status: VerificationStatus;
  is_available: boolean;
}

// ── Specialty helpers ─────────────────────────────────────────────────────────

/** Map legacy UI specialty keys to DB enum values */
export function toDbSpecialty(key: string): ProSpecialty {
  const map: Record<string, ProSpecialty> = {
    nurse: "nurse",
    infirmier: "nurse",
    psychologist: "psychologist",
    psy: "psychologist",
    yoga: "yoga_instructor",
    yoga_instructor: "yoga_instructor",
    physio: "physiotherapist",
    kine: "physiotherapist",
    physiotherapist: "physiotherapist",
  };
  return map[key.toLowerCase()] ?? "nurse";
}
