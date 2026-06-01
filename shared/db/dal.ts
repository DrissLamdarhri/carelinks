/**
 * CareLink — Data Access Layer (shared, framework-agnostic).
 * Identical logic to src/lib/db/dal.ts; only the supabase import path changes.
 * All functions are pure async — work in both React (web) and React Native.
 */

import { supabase } from "../supabase";
import type {
  Address,
  Bid,
  BidStatus,
  Booking,
  BookingStatus,
  Message,
  NotificationSettings,
  Notification,
  Patient,
  Professional,
  Profile,
  ProDocument,
  ProService,
  ProSpecialty,
  PublicPro,
  Rating,
  Service,
  UUID,
  YogaEnrollment,
  YogaSession,
} from "./types";

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  if (data === null) throw new Error("DAL: empty result");
  return data;
}

// ── PROFILES ──────────────────────────────────────────────────────────────────
export const profiles = {
  async get(id: UUID): Promise<Profile> {
    return unwrap(
      await supabase.from("profiles").select("*").eq("id", id).single()
    );
  },

  async update(
    id: UUID,
    patch: Partial<Omit<Profile, "id" | "created_at">>
  ): Promise<Profile> {
    return unwrap(
      await supabase
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single()
    );
  },
};

// ── PATIENTS ──────────────────────────────────────────────────────────────────
export const patients = {
  async get(id: UUID): Promise<Patient | null> {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(p: Partial<Patient> & { id: UUID }): Promise<Patient> {
    return unwrap(
      await supabase.from("patients").upsert(p).select("*").single()
    );
  },
};

// ── PROFESSIONALS ─────────────────────────────────────────────────────────────
export const pros = {
  async get(id: UUID): Promise<Professional | null> {
    const { data, error } = await supabase
      .from("professionals")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(
    p: Partial<Professional> & { id: UUID; specialty: ProSpecialty }
  ): Promise<Professional> {
    return unwrap(
      await supabase
        .from("professionals")
        .upsert({ ...p, updated_at: new Date().toISOString() })
        .select("*")
        .single()
    );
  },

  async listPublic(filter?: {
    specialty?: ProSpecialty;
    city?: string;
    limit?: number;
  }): Promise<PublicPro[]> {
    let q = supabase.from("v_pros_public").select("*");
    if (filter?.specialty) q = q.eq("specialty", filter.specialty);
    if (filter?.city) q = q.ilike("city", `%${filter.city}%`);
    q = q.order("rating_avg", { ascending: false }).limit(filter?.limit ?? 50);
    return unwrap(await q);
  },
};

// ── SERVICES ──────────────────────────────────────────────────────────────────
export const services = {
  async list(specialty?: ProSpecialty): Promise<Service[]> {
    let q = supabase.from("services").select("*").eq("is_active", true);
    if (specialty) q = q.eq("specialty", specialty);
    return unwrap(await q.order("name"));
  },
};

export const proServices = {
  async listForPro(proId: UUID): Promise<ProService[]> {
    return unwrap(
      await supabase
        .from("pro_services")
        .select("*")
        .eq("professional_id", proId)
    );
  },

  async upsert(row: ProService): Promise<ProService> {
    return unwrap(
      await supabase.from("pro_services").upsert(row).select("*").single()
    );
  },

  async remove(proId: UUID, serviceId: UUID): Promise<void> {
    const { error } = await supabase
      .from("pro_services")
      .delete()
      .eq("professional_id", proId)
      .eq("service_id", serviceId);
    if (error) throw error;
  },
};

// ── PRO DOCUMENTS ─────────────────────────────────────────────────────────────
export const proDocuments = {
  async listForPro(proId: UUID): Promise<ProDocument[]> {
    return unwrap(
      await supabase
        .from("pro_documents")
        .select("*")
        .eq("professional_id", proId)
        .order("uploaded_at", { ascending: false })
    );
  },

  async create(
    doc: Omit<ProDocument, "id" | "uploaded_at" | "is_verified">
  ): Promise<ProDocument> {
    return unwrap(
      await supabase.from("pro_documents").insert(doc).select("*").single()
    );
  },
};

// ── BOOKINGS ──────────────────────────────────────────────────────────────────
export const bookings = {
  async create(
    input: Pick<Booking, "patient_id" | "specialty"> &
      Partial<
        Omit<
          Booking,
          | "id"
          | "created_at"
          | "updated_at"
          | "completed_at"
          | "cancelled_at"
        >
      >
  ): Promise<Booking> {
    return unwrap(
      await supabase
        .from("bookings")
        .insert({ status: "open", urgency: "normal", ...input })
        .select("*")
        .single()
    );
  },

  async get(id: UUID): Promise<Booking> {
    return unwrap(
      await supabase.from("bookings").select("*").eq("id", id).single()
    );
  },

  async listForPatient(patientId: UUID): Promise<Booking[]> {
    return unwrap(
      await supabase
        .from("bookings")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
    );
  },

  async listOpenForSpecialty(specialty: ProSpecialty): Promise<Booking[]> {
    return unwrap(
      await supabase
        .from("bookings")
        .select("*")
        .eq("specialty", specialty)
        .eq("status", "open")
        .order("created_at", { ascending: false })
    );
  },

  async listForPro(proId: UUID): Promise<Booking[]> {
    return unwrap(
      await supabase
        .from("bookings")
        .select("*")
        .eq("professional_id", proId)
        .order("created_at", { ascending: false })
    );
  },

  async setStatus(
    id: UUID,
    status: BookingStatus,
    extra?: Partial<Booking>
  ): Promise<Booking> {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      ...extra,
    };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
    return unwrap(
      await supabase
        .from("bookings")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single()
    );
  },

  async acceptBid(
    bookingId: UUID,
    proId: UUID,
    finalPrice: number
  ): Promise<Booking> {
    return unwrap(
      await supabase
        .from("bookings")
        .update({
          status: "matched",
          professional_id: proId,
          final_price_mad: finalPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select("*")
        .single()
    );
  },
};

// ── BIDS ──────────────────────────────────────────────────────────────────────
export const bids = {
  async create(
    input: Pick<Bid, "booking_id" | "professional_id" | "price_mad"> &
      Partial<Pick<Bid, "eta_min" | "message">>
  ): Promise<Bid> {
    return unwrap(
      await supabase
        .from("bids")
        .insert({ status: "pending", ...input })
        .select("*")
        .single()
    );
  },

  async listForBooking(bookingId: UUID): Promise<Bid[]> {
    return unwrap(
      await supabase
        .from("bids")
        .select("*")
        .eq("booking_id", bookingId)
        .order("price_mad", { ascending: true })
    );
  },

  async listForPro(proId: UUID): Promise<Bid[]> {
    return unwrap(
      await supabase
        .from("bids")
        .select("*")
        .eq("professional_id", proId)
        .order("created_at", { ascending: false })
    );
  },

  async setStatus(id: UUID, status: BidStatus): Promise<Bid> {
    return unwrap(
      await supabase
        .from("bids")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single()
    );
  },

  async accept(bid: Bid): Promise<void> {
    await supabase
      .from("bids")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", bid.id);
    await supabase
      .from("bids")
      .update({ status: "rejected", responded_at: new Date().toISOString() })
      .eq("booking_id", bid.booking_id)
      .eq("status", "pending")
      .neq("id", bid.id);
  },
};

// ── RATINGS ───────────────────────────────────────────────────────────────────
export const ratings = {
  async create(input: Omit<Rating, "id" | "created_at">): Promise<Rating> {
    return unwrap(
      await supabase.from("ratings").insert(input).select("*").single()
    );
  },

  async listForPro(proId: UUID): Promise<Rating[]> {
    return unwrap(
      await supabase
        .from("ratings")
        .select("*")
        .eq("professional_id", proId)
        .order("created_at", { ascending: false })
    );
  },
};

// ── YOGA ──────────────────────────────────────────────────────────────────────
export const yoga = {
  async listUpcoming(limit = 20): Promise<YogaSession[]> {
    return unwrap(
      await supabase
        .from("yoga_sessions")
        .select("*")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(limit)
    );
  },

  async listForInstructor(proId: UUID): Promise<YogaSession[]> {
    return unwrap(
      await supabase
        .from("yoga_sessions")
        .select("*")
        .eq("instructor_id", proId)
        .order("starts_at", { ascending: false })
    );
  },

  async createSession(
    input: Omit<YogaSession, "id" | "created_at">
  ): Promise<YogaSession> {
    return unwrap(
      await supabase.from("yoga_sessions").insert(input).select("*").single()
    );
  },

  async enroll(sessionId: UUID, patientId: UUID): Promise<YogaEnrollment> {
    return unwrap(
      await supabase
        .from("yoga_enrollments")
        .insert({ session_id: sessionId, patient_id: patientId })
        .select("*")
        .single()
    );
  },

  async myEnrollments(patientId: UUID): Promise<YogaEnrollment[]> {
    return unwrap(
      await supabase
        .from("yoga_enrollments")
        .select("*")
        .eq("patient_id", patientId)
        .order("enrolled_at", { ascending: false })
    );
  },
};

// ── MESSAGES ──────────────────────────────────────────────────────────────────
export const messages = {
  async listForBooking(bookingId: UUID): Promise<Message[]> {
    return unwrap(
      await supabase
        .from("messages")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true })
    );
  },

  async send(input: Omit<Message, "id" | "created_at">): Promise<Message> {
    return unwrap(
      await supabase.from("messages").insert(input).select("*").single()
    );
  },
};

export const addresses = {
  async listForUser(userId: UUID): Promise<Address[]> {
    return unwrap(
      await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    );
  },

  async create(input: Omit<Address, "id" | "created_at" | "updated_at">): Promise<Address> {
    return unwrap(
      await supabase.from("addresses").insert(input).select("*").single()
    );
  },

  async update(id: UUID, patch: Partial<Omit<Address, "id" | "user_id" | "created_at">>): Promise<Address> {
    return unwrap(
      await supabase
        .from("addresses")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single()
    );
  },

  async remove(id: UUID): Promise<void> {
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) throw error;
  },

  async setDefault(userId: UUID, addressId: UUID): Promise<void> {
    const { error: clearError } = await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);
    if (clearError) throw clearError;
    const { error } = await supabase
      .from("addresses")
      .update({ is_default: true })
      .eq("id", addressId);
    if (error) throw error;
  },
};

export const notificationSettings = {
  async get(userId: UUID): Promise<NotificationSettings | null> {
    const { data, error } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getOrCreate(userId: UUID): Promise<NotificationSettings> {
    const existing = await this.get(userId);
    if (existing) return existing;
    return unwrap(
      await supabase
        .from("notification_settings")
        .insert({ user_id: userId })
        .select("*")
        .single()
    );
  },

  async update(
    userId: UUID,
    patch: Partial<Omit<NotificationSettings, "user_id" | "created_at">>
  ): Promise<NotificationSettings> {
    return unwrap(
      await supabase
        .from("notification_settings")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select("*")
        .single()
    );
  },
};

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
export const notifications = {
  async listForUser(userId: UUID, limit = 50): Promise<Notification[]> {
    return unwrap(
      await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)
    );
  },

  async markRead(id: UUID): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (error) throw error;
  },

  async markAllRead(userId: UUID): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw error;
  },
};

// ── Barrel export ─────────────────────────────────────────────────────────────
export const db = {
  profiles,
  patients,
  pros,
  services,
  proServices,
  proDocuments,
  bookings,
  bids,
  ratings,
  yoga,
  messages,
  notifications,
  addresses,
  notificationSettings,
};
