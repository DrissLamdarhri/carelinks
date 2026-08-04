export type UUID = string;
export type ISODate = string;

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
  | "en_route" // nurse has left / is "out" (RULE #3 boundary)
  | "in_progress"
  | "completed"
  | "cancelled";
export type BidStatus = "pending" | "accepted" | "rejected" | "withdrawn";
export type UrgencyLevel = "normal" | "urgent" | "emergency";
// Psychologist appointments (0024)
export type SessionMode = "in_person" | "remote";
export type PlanType = "single" | "recurring" | "subscription";
export type Recurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly";

export interface Profile {
  id: UUID;
  role: UserRole;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  language: string | null;
  policy_version?: string | null;
  policy_accepted_at?: ISODate | null;
  consent_share_data?: boolean | null;
  cancel_warnings?: number | null;
  is_suspended?: boolean | null;
  /** Mirrored from patients.id_status (migration 0030). The ONLY identity
   *  signal a professional is allowed to see — never the CIN number or photo. */
  identity_verified?: boolean | null;
  consent_reminders?: boolean | null;
  consent_analytics?: boolean | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export type IdentityStatus = "unverified" | "pending" | "approved" | "rejected";

export interface Patient {
  id: UUID;
  date_of_birth: string | null;
  gender: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  created_at: ISODate;
  // Identity (CIN) verification — migration 0030. The photo path is only ever
  // readable by the owner and admins; pros see profiles.identity_verified.
  cin_number: string | null;
  cin_photo_path: string | null;
  id_status: IdentityStatus;
  id_submitted_at: ISODate | null;
  id_verified_at: ISODate | null;
  id_verified_by: UUID | null;
  id_rejection_reason: string | null;
}

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
  rating_avg: number;
  rating_count: number;
  total_bookings: number;
  is_available: boolean;
  service_radius_km: number;
  meet_link: string | null; // psychologist's remote-session Google Meet link
  zoom_link: string | null; // psychologist's remote-session Zoom link
  created_at: ISODate;
  updated_at: ISODate;
}

export interface ProDocument {
  id: UUID;
  professional_id: UUID;
  doc_type: string;
  storage_path: string;
  is_verified: boolean;
  uploaded_at: ISODate;
}

/**
 * What a professional is allowed to see about a request before they are assigned
 * to it — a redacted projection of an open `Booking` (migration 0028).
 *
 * Deliberately missing: `address`, exact coordinates, `notes` and `patient_id`.
 * Pros need enough to price a job, not enough to turn up at someone's door. The
 * full `Booking` becomes readable the moment their bid is accepted.
 */
export interface OpenDemand {
  booking_id: UUID;
  specialty: ProSpecialty;
  urgency: UrgencyLevel | null;
  scheduled_at: ISODate | null;
  budget_min_mad: number | null;
  budget_max_mad: number | null;
  area_label: string | null; // "Agdal, Fès" — district + city, never the street
  approx_lat: number | null; // fuzzed to a ~1 km grid
  approx_lng: number | null;
  care_type: string | null; // specific care picked (0050), e.g. "Pansement"
  created_at: ISODate;
}

export interface Booking {
  id: UUID;
  patient_id: UUID;
  service_id: UUID | null;
  specialty: ProSpecialty;
  professional_id: UUID | null;
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
  cancel_case: 1 | 2 | 3 | 4 | null; // which cancellation rule applied
  refund_mad: number | null; // client refund recorded at cancellation
  cancelled_by: "patient" | "pro" | null;
  // Psychologist appointments (0024)
  session_mode: SessionMode | null; // 'in_person' | 'remote'
  plan_type: PlanType | null; // 'single' | 'recurring' | 'subscription'
  recurrence: Recurrence | null; // 'none' | 'weekly' | 'biweekly' | 'monthly'
  series_id: UUID | null;
  session_index: number | null;
  session_total: number | null;
  meet_link: string | null;
  zoom_link: string | null;
  // Yoga classes (0043) — which session this reservation is for, set at
  // creation time, before payment/enrollment exist.
  yoga_session_id: UUID | null;
  // The specific care picked on the request form (0050), e.g. "Pansement" /
  // "Injection IM" — null for services with no sub-type picker (yoga, psy).
  care_type: string | null;
}

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

export interface Message {
  id: UUID;
  booking_id: UUID;
  sender_id: UUID;
  body: string;
  created_at: ISODate;
}

export interface Conversation {
  id: UUID;
  created_by: UUID;
  booking_id: UUID | null;
  created_at: ISODate;
}

export interface ConversationParticipant {
  conversation_id: UUID;
  user_id: UUID;
  role: UserRole | null;
  joined_at: ISODate;
  last_read_at: ISODate | null;
}

export interface ConversationMessage {
  id: UUID;
  conversation_id: UUID;
  sender_id: UUID;
  body: string;
  type: string;
  attachment_url: string | null;
  created_at: ISODate;
  edited_at: ISODate | null;
  deleted_at: ISODate | null;
}

export interface MessageReceipt {
  message_id: UUID;
  user_id: UUID;
  delivered_at: ISODate | null;
  read_at: ISODate | null;
}

export interface Address {
  id: UUID;
  user_id: UUID;
  label: string | null;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  notes: string | null;
  is_default: boolean;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface NotificationSettings {
  user_id: UUID;
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  appointment_enabled: boolean;
  messages_enabled: boolean;
  reminders_enabled: boolean;
  security_enabled: boolean;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface NearbyPro {
  id: UUID;
  full_name: string | null;
  specialty: ProSpecialty;
  rating_avg: number | null;
  distance_km: number;
}

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "paused";

export interface Subscription {
  user_id: UUID;
  plan_id: string;
  status: SubscriptionStatus;
  expires_at: ISODate | null;
  features: string[];
  created_at: ISODate;
  updated_at: ISODate;
}

/**
 * Server-owned lifecycle of a live tracking session (migration 0051).
 *
 *  pending → channels open at bid acceptance; NO GPS may flow yet
 *  active  → nurse pressed "Je pars" (booking `en_route`); GPS permitted
 *  ended   → arrived / completed / cancelled / expired; permanently closed
 *
 * The client never writes any of this — it is derived from `bookings.status`
 * by a database trigger, and Realtime Authorization (0052) reads it to decide
 * who may join which stream.
 */
export type TrackingSessionStatus = "pending" | "active" | "ended";
export type TrackingEndReason = "arrived" | "completed" | "cancelled" | "expired";

export interface TrackingSession {
  id: UUID;
  booking_id: UUID;
  patient_id: UUID;
  pro_id: UUID;
  status: TrackingSessionStatus;
  created_at: ISODate;
  gps_started_at: ISODate | null;
  ended_at: ISODate | null;
  end_reason: TrackingEndReason | null;
  /** Last known professional position — cold-start seed, written ~every 15 s. */
  last_lat: number | null;
  last_lng: number | null;
  last_heading: number | null;
  last_speed: number | null;
  last_seq: number;
  last_at: ISODate | null;
  /** Patient's opt-in live-location share (never set by a trigger). */
  patient_share_granted_at: ISODate | null;
  patient_share_expires_at: ISODate | null;
  patient_share_revoked_at: ISODate | null;
  patient_share_declined_at: ISODate | null;
}

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
