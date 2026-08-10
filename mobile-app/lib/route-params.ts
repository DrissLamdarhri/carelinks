/**
 * Expo Router gives dynamic segments as `string | string[]` — an array when the
 * same key appears more than once. Every screen that reads `[bookingId]` needs
 * the same one-line normalisation, so it lives here.
 *
 * (This used to sit in `lib/demo-booking.ts` purely because that file existed
 * first. It has nothing to do with demo data, and outlived it.)
 */
export function normalizeRouteParam(value: string | string[] | undefined | null): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}
