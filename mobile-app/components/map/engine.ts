/**
 * CareLink Map Engine
 * Pure math — no dependencies. Mercator projection, road data, label data.
 * Ported from carelinks_map_enhanced.jsx → typed TypeScript for React Native.
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type LatLng = { lat: number; lng: number };
export type Point  = { x: number; y: number };
export type Offset = { x: number; y: number };

// ── Brand ─────────────────────────────────────────────────────────────────────
export const NAVY  = "#0D0870";
export const CREAM = "#EDE5CC";
export const CYAN  = "#5BB8D4";
export const GREEN = "#22C55E";

// ── Projection ────────────────────────────────────────────────────────────────
export const MAP_CENTER: LatLng = { lat: 34.037, lng: -5.004 };
export const DEFAULT_ZOOM = 7500;

export function project(
  coord: LatLng,
  center: LatLng,
  zoom: number,
  vw: number,
  vh: number
): Point {
  const latScale = Math.cos((center.lat * Math.PI) / 180);
  return {
    x: vw / 2 + (coord.lng - center.lng) * zoom * latScale,
    y: vh / 2 - (coord.lat - center.lat) * zoom,
  };
}

export function unproject(
  px: Point,
  center: LatLng,
  zoom: number,
  vw: number,
  vh: number
): LatLng {
  const latScale = Math.cos((center.lat * Math.PI) / 180);
  return {
    lat: center.lat - (px.y - vh / 2) / zoom,
    lng: center.lng + (px.x - vw / 2) / (zoom * latScale),
  };
}

/** Effective map center accounting for pan offset */
export function centerWithOffset(offset: Offset, zoom = DEFAULT_ZOOM): LatLng {
  const latScale = Math.cos((MAP_CENTER.lat * Math.PI) / 180);
  return {
    lat: MAP_CENTER.lat - offset.y / zoom,
    lng: MAP_CENTER.lng + offset.x / (zoom * latScale),
  };
}

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

export function radiusToPixels(km: number, zoom: number, lat: number): number {
  return (km / 111) * zoom * Math.cos((lat * Math.PI) / 180);
}

// ── SVG path builder ─────────────────────────────────────────────────────────
/** [lng, lat] tuples → SVG path string */
export function toSvgPath(
  pts: [number, number][],
  center: LatLng,
  zoom: number,
  vw: number,
  vh: number,
  close = false
): string {
  const projected = pts.map(([lng, lat]) =>
    project({ lat, lng }, center, zoom, vw, vh)
  );
  const d = projected
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  return close ? d + " Z" : d;
}

// ── Road network ──────────────────────────────────────────────────────────────
export type RoadType = "highway" | "primary" | "secondary" | "local";

export type Road = {
  id: string;
  type: RoadType;
  pts: [number, number][]; // [lng, lat]
};

export const ROADS: Road[] = [
  { id: "a2",  type: "highway",   pts: [[-5.00,34.037],[-5.02,34.041],[-5.06,34.046],[-5.11,34.050],[-5.16,34.057],[-5.22,34.062],[-5.27,34.063]] },
  { id: "rn6", type: "primary",   pts: [[-5.00,34.038],[-5.025,34.040],[-5.04,34.041],[-5.055,34.044],[-5.075,34.042],[-5.09,34.038]] },
  { id: "bv1", type: "primary",   pts: [[-4.99,34.042],[-5.01,34.038],[-5.03,34.034],[-5.045,34.030],[-5.06,34.028]] },
  { id: "bv2", type: "primary",   pts: [[-4.98,34.028],[-5.00,34.030],[-5.02,34.033],[-5.04,34.036],[-5.06,34.038]] },
  { id: "lf1", type: "secondary", pts: [[-4.985,34.040],[-5.00,34.037],[-5.015,34.034]] },
  { id: "lf2", type: "secondary", pts: [[-4.975,34.036],[-4.99,34.033],[-5.005,34.031]] },
  { id: "lf3", type: "local",     pts: [[-5.005,34.042],[-5.015,34.040],[-5.025,34.038]] },
  { id: "lf4", type: "local",     pts: [[-5.03,34.035],[-5.04,34.033],[-5.055,34.031]] },
  { id: "lf5", type: "local",     pts: [[-4.99,34.035],[-5.00,34.033],[-5.01,34.032],[-5.02,34.031]] },
  { id: "lf6", type: "secondary", pts: [[-5.01,34.044],[-5.02,34.042],[-5.03,34.040]] },
];

export const ROAD_STYLE: Record<RoadType, { casing: string; fill: string; cw: number; fw: number }> = {
  highway:   { casing: "#C8BAA0", fill: "#FFFFFF", cw: 5.5, fw: 4   },
  primary:   { casing: "#C8BAA0", fill: "#FFFFFF", cw: 4,   fw: 2.5 },
  secondary: { casing: "#D4C8B0", fill: "#F4EDDA", cw: 2.8, fw: 1.8 },
  local:     { casing: "#D4C8B0", fill: "#EBE1CC", cw: 2,   fw: 1.2 },
};

// ── Green areas & water ───────────────────────────────────────────────────────
export const GREENS: [number, number][][] = [
  [[-4.978,34.066],[-4.966,34.068],[-4.961,34.063],[-4.975,34.060]],
  [[-5.008,34.030],[-4.998,34.032],[-4.994,34.028],[-5.005,34.026]],
  [[-5.015,34.044],[-5.010,34.046],[-5.006,34.043],[-5.012,34.041]],
];

export const WATER_LINE: [number, number][] = [
  [-4.99,34.068],[-5.00,34.065],[-5.01,34.062],[-5.025,34.058],[-5.04,34.054],
];

// ── Labels ────────────────────────────────────────────────────────────────────
export type MapLabel = {
  name: string;
  nameAr: string;
  lat: number;
  lng: number;
  type: "city" | "district" | "neighborhood";
};

export const LABELS: MapLabel[] = [
  { name: "Fès",          nameAr: "فاس",        lat: 34.0372, lng: -5.0039, type: "city"         },
  { name: "Bd Hassan II", nameAr: "شارع الحسن", lat: 34.038,  lng: -5.012,  type: "neighborhood" },
  { name: "Agdal",        nameAr: "أكدال",      lat: 34.030,  lng: -5.025,  type: "district"     },
  { name: "Narjiss",      nameAr: "نرجس",       lat: 34.043,  lng: -4.998,  type: "district"     },
  { name: "Atlas",        nameAr: "أطلس",       lat: 34.033,  lng: -5.005,  type: "district"     },
];

// ── Specialty colors ──────────────────────────────────────────────────────────
export function specialtyColor(spec?: string | null): string {
  const s = (spec ?? "").toLowerCase();
  if (s.includes("infirm") || s.includes("nurse")) return NAVY;
  if (s.includes("kiné") || s.includes("kine") || s.includes("physio")) return "#065F46";
  if (s.includes("psy"))    return "#5B21B6";
  if (s.includes("yoga"))   return "#0891B2";
  if (s.includes("médecin") || s.includes("doctor")) return "#B45309";
  return CYAN;
}
