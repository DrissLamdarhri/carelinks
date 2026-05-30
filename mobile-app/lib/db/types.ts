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
  | "in_progress"
  | "completed"
  | "cancelled";
export type BidStatus = "pending" | "accepted" | "rejected" | "withdrawn";
export type UrgencyLevel = "normal" | "urgent" | "emergency";

export interface Profile {
  id: UUID;
  role: UserRole;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  language: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Patient {
  id: UUID;
  date_of_birth: string | null;
  gender: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  created_at: ISODate;
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
