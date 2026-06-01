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
};
