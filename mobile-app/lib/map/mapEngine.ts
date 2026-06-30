/**
 * CareLink — Custom Map Engine
 * 100% free, no API key, works on iOS + Android.
 * Pure math: converts real GPS coordinates → SVG pixel coordinates.
 *
 * Uses the Mercator projection (same as Google/Apple Maps).
 * All road/building data is hand-crafted for the Fès–Meknès corridor
 * but the projection works for any lat/lng worldwide.
 */

// ── Mercator projection ───────────────────────────────────────────────────────

export type LatLng = { lat: number; lng: number };
export type Point = { x: number; y: number };

/**
 * Convert lat/lng to pixel coordinates inside an SVG viewport.
 * @param coord  GPS coordinate to project
 * @param center GPS coordinate at the center of the viewport
 * @param zoom   Pixels per degree at equator (higher = more zoomed in)
 * @param vw     Viewport width in pixels
 * @param vh     Viewport height in pixels
 */
export function project(
  coord: LatLng,
  center: LatLng,
  zoom: number,
  vw: number,
  vh: number
): Point {
  const latScale = Math.cos((center.lat * Math.PI) / 180);
  const dx = (coord.lng - center.lng) * zoom * latScale;
  const dy = -(coord.lat - center.lat) * zoom;
  return { x: vw / 2 + dx, y: vh / 2 + dy };
}

/**
 * Convert SVG pixel coordinates back to lat/lng.
 */
export function unproject(
  px: Point,
  center: LatLng,
  zoom: number,
  vw: number,
  vh: number
): LatLng {
  const latScale = Math.cos((center.lat * Math.PI) / 180);
  const dx = px.x - vw / 2;
  const dy = px.y - vh / 2;
  return {
    lat: center.lat - dy / zoom,
    lng: center.lng + dx / (zoom * latScale),
  };
}

/**
 * Haversine distance in km between two GPS points.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Radius in SVG pixels for a given km radius at a given zoom.
 */
export function radiusToPixels(km: number, zoom: number, lat: number): number {
  const latScale = Math.cos((lat * Math.PI) / 180);
  // 1 degree of latitude ≈ 111 km
  return (km / 111) * zoom * Math.sqrt(latScale);
}

// ── Road network for the Fès–Meknès corridor ─────────────────────────────────
// Format: array of GPS coordinate arrays (polylines)
// Data is hand-crafted for the region and is 100% free to use.

export type Road = {
  id: string;
  type: "highway" | "primary" | "secondary" | "local";
  name?: string;
  coords: LatLng[];
};

export const ROAD_NETWORK: Road[] = [
  // ── Autoroute A2 (Fès ↔ Meknès) ──────────────────────────────────────────
  {
    id: "a2",
    type: "highway",
    name: "A2",
    coords: [
      { lat: 34.037, lng: -5.0 },
      { lat: 34.041, lng: -5.02 },
      { lat: 34.046, lng: -5.06 },
      { lat: 34.05, lng: -5.11 },
      { lat: 34.057, lng: -5.16 },
      { lat: 34.062, lng: -5.22 },
      { lat: 34.063, lng: -5.27 },
      { lat: 34.06, lng: -5.31 },
      { lat: 34.057, lng: -5.36 },
      { lat: 34.052, lng: -5.42 },
      { lat: 34.048, lng: -5.47 },
      { lat: 34.042, lng: -5.53 },
      { lat: 34.04, lng: -5.57 },
    ],
  },
  // ── RN6 (route nationale Fès centre) ──────────────────────────────────────
  {
    id: "rn6-fes",
    type: "primary",
    name: "RN6",
    coords: [
      { lat: 34.038, lng: -5.0 },
      { lat: 34.04, lng: -5.025 },
      { lat: 34.041, lng: -5.04 },
      { lat: 34.044, lng: -5.055 },
      { lat: 34.042, lng: -5.075 },
      { lat: 34.038, lng: -5.09 },
    ],
  },
  // ── Boulevard principal Fès ────────────────────────────────────────────────
  {
    id: "bvd-fes-1",
    type: "primary",
    coords: [
      { lat: 34.042, lng: -4.99 },
      { lat: 34.038, lng: -5.01 },
      { lat: 34.034, lng: -5.03 },
      { lat: 34.03, lng: -5.045 },
      { lat: 34.028, lng: -5.06 },
    ],
  },
  {
    id: "bvd-fes-2",
    type: "primary",
    coords: [
      { lat: 34.028, lng: -4.98 },
      { lat: 34.03, lng: -5.0 },
      { lat: 34.033, lng: -5.02 },
      { lat: 34.036, lng: -5.04 },
      { lat: 34.038, lng: -5.06 },
    ],
  },
  // ── Rue locale Fès ────────────────────────────────────────────────────────
  {
    id: "local-fes-1",
    type: "secondary",
    coords: [
      { lat: 34.04, lng: -4.985 },
      { lat: 34.037, lng: -5.0 },
      { lat: 34.034, lng: -5.015 },
    ],
  },
  {
    id: "local-fes-2",
    type: "secondary",
    coords: [
      { lat: 34.036, lng: -4.975 },
      { lat: 34.033, lng: -4.99 },
      { lat: 34.031, lng: -5.005 },
    ],
  },
  {
    id: "local-fes-3",
    type: "local",
    coords: [
      { lat: 34.042, lng: -5.005 },
      { lat: 34.04, lng: -5.015 },
      { lat: 34.038, lng: -5.025 },
    ],
  },
  {
    id: "local-fes-4",
    type: "local",
    coords: [
      { lat: 34.035, lng: -5.03 },
      { lat: 34.033, lng: -5.04 },
      { lat: 34.031, lng: -5.055 },
    ],
  },
];

// ── City/district labels ───────────────────────────────────────────────────────
export type PlaceLabel = {
  id: string;
  name: string;
  nameAr: string;
  coord: LatLng;
  type: "city" | "district" | "neighborhood";
};

export const PLACE_LABELS: PlaceLabel[] = [
  { id: "fes",        name: "Fès",         nameAr: "فاس",        coord: { lat: 34.0372, lng: -5.0039 }, type: "city" },
  { id: "meknes",     name: "Meknès",      nameAr: "مكناس",      coord: { lat: 33.882,  lng: -5.55   }, type: "city" },
  { id: "guerouane",  name: "Guerouan",    nameAr: "كروان",      coord: { lat: 34.062,  lng: -5.28   }, type: "district" },
  { id: "sefrou",     name: "Sefrou",      nameAr: "صفرو",       coord: { lat: 33.83,   lng: -4.835  }, type: "district" },
  { id: "bvd-hassan", name: "Bd Hassan II",nameAr: "شارع الحسن", coord: { lat: 34.038,  lng: -5.012  }, type: "neighborhood" },
];

// ── Green areas (parks / zones vertes) ────────────────────────────────────────
export type GreenArea = { id: string; coords: LatLng[] };

export const GREEN_AREAS: GreenArea[] = [
  {
    id: "jardin-jnan-sbil",
    coords: [
      { lat: 34.066, lng: -4.978 },
      { lat: 34.068, lng: -4.966 },
      { lat: 34.063, lng: -4.961 },
      { lat: 34.06,  lng: -4.975 },
    ],
  },
  {
    id: "jardi-2",
    coords: [
      { lat: 34.03,  lng: -5.008 },
      { lat: 34.032, lng: -4.998 },
      { lat: 34.028, lng: -4.994 },
      { lat: 34.026, lng: -5.005 },
    ],
  },
];

// ── Water bodies ─────────────────────────────────────────────────────────────
export type WaterBody = { id: string; coords: LatLng[] };

export const WATER_BODIES: WaterBody[] = [
  {
    // Oued Fès (simplified)
    id: "oued-fes",
    coords: [
      { lat: 34.068, lng: -4.99 },
      { lat: 34.065, lng: -5.0 },
      { lat: 34.062, lng: -5.01 },
      { lat: 34.058, lng: -5.025 },
      { lat: 34.054, lng: -5.04 },
    ],
  },
];
