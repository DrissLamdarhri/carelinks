/**
 * Small vanilla-Date helpers shared by DateStrip / MonthCalendarModal and the
 * screens that scope their queries to a single day (pro missions, patient
 * appointments). No date library — the rest of the app already does its own
 * Date math (see pro/schedule.tsx's original groupOf/sectionize), this just
 * gives the calendar components one place to share it instead of duplicating.
 *
 * Weeks are Monday-first (the French/Moroccan convention used everywhere
 * else in the app, e.g. weekDays in pro-registration.tsx).
 */

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number): Date => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Monday of the week containing `d`. */
export const startOfWeek = (d: Date): Date => {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift Sunday to the END of the previous week
  return addDays(startOfDay(d), diff);
};

export const startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1);

/** "YYYY-MM-DD" in LOCAL time — the key used for marking/matching days. */
export const dateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** The date a booking should be filed under: its scheduled time, or when it
 *  was made if it has none (on-demand/urgent requests never get a scheduled_at). */
export const effectiveDate = (b: { scheduled_at: string | null; created_at: string }): Date =>
  new Date(b.scheduled_at ?? b.created_at);

/** 6 rows x 7 cols covering the full weeks that contain `month`'s days,
 *  Monday-first — the standard calendar-grid shape. */
export function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** Intl locale tag for a given app Locale — the rest of the app hardcodes
 *  "fr-MA" for date formatting everywhere; new calendar UI should not regress
 *  the EN/AR completeness just finished, so map explicitly instead. */
export function intlLocale(locale: string): string {
  if (locale === "ar") return "ar-MA";
  if (locale === "en") return "en-GB";
  return "fr-MA"; // fr, dar
}

export function friendlyDayLabel(
  d: Date,
  t: (k: string) => string,
  locale: string,
): string {
  if (isSameDay(d, new Date())) return t("today");
  if (isSameDay(d, addDays(new Date(), 1))) return t("tomorrow");
  if (isSameDay(d, addDays(new Date(), -1))) return t("yesterday");
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}
