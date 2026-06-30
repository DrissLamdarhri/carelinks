/**
 * CareLink — CareLinkMapCanvas
 * ────────────────────────────────────────────────────────────────────────────
 * Pure SVG map background. Renders the warm-cream (#EDE5CC) land, white
 * streets, water, green parks, and Arabic/French bilingual labels.
 * No API key. No external tiles. 100% free.
 *
 * Tap anywhere → calls onPress(lat, lng) via Mercator back-projection.
 */

import React, { useCallback, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";

export type LatLng = { lat: number; lng: number };

// ── Mercator projection ───────────────────────────────────────────────────────
const DEFAULT_CENTER: LatLng = { lat: 34.037, lng: -5.004 }; // Fès centre
const DEFAULT_ZOOM   = 8200;

function project(coord: LatLng, center: LatLng, zoom: number, vw: number, vh: number) {
  const latScale = Math.cos((center.lat * Math.PI) / 180);
  return {
    x: vw / 2 + (coord.lng - center.lng) * zoom * latScale,
    y: vh / 2 - (coord.lat - center.lat) * zoom,
  };
}

function unproject(px: {x:number;y:number}, center: LatLng, zoom: number, vw: number, vh: number): LatLng {
  const latScale = Math.cos((center.lat * Math.PI) / 180);
  return {
    lat: center.lat + (vh / 2 - px.y) / zoom,
    lng: center.lng + (px.x - vw / 2) / (zoom * latScale),
  };
}

function coordsToPath(coords: LatLng[], center: LatLng, zoom: number, vw: number, vh: number) {
  return coords
    .map((c, i) => {
      const p = project(c, center, zoom, vw, vh);
      return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join(" ");
}

export function haversineKm(a: LatLng, b: LatLng) {
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

export function radiusToPixels(km: number, zoom: number, lat: number) {
  const latScale = Math.cos((lat * Math.PI) / 180);
  return (km / 111) * zoom * Math.sqrt(latScale);
}

// ── Road network (Fès–Meknès corridor) ───────────────────────────────────────
type RoadType = "highway" | "primary" | "secondary" | "local";

const ROADS: { id: string; type: RoadType; coords: LatLng[] }[] = [
  {
    id: "a2", type: "highway",
    coords: [
      { lat: 34.037, lng: -5.0 }, { lat: 34.046, lng: -5.06 },
      { lat: 34.062, lng: -5.22 }, { lat: 34.057, lng: -5.36 },
      { lat: 34.042, lng: -5.53 },
    ],
  },
  {
    id: "rn6", type: "primary",
    coords: [
      { lat: 34.038, lng: -5.0  }, { lat: 34.044, lng: -5.055 },
      { lat: 34.038, lng: -5.09 },
    ],
  },
  {
    id: "bvd1", type: "primary",
    coords: [
      { lat: 34.042, lng: -4.99  }, { lat: 34.034, lng: -5.03 },
      { lat: 34.028, lng: -5.06  },
    ],
  },
  {
    id: "bvd2", type: "primary",
    coords: [
      { lat: 34.028, lng: -4.98  }, { lat: 34.033, lng: -5.02 },
      { lat: 34.038, lng: -5.06  },
    ],
  },
  {
    id: "sec1", type: "secondary",
    coords: [
      { lat: 34.04,  lng: -4.985 }, { lat: 34.037, lng: -5.0  },
      { lat: 34.034, lng: -5.015 },
    ],
  },
  {
    id: "sec2", type: "secondary",
    coords: [
      { lat: 34.036, lng: -4.975 }, { lat: 34.031, lng: -5.005 },
    ],
  },
  {
    id: "loc1", type: "local",
    coords: [
      { lat: 34.042, lng: -5.005 }, { lat: 34.038, lng: -5.025 },
    ],
  },
  {
    id: "loc2", type: "local",
    coords: [
      { lat: 34.035, lng: -5.03  }, { lat: 34.031, lng: -5.055 },
    ],
  },
  {
    id: "loc3", type: "local",
    coords: [
      { lat: 34.033, lng: -4.99  }, { lat: 34.029, lng: -5.012 },
    ],
  },
];

const ROAD_STYLE: Record<RoadType, { casing: string; casingW: number; fill: string; fillW: number }> = {
  highway:   { casing: "#C8BAA0", casingW: 6,   fill: "#FFFFFF", fillW: 4   },
  primary:   { casing: "#C8BAA0", casingW: 4.5, fill: "#FFFFFF", fillW: 2.8 },
  secondary: { casing: "#D4C8B0", casingW: 3,   fill: "#F4EDDA", fillW: 1.8 },
  local:     { casing: "#D4C8B0", casingW: 2,   fill: "#EBE1CC", fillW: 1.2 },
};

// ── Green areas ───────────────────────────────────────────────────────────────
const GREENS: LatLng[][] = [
  [
    { lat: 34.066, lng: -4.978 }, { lat: 34.068, lng: -4.966 },
    { lat: 34.063, lng: -4.961 }, { lat: 34.06,  lng: -4.975 },
  ],
  [
    { lat: 34.03,  lng: -5.008 }, { lat: 34.032, lng: -4.998 },
    { lat: 34.028, lng: -4.994 }, { lat: 34.026, lng: -5.005 },
  ],
];

// ── Water ─────────────────────────────────────────────────────────────────────
const WATERS: LatLng[][] = [
  [
    { lat: 34.068, lng: -4.99  }, { lat: 34.065, lng: -5.0   },
    { lat: 34.062, lng: -5.01  }, { lat: 34.058, lng: -5.025 },
    { lat: 34.054, lng: -5.04  },
  ],
];

// ── City labels ───────────────────────────────────────────────────────────────
const LABELS = [
  { name: "Bd Hassan II", ar: "شارع الحسن الثاني", coord: { lat: 34.042, lng: -5.012 }, size: 8, weight: "700" as const },
  { name: "Fès Médina",   ar: "مدينة فاس",          coord: { lat: 34.034, lng: -5.0   }, size: 9, weight: "700" as const },
  { name: "Agdal",        ar: "أكدال",              coord: { lat: 34.028, lng: -4.99  }, size: 8, weight: "600" as const },
  { name: "Atlas",        ar: "أطلس",               coord: { lat: 34.022, lng: -5.01  }, size: 8, weight: "600" as const },
];

// ── Component ─────────────────────────────────────────────────────────────────
type Props = {
  center?: LatLng;
  markerCoord?: LatLng;
  radiusKm?: number;
  primaryColor?: string;
  onPress?: (coord: LatLng) => void;
  height?: number;
  showRadius?: boolean;
};

export function CareLinkMapCanvas({
  center,
  markerCoord,
  radiusKm = 5,
  primaryColor = "#0D0870",
  onPress,
  height = 260,
  showRadius = true,
}: Props) {
  const [size, setSize] = useState({ w: 375, h: height });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    if (width > 0 && h > 0) setSize({ w: width, h: h });
  }, []);

  const { w: vw, h: vh } = size;
  const mapCenter = center ?? markerCoord ?? DEFAULT_CENTER;
  const zoom      = DEFAULT_ZOOM;

  const proj = useCallback(
    (c: LatLng) => project(c, mapCenter, zoom, vw, vh),
    [mapCenter, zoom, vw, vh]
  );

  const handlePress = useCallback(
    (e: any) => {
      if (!onPress) return;
      const { locationX, locationY } = e.nativeEvent ?? {};
      if (locationX == null) return;
      onPress(unproject({ x: locationX, y: locationY }, mapCenter, zoom, vw, vh));
    },
    [onPress, mapCenter, zoom, vw, vh]
  );

  const markerPt = markerCoord ? proj(markerCoord) : { x: vw / 2, y: vh / 2 };
  const rPx      = radiusToPixels(radiusKm, zoom, mapCenter.lat);

  // Paths
  const greenPaths = GREENS.map((g) => coordsToPath(g, mapCenter, zoom, vw, vh) + " Z");
  const waterPaths = WATERS.map((w) => coordsToPath(w, mapCenter, zoom, vw, vh));

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      <Svg
        width={vw}
        height={vh}
        onPress={onPress ? handlePress : undefined}
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          <ClipPath id="mapBounds">
            <Rect x={0} y={0} width={vw} height={vh} />
          </ClipPath>
        </Defs>

        {/* ── Land ── */}
        <Rect x={0} y={0} width={vw} height={vh} fill="#EDE5CC" />

        {/* ── Subtle depth — slightly warmer patch centre ── */}
        <Rect x={vw*0.2} y={vh*0.2} width={vw*0.6} height={vh*0.6} fill="#E8DFC6" rx={80} />

        {/* ── Water ── */}
        {waterPaths.map((d, i) => (
          <Path key={`w${i}`} d={d} fill="none"
            stroke="#B2D5E6" strokeWidth={8} strokeLinecap="round" />
        ))}

        {/* ── Green areas ── */}
        {greenPaths.map((d, i) => (
          <Path key={`g${i}`} d={d} fill="#CDDEC8" stroke="#B8CCAA" strokeWidth={0.8} />
        ))}

        {/* ── Road casings (drawn before fills for correct layering) ── */}
        {(["local","secondary","primary","highway"] as RoadType[]).map((type) =>
          ROADS.filter((r) => r.type === type).map((r) => (
            <Path
              key={`rc-${r.id}`}
              d={coordsToPath(r.coords, mapCenter, zoom, vw, vh)}
              fill="none"
              stroke={ROAD_STYLE[type].casing}
              strokeWidth={ROAD_STYLE[type].casingW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        )}

        {/* ── Road fills ── */}
        {(["local","secondary","primary","highway"] as RoadType[]).map((type) =>
          ROADS.filter((r) => r.type === type).map((r) => (
            <Path
              key={`rf-${r.id}`}
              d={coordsToPath(r.coords, mapCenter, zoom, vw, vh)}
              fill="none"
              stroke={ROAD_STYLE[type].fill}
              strokeWidth={ROAD_STYLE[type].fillW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        )}

        {/* ── City labels ── */}
        {LABELS.map((lbl) => {
          const pt = proj(lbl.coord);
          if (pt.x < 0 || pt.x > vw || pt.y < 0 || pt.y > vh) return null;
          return (
            <React.Fragment key={lbl.name}>
              {/* White halo for legibility */}
              <SvgText
                x={pt.x} y={pt.y}
                fontSize={lbl.size} fontWeight={lbl.weight}
                fill="#EDE5CC" stroke="#EDE5CC" strokeWidth={3}
                textAnchor="middle"
              >{lbl.name}</SvgText>
              {/* Label */}
              <SvgText
                x={pt.x} y={pt.y}
                fontSize={lbl.size} fontWeight={lbl.weight}
                fill="#0D0870" fillOpacity={0.55}
                textAnchor="middle"
              >{lbl.name}</SvgText>
              {/* Arabic subtitle */}
              <SvgText
                x={pt.x} y={pt.y + lbl.size + 2}
                fontSize={lbl.size - 1}
                fill="#0D0870" fillOpacity={0.28}
                textAnchor="middle"
              >{lbl.ar}</SvgText>
            </React.Fragment>
          );
        })}

        {/* ── Radius dashed ring ── */}
        {showRadius && (
          <>
            <Circle
              cx={markerPt.x} cy={markerPt.y} r={rPx}
              fill={`${primaryColor}07`}
            />
            <Circle
              cx={markerPt.x} cy={markerPt.y} r={rPx}
              fill="none"
              stroke={primaryColor}
              strokeWidth={1.5}
              strokeDasharray="7 6"
              strokeOpacity={0.4}
            />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#EDE5CC",
  },
});
