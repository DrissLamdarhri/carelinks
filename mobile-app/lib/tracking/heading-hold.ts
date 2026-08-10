/**
 * CareLink — which heading the professional's own marker should point at.
 * ────────────────────────────────────────────────────────────────────────────
 * One decision, isolated so it can be asserted rather than eyeballed.
 *
 * The motion pipeline reports `moving: false` below 0.4 m/s, and in stop-start
 * city traffic that is true for most of a trip. The marker therefore spent most
 * of the field recording as a plain dot: correct — a direction indicator on a
 * stationary vehicle points nowhere meaningful — but it meant the professional
 * almost never saw the navigation-style arrow.
 *
 * Holding the last heading through a stop is what navigation products do, and
 * it composes with the Phase 2 course-up camera: while stopped, both the map
 * rotation and the arrow freeze together, so the arrow keeps pointing up the
 * screen instead of swapping shape at every red light.
 *
 * The staleness is bounded and self-correcting — the very first moving sample
 * replaces it. The alternative (null while stopped) is not "more honest", it
 * just trades a briefly stale direction for a shape change mid-drive, which is
 * the more distracting of the two.
 *
 * Pure and stateless: the caller owns the previous value. No React, no store.
 */

/**
 * The heading to draw, given the previous one and the current sample.
 *
 *  • moving        → the live bearing, immediately. No easing, no lag: the
 *                    pipeline has already smoothed and rate-limited it.
 *  • stopped       → whatever was last shown, including null before the first
 *                    movement of a trip (nothing to hold yet — draw the dot).
 */
export function holdHeading(
  previous: number | null,
  sample: { bearing: number; moving: boolean } | null,
): number | null {
  if (!sample) return previous;
  return sample.moving ? sample.bearing : previous;
}
