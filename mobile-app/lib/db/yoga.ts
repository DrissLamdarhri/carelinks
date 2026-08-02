/**
 * Centralized Supabase access for the yoga feature — catalog, booking
 * details, patient cancellation, and admin session management.
 *
 * Queries are assembled from a few small, parallelized calls rather than one
 * deep nested `select` — `yoga_sessions.instructor_id` and
 * `yoga_enrollments.booking_id` are both foreign keys pointing the opposite
 * direction from where the read starts (bookings has no `session_id` column;
 * the link is the reverse `yoga_enrollments.booking_id`), and
 * `professionals.id → profiles.id` is a shared-PK relationship rather than a
 * named FK column — chaining all of that through PostgREST's embed syntax is
 * fragile. This matches how the rest of `lib/db/dal.ts` already composes
 * reads (e.g. the pro tracking screen fetches booking + profile separately).
 */
import { supabase } from "@/lib/supabase";
import type {
  YogaBookingDetails,
  YogaCatalogEntry,
  YogaSession,
  YogaSessionStatus,
} from "@/types/yoga";

type UUID = string;

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  if (data === null) throw new Error("Empty result");
  return data;
}

// ── Patient catalog ─────────────────────────────────────────────────────────
export async function getUpcomingCatalog(): Promise<YogaCatalogEntry[]> {
  const { data: sessions, error } = await supabase
    .from("yoga_sessions")
    .select("*")
    .eq("status", "scheduled")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  const rows = (sessions ?? []) as YogaSession[];
  if (rows.length === 0) return [];

  const ids = rows.map((s) => s.id);
  const [{ data: enrollments }, instructorIds] = await Promise.all([
    supabase.from("yoga_enrollments").select("session_id").in("session_id", ids),
    Promise.resolve(Array.from(new Set(rows.map((s) => s.instructor_id).filter((v): v is string => !!v)))),
  ]);
  const countBySession = new Map<string, number>();
  for (const e of enrollments ?? []) {
    countBySession.set(e.session_id, (countBySession.get(e.session_id) ?? 0) + 1);
  }

  const instructorMap = new Map<string, { full_name: string; avatar_url: string | null }>();
  if (instructorIds.length) {
    const { data: pros } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", instructorIds);
    for (const p of pros ?? []) instructorMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
  }

  return rows.map((s) => {
    const linked = s.instructor_id ? instructorMap.get(s.instructor_id) : null;
    const enrolledCount = countBySession.get(s.id) ?? 0;
    return {
      ...s,
      instructorDisplayName: linked?.full_name ?? s.instructor_name ?? "Instructeur",
      instructorAvatarUrl: linked?.avatar_url ?? null,
      enrolledCount,
      spotsLeft: Math.max(0, s.capacity - enrolledCount),
    };
  });
}

// ── Booking detail (post-payment confirmation + "Mes RDV" detail) ──────────
export async function getBookingDetails(bookingId: UUID): Promise<YogaBookingDetails> {
  const [bookingRes, enrollmentRes, paymentRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, status, final_price_mad, cancel_reason, cancelled_at")
      .eq("id", bookingId)
      .single(),
    supabase.from("yoga_enrollments").select("session_id").eq("booking_id", bookingId).maybeSingle(),
    supabase
      .from("payments")
      .select("status, amount_mad")
      .eq("booking_id", bookingId)
      .eq("kind", "service")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const booking = unwrap(bookingRes);

  let session: YogaBookingDetails["session"] = null;
  let instructor: YogaBookingDetails["instructor"] = null;
  const sessionId = enrollmentRes.data?.session_id;
  if (sessionId) {
    const { data: s } = await supabase
      .from("yoga_sessions")
      .select("id, title, address, city, starts_at, duration_min, status, instructor_id, instructor_name")
      .eq("id", sessionId)
      .maybeSingle();
    if (s) {
      session = {
        id: s.id,
        title: s.title,
        address: s.address,
        city: s.city,
        starts_at: s.starts_at,
        duration_min: s.duration_min,
        status: s.status as YogaSessionStatus,
      };
      if (s.instructor_id) {
        const { data: pro } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", s.instructor_id)
          .maybeSingle();
        if (pro) instructor = { id: pro.id, full_name: pro.full_name, avatar_url: pro.avatar_url };
      } else if (s.instructor_name) {
        instructor = { id: "", full_name: s.instructor_name, avatar_url: null };
      }
    }
  }

  return {
    booking_id: booking.id,
    booking_status: booking.status as YogaBookingDetails["booking_status"],
    final_price_mad: booking.final_price_mad,
    cancel_reason: booking.cancel_reason,
    cancelled_at: booking.cancelled_at,
    session,
    instructor,
    payment: paymentRes.data ? { status: paymentRes.data.status, amount_mad: paymentRes.data.amount_mad } : null,
  };
}

// ── Patient self-service cancellation ───────────────────────────────────────
export async function cancelYogaBooking(
  bookingId: UUID,
): Promise<{ eligible: boolean; refund_mad: number; had_payment: boolean }> {
  const { data, error } = await supabase.rpc("cancel_yoga_booking", { p_booking_id: bookingId });
  if (error) throw error;
  return data as { eligible: boolean; refund_mad: number; had_payment: boolean };
}

// ── Admin: create / list / manage classes ───────────────────────────────────
export type NewYogaSession = {
  title: string;
  description?: string | null;
  instructor_id: UUID;
  address: string;
  city: string;
  starts_at: string; // ISO
  duration_min: number;
  capacity: number;
  price_mad: number;
  level?: string;
  image_url?: string | null;
};

export async function createYogaSession(input: NewYogaSession): Promise<YogaSession> {
  // instructor_name is a denormalized snapshot (the column the live catalog
  // still falls back to for legacy rows) — keep it in sync at creation time.
  const { data: instructor } = await supabase.from("profiles").select("full_name").eq("id", input.instructor_id).maybeSingle();
  return unwrap(
    await supabase
      .from("yoga_sessions")
      .insert({
        title: input.title,
        description: input.description ?? null,
        instructor_id: input.instructor_id,
        instructor_name: instructor?.full_name ?? null,
        address: input.address,
        city: input.city,
        starts_at: input.starts_at,
        duration_min: input.duration_min,
        capacity: input.capacity,
        price_mad: input.price_mad,
        level: input.level ?? "Tous niveaux",
        image_url: input.image_url ?? null,
        status: "scheduled",
      })
      .select("*")
      .single(),
  );
}

export async function listAdminSessions(): Promise<YogaCatalogEntry[]> {
  const { data: sessions, error } = await supabase
    .from("yoga_sessions")
    .select("*")
    .order("starts_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (sessions ?? []) as YogaSession[];
  if (rows.length === 0) return [];
  const ids = rows.map((s) => s.id);
  const { data: enrollments } = await supabase.from("yoga_enrollments").select("session_id").in("session_id", ids);
  const countBySession = new Map<string, number>();
  for (const e of enrollments ?? []) countBySession.set(e.session_id, (countBySession.get(e.session_id) ?? 0) + 1);
  return rows.map((s) => ({
    ...s,
    instructorDisplayName: s.instructor_name ?? "Instructeur",
    instructorAvatarUrl: null,
    enrolledCount: countBySession.get(s.id) ?? 0,
    spotsLeft: Math.max(0, s.capacity - (countBySession.get(s.id) ?? 0)),
  }));
}

export async function completeYogaSession(sessionId: UUID): Promise<void> {
  const { error } = await supabase.rpc("complete_yoga_session", { p_session_id: sessionId });
  if (error) throw error;
}

export async function cancelYogaSession(sessionId: UUID, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_yoga_session", { p_session_id: sessionId, p_reason: reason ?? null });
  if (error) throw error;
}

export async function listYogaInstructors(): Promise<{ id: UUID; full_name: string }[]> {
  const { data: pros, error } = await supabase.from("professionals").select("id").eq("specialty", "yoga_instructor");
  if (error) throw error;
  const ids = (pros ?? []).map((p) => p.id);
  if (!ids.length) return [];
  const { data: profs, error: profErr } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (profErr) throw profErr;
  return (profs ?? []) as { id: UUID; full_name: string }[];
}
