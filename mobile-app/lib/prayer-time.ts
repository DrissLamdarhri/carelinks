/**
 * Maghrib (sunset) time — used to switch the tracking map to its dark style
 * after Maghrib instead of a fixed clock hour. Maghrib begins at sunset (sun
 * center 0.833° below the horizon, the same standard "official sunset" angle
 * used everywhere from prayer-time calculators to the NOAA solar calculator),
 * so a standard solar-position formula is all that's needed — no external API.
 *
 * Morocco spans one timezone and only ~12° of longitude, so a single
 * reference point (Fès, matching the MAP_CENTER fallback already used across
 * the tracking screens) is accurate to within a few minutes anywhere in the
 * country — plenty for a cosmetic map-theme switch.
 */
const DEFAULT_LAT = 34.037;
const DEFAULT_LNG = -5.004;
const SUNSET_ZENITH_DEG = 90.833;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86400000);
}

/** NOAA solar position approximation — returns { sunriseUtcMin, sunsetUtcMin }
 *  as minutes-from-UTC-midnight for the given date + location. */
function solarUtcMinutes(lat: number, lng: number, date: Date): { sunriseUtcMin: number; sunsetUtcMin: number } {
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear(date) - 1 + 12 / 24);

  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = toRad(lat);
  const zenithRad = toRad(SUNSET_ZENITH_DEG);
  const cosHa = Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(decl)) - Math.tan(latRad) * Math.tan(decl);
  const haDeg = toDeg(Math.acos(Math.max(-1, Math.min(1, cosHa))));

  const solarNoonUtcMin = 720 - 4 * lng - eqtime;
  return {
    sunriseUtcMin: solarNoonUtcMin - 4 * haDeg,
    sunsetUtcMin: solarNoonUtcMin + 4 * haDeg,
  };
}

/** True between sunrise and Maghrib (sunset) at the given point/time. */
export function isDaytime(lat = DEFAULT_LAT, lng = DEFAULT_LNG, date: Date = new Date()): boolean {
  const { sunriseUtcMin, sunsetUtcMin } = solarUtcMinutes(lat, lng, date);
  const nowUtcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  return nowUtcMin >= sunriseUtcMin && nowUtcMin < sunsetUtcMin;
}

/** True from Maghrib (sunset) until the following sunrise. */
export function isAfterMaghrib(lat = DEFAULT_LAT, lng = DEFAULT_LNG, date: Date = new Date()): boolean {
  return !isDaytime(lat, lng, date);
}
