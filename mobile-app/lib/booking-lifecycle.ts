/**
 * CareLink — when is a booking still alive?
 * ────────────────────────────────────────────────────────────────────────────
 * The database has a definitive answer to this and the app kept inventing its
 * own. `settle_stale_bookings()` (migration 0027, finally scheduled in 0053)
 * sweeps hourly:
 *
 *   • matched / en_route older than the grace period → cancelled, patient refunded
 *   • in_progress older than the grace period        → completed, professional paid
 *
 * Age is measured from `scheduled_at ?? created_at`, so a visit booked for next
 * week is never in scope — only ones whose moment has demonstrably passed.
 *
 * Between two sweeps a dead booking is still sitting there with a live-looking
 * status, and the professional's home screen was rendering it as a mission to
 * drive to: a blue "Mission en cours" card pointing at a patient seen days ago,
 * and an "À venir" pill on a job nobody was ever going to do. Reported from the
 * field as "the card is stuck there" and "I still see 'à venir' for missions we
 * didn't finish".
 *
 * The fix is not a second, cleverer definition of staleness in the UI — that is
 * how a screen ends up disagreeing with the database. It is the SAME rule,
 * applied one hour earlier, in one place.
 */
import type { Booking, BookingStatus } from "@/lib/db/types";

/** Mirrors the argument to `settle_stale_bookings(48)`. Keep the two in step. */
export const STALE_MISSION_MS = 48 * 60 * 60 * 1000;

/** Statuses in which a professional is expected to act on a booking. */
const ACTIVE: ReadonlySet<BookingStatus> = new Set(["matched", "en_route", "in_progress"]);

type Timed = Pick<Booking, "scheduled_at" | "created_at">;

/**
 * False once the server would have swept this booking. A booking with no
 * timestamp at all is given the benefit of the doubt — hiding a real mission is
 * worse than briefly showing a dead one.
 */
export function isMissionLive(b: Timed, now = Date.now()): boolean {
  const since = b.scheduled_at ?? b.created_at;
  if (!since) return true;
  const t = new Date(since).getTime();
  if (!Number.isFinite(t)) return true;
  return now - t < STALE_MISSION_MS;
}

/** The one booking the professional should be working on, if any. */
export function findActiveMission<T extends Booking>(bookings: readonly T[], now = Date.now()): T | null {
  return bookings.find((b) => ACTIVE.has(b.status) && isMissionLive(b, now)) ?? null;
}

/** True when nothing more will happen to this booking — including the dead-but-
 *  not-yet-swept case, which is history even though the row disagrees. */
export function isTerminal(b: Booking, now = Date.now()): boolean {
  return b.status === "completed" || b.status === "cancelled" || !isMissionLive(b, now);
}

/** i18n key for the status pill. Never returns "upcoming" for a dead booking. */
export function statusLabelKey(b: Booking, now = Date.now()): string {
  if (b.status === "completed") return "status_completed";
  if (b.status === "cancelled") return "status_cancelled";
  if (!isMissionLive(b, now)) return "status_expired";
  if (b.status === "in_progress") return "status_in_progress";
  if (b.status === "en_route") return "en_route_to_patient";
  return "tab_upcoming";
}
