import { supabase } from "@/lib/supabase";
import type {
  Address,
  Bid,
  BidStatus,
  Booking,
  BookingStatus,
  Message,
  NotificationSettings,
  Patient,
  ProDocument,
  Professional,
  Profile,
  ProSpecialty,
  UUID,
} from "./types";

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  if (data === null) throw new Error("Empty result");
  return data;
}

export const profiles = {
  async get(id: UUID): Promise<Profile> {
    return unwrap(await supabase.from("profiles").select("*").eq("id", id).single());
  },

  async update(id: UUID, patch: Partial<Omit<Profile, "id" | "created_at">>): Promise<Profile> {
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

export const pros = {
  async get(id: UUID): Promise<Professional | null> {
    const { data, error } = await supabase.from("professionals").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(
    input: Partial<Professional> & { id: UUID; specialty: ProSpecialty }
  ): Promise<Professional> {
    return unwrap(
      await supabase
        .from("professionals")
        .upsert({ ...input, updated_at: new Date().toISOString() })
        .select("*")
        .single()
    );
  },
};

export const patients = {
  async get(id: UUID): Promise<Patient | null> {
    const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(input: Partial<Patient> & { id: UUID }): Promise<Patient> {
    return unwrap(await supabase.from("patients").upsert(input).select("*").single());
  },
};

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
  async create(input: Omit<ProDocument, "id" | "uploaded_at" | "is_verified">): Promise<ProDocument> {
    return unwrap(await supabase.from("pro_documents").insert(input).select("*").single());
  },
};

export const bookings = {
  async create(
    input: Pick<Booking, "patient_id" | "specialty"> &
      Partial<
        Omit<
          Booking,
          "id" | "created_at" | "updated_at" | "completed_at" | "cancelled_at" | "patient_id" | "specialty"
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
    return unwrap(await supabase.from("bookings").select("*").eq("id", id).single());
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

  async listForPro(proId: UUID): Promise<Booking[]> {
    return unwrap(
      await supabase
        .from("bookings")
        .select("*")
        .eq("professional_id", proId)
        .order("created_at", { ascending: false })
    );
  },

  async listOpenForSpecialty(specialty: ProSpecialty, limit = 50): Promise<Booking[]> {
    return unwrap(
      await supabase
        .from("bookings")
        .select("*")
        .eq("specialty", specialty)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(limit)
    );
  },

  async acceptBid(bookingId: UUID, professionalId: UUID, finalPrice: number): Promise<Booking> {
    return unwrap(
      await supabase
        .from("bookings")
        .update({
          status: "matched",
          professional_id: professionalId,
          final_price_mad: finalPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select("*")
        .single()
    );
  },

  async setStatus(id: UUID, status: BookingStatus, extra?: Partial<Booking>): Promise<Booking> {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      ...extra,
    };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
    return unwrap(await supabase.from("bookings").update(patch).eq("id", id).select("*").single());
  },
  // Late cancellation (pro en route): 5 MAD penalty + a warning; 2 → suspension.
  async cancelWithPenalty(id: UUID): Promise<{ warnings: number; suspended: boolean; penalty_mad: number }> {
    const { data, error } = await supabase.rpc("cancel_with_penalty", { p_booking: id });
    if (error) throw error;
    return data as { warnings: number; suspended: boolean; penalty_mad: number };
  },
};

export const bids = {
  async create(
    input: Pick<Bid, "booking_id" | "professional_id" | "price_mad"> & Partial<Pick<Bid, "eta_min" | "message">>
  ): Promise<Bid> {
    return unwrap(await supabase.from("bids").insert({ status: "pending", ...input }).select("*").single());
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
    const accepted = await supabase
      .from("bids")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", bid.id);
    if (accepted.error) throw accepted.error;

    const rejected = await supabase
      .from("bids")
      .update({ status: "rejected", responded_at: new Date().toISOString() })
      .eq("booking_id", bid.booking_id)
      .eq("status", "pending")
      .neq("id", bid.id);
    if (rejected.error) throw rejected.error;
  },

  /**
   * Accept a bid and match the booking atomically via the accept_bid() RPC.
   * The patient can't write the bids table under RLS (only the pro can), so
   * this SECURITY DEFINER function does it server-side after verifying the
   * caller is the booking's patient. Returns the now-matched booking.
   */
  async acceptAndMatch(bidId: UUID): Promise<Booking> {
    const { data, error } = await supabase.rpc("accept_bid", { p_bid_id: bidId });
    if (error) throw error;
    return data as Booking;
  },
};

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
    return unwrap(await supabase.from("messages").insert(input).select("*").single());
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
    return unwrap(await supabase.from("addresses").insert(input).select("*").single());
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
    const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", addressId);
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

// ── Payments & payouts ──────────────────────────────────────────────────────
export type PaymentProvider = "cmi" | "stripe" | "cash";
export type PaymentStatus = "pending" | "authorized" | "captured" | "refunded" | "failed";
export type Payment = {
  id: UUID;
  booking_id: UUID;
  patient_id: UUID;
  professional_id: UUID | null;
  amount_mad: number;
  commission_mad: number;
  provider: PaymentProvider;
  provider_ref: string | null;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
};
export type PayoutStatus = "requested" | "processing" | "paid" | "rejected";
export type Payout = {
  id: UUID;
  professional_id: UUID;
  amount_mad: number;
  status: PayoutStatus;
  method: string | null;
  note: string | null;
  created_at: string;
  processed_at: string | null;
};

export const payments = {
  async create(
    input: Pick<Payment, "booking_id" | "patient_id" | "amount_mad" | "provider"> & {
      professional_id?: UUID | null;
    }
  ): Promise<Payment> {
    return unwrap(
      await supabase.from("payments").insert({ status: "authorized", ...input }).select("*").single()
    );
  },
  async listForPatient(patientId: UUID): Promise<Payment[]> {
    return unwrap(
      await supabase.from("payments").select("*").eq("patient_id", patientId).order("created_at", { ascending: false })
    );
  },
  async listForPro(proId: UUID): Promise<Payment[]> {
    return unwrap(
      await supabase.from("payments").select("*").eq("professional_id", proId).order("created_at", { ascending: false })
    );
  },
};

export const payouts = {
  async listForPro(proId: UUID): Promise<Payout[]> {
    return unwrap(
      await supabase.from("payouts").select("*").eq("professional_id", proId).order("created_at", { ascending: false })
    );
  },
  async request(input: { professional_id: UUID; amount_mad: number; method?: string; note?: string }): Promise<Payout> {
    return unwrap(
      await supabase.from("payouts").insert({ status: "requested", ...input }).select("*").single()
    );
  },
};

export const db = {
  profiles,
  patients,
  pros,
  proDocuments,
  bookings,
  bids,
  messages,
  addresses,
  notificationSettings,
  payments,
  payouts,
};
