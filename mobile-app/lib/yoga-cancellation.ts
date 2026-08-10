/**
 * Client-side mirror of the 24h yoga refund rule — for immediate UX only
 * (the confirmation copy shown before a patient taps "confirm"). The real
 * source of truth is `public.can_refund_yoga_booking()` / the check inside
 * `public.cancel_yoga_booking()` (migration 0041) — this function must never
 * be trusted alone to decide whether money actually moves.
 */
export function isRefundEligible(sessionStartTime: string): boolean {
  const startMs = new Date(sessionStartTime).getTime();
  if (Number.isNaN(startMs)) return true;
  const hoursUntilStart = (startMs - Date.now()) / (1000 * 60 * 60);
  return hoursUntilStart >= 24;
}
