import { supabase } from "@/lib/supabase";
import type {
  Address,
  Bid,
  BidStatus,
  Booking,
  BookingStatus,
  Message,
  NotificationSettings,
  OpenDemand,
  Patient,
  ProDocument,
  Professional,
  Profile,
  ProSpecialty,
  UUID,
} from "./types";

// RFC-4122-ish v4 id for grouping (series). Dependency-free; fine as a group key.
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

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

  /**
   * Toggle availability with a targeted UPDATE. A partial upsert would let
   * unsupplied columns fall back to their defaults on the INSERT pass, which made
   * the availability guard trigger see verification_status='pending' and silently
   * force the pro offline (see migration 0026).
   */
  async setAvailability(id: UUID, isAvailable: boolean): Promise<Professional> {
    return unwrap(
      await supabase
        .from("professionals")
        .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
        .eq("id", id)
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

  // Create a recurring plan / subscription pack as N linked sessions sharing a
  // series_id (each session is a normal booking → its own escrow payment).
  async createSeries(
    base: Pick<Booking, "patient_id" | "specialty"> & Partial<Booking>,
    opts: { count: number; recurrence: Exclude<Booking["recurrence"], null | "none">; firstDateISO: string }
  ): Promise<Booking[]> {
    const seriesId = uuidv4();
    const stepDays = opts.recurrence === "daily" ? 1 : opts.recurrence === "weekly" ? 7 : opts.recurrence === "biweekly" ? 14 : 0;
    const rows = Array.from({ length: opts.count }, (_, i) => {
      const d = new Date(opts.firstDateISO);
      if (opts.recurrence === "monthly") d.setMonth(d.getMonth() + i);
      else d.setDate(d.getDate() + stepDays * i);
      return {
        status: "matched",
        urgency: "normal",
        ...base,
        scheduled_at: d.toISOString(),
        series_id: seriesId,
        session_index: i + 1,
        session_total: opts.count,
      };
    });
    return unwrap(await supabase.from("bookings").insert(rows).select("*"));
  },

  async getSeries(seriesId: UUID): Promise<Booking[]> {
    return unwrap(
      await supabase.from("bookings").select("*").eq("series_id", seriesId).order("session_index", { ascending: true })
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

  async listForPro(proId: UUID): Promise<Booking[]> {
    return unwrap(
      await supabase
        .from("bookings")
        .select("*")
        .eq("professional_id", proId)
        .order("created_at", { ascending: false })
    );
  },

  // Demands a professional may bid on: their OWN specialty only, and only those
  // posted in the last `withinHours` (default 24h). Older open requests are stale
  // — showing them clutters the feed and lets pros bid on dead demands.
  //
  // Reads `open_demands`, not `bookings`: pros are no longer allowed to see a
  // patient's street address, exact GPS or notes before being assigned to the
  // job (migration 0028). RLS on `bookings` enforces this, so querying the table
  // directly would simply return nothing.
  async listOpenForSpecialty(specialty: ProSpecialty, limit = 50, withinHours = 24): Promise<OpenDemand[]> {
    const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
    return unwrap(
      await supabase
        .from("open_demands")
        .select("*")
        .eq("specialty", specialty)
        .gte("created_at", since)
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
  // Nurse marks "I'm leaving / en route" (matched → en_route). Enables RULE #3.
  async markEnRoute(id: UUID): Promise<Booking> {
    return this.setStatus(id, "en_route");
  },
  // Cancel via the escrow-aware RPC. The RPC picks the cancellation rule (1-4)
  // from the booking status + who is cancelling (patient vs nurse), settles the
  // escrow (refund / fee retention / trip comp / penalty) and notifies both sides.
  async cancelBooking(
    id: UUID,
    reason?: string
  ): Promise<{ cancel_case: 1 | 2 | 3 | 4; refund_mad: number; nurse_comp_mad: number; penalty_mad: number }> {
    const { data, error } = await supabase.rpc("cancel_booking", { p_booking: id, p_reason: reason ?? null });
    if (error) throw error;
    return data as { cancel_case: 1 | 2 | 3 | 4; refund_mad: number; nurse_comp_mad: number; penalty_mad: number };
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
// 'service' = the client's escrow hold; 'trip_comp' = RULE #3 credit to the nurse;
// 'penalty' = RULE #4 debit against the nurse's balance.
export type PaymentKind = "service" | "trip_comp" | "penalty";
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
  kind: PaymentKind;
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
  // Escrow status for a set of bookings (used to show which subscription sessions
  // are already paid/held vs. still to settle).
  async listForBookings(bookingIds: UUID[]): Promise<Payment[]> {
    if (bookingIds.length === 0) return [];
    return unwrap(await supabase.from("payments").select("*").in("booking_id", bookingIds));
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
