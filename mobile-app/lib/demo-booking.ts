import type { Bid, Booking, Message, Professional, Profile } from "@/lib/db/types";

export const DEMO_PATIENT_ID = "demo-patient";
export const DEMO_PRO_1_ID = "demo-pro-1";
export const DEMO_PRO_2_ID = "demo-pro-2";

export function normalizeRouteParam(value: string | string[] | undefined | null): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export function isDemoBookingId(bookingId: string | null | undefined): bookingId is string {
  return typeof bookingId === "string" && bookingId.startsWith("demo-");
}

export function buildDemoBooking(bookingId: string): Booking {
  const now = new Date().toISOString();
  return {
    id: bookingId,
    patient_id: DEMO_PATIENT_ID,
    service_id: null,
    specialty: "nurse",
    professional_id: DEMO_PRO_1_ID,
    status: "matched",
    urgency: "normal",
    scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    address: "Meknès, Maroc",
    notes: "Patient en mode démo",
    budget_min_mad: 100,
    budget_max_mad: 120,
    final_price_mad: 110,
    created_at: now,
    updated_at: now,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
  };
}

export function buildDemoBids(bookingId: string): Bid[] {
  const createdAt = new Date().toISOString();
  return [
    {
      id: "demo-bid-1",
      booking_id: bookingId,
      professional_id: DEMO_PRO_1_ID,
      price_mad: 90,
      eta_min: 12,
      message: "Je suis disponible maintenant et proche de vous.",
      status: "pending",
      created_at: createdAt,
      responded_at: null,
    },
    {
      id: "demo-bid-2",
      booking_id: bookingId,
      professional_id: DEMO_PRO_2_ID,
      price_mad: 110,
      eta_min: 18,
      message: "Je peux intervenir dans moins de 20 minutes.",
      status: "pending",
      created_at: createdAt,
      responded_at: null,
    },
  ];
}

export function buildDemoProfile(proId: string): Profile {
  const now = new Date().toISOString();
  if (proId === DEMO_PRO_2_ID) {
    return {
      id: DEMO_PRO_2_ID,
      role: "professional",
      full_name: "Mohammed Alaoui",
      email: "m.alaoui@example.com",
      phone: "+212661223344",
      avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
      city: "Meknès",
      language: "fr",
      created_at: now,
      updated_at: now,
    };
  }

  return {
    id: DEMO_PRO_1_ID,
    role: "professional",
    full_name: "Amina Hassan",
    email: "amina.hassan@example.com",
    phone: "+212612345678",
    avatar_url: "https://images.unsplash.com/photo-1594824475317-d131f6cbf0d8?w=200&q=80",
    city: "Meknès",
    language: "fr",
    created_at: now,
    updated_at: now,
  };
}

export function buildDemoProfessional(proId: string): Professional {
  const now = new Date().toISOString();
  const isFirst = proId === DEMO_PRO_1_ID;

  return {
    id: proId,
    specialty: "nurse",
    bio: "Infirmier(ère) à domicile",
    years_experience: isFirst ? 7 : 5,
    hourly_rate_mad: isFirst ? 120 : 130,
    verification_status: "approved",
    verified_at: now,
    verified_by: null,
    rejection_reason: null,
    rating_avg: isFirst ? 4.9 : 4.7,
    rating_count: isFirst ? 124 : 89,
    total_bookings: isFirst ? 342 : 211,
    is_available: true,
    service_radius_km: 15,
    created_at: now,
    updated_at: now,
  };
}

export function buildDemoMessages(bookingId: string): Message[] {
  const now = Date.now();
  return [
    {
      id: "demo-msg-1",
      booking_id: bookingId,
      sender_id: DEMO_PRO_1_ID,
      body: "Bonjour, je suis en route vers votre adresse.",
      created_at: new Date(now - 5 * 60 * 1000).toISOString(),
    },
    {
      id: "demo-msg-2",
      booking_id: bookingId,
      sender_id: DEMO_PATIENT_ID,
      body: "Merci, je vous attends.",
      created_at: new Date(now - 4 * 60 * 1000).toISOString(),
    },
  ];
}
