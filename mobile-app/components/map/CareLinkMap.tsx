/**
 * CareLink — CareLinkMap  (custom_map + v3 design)
 * ──────────────────────────────────────────────────────────────────────────────
 * 100% free custom SVG map. No API key. No Google. No Apple Maps SDK.
 * Works on iOS and Android via react-native-svg + expo-location.
 *
 * Design: CareLink brand palette (navy #0D0870, warm cream #EDE5CC, cyan accent)
 * with a cartographic aesthetic — vignette, subtle grid, bilingual labels.
 *
 * Props:
 *   center          – GPS coordinate to center the map on
 *   zoom            – zoom level (pixels per degree, default 8000)
 *   markerCoord     – where the booking / patient pin is dropped
 *   proCoord        – optional: pro's live position (shown as moving dot)
 *   radiusKm        – search radius in km (drawn as dashed circle in booking mode)
 *   onPress         – called with lat/lng when user taps the map
 *   mode            – 'booking' | 'tracking'
 *   primaryColor    – override brand color
 *   height          – SVG height (default 280)
 *   hideBuiltInPin  – when true, skips the internal SVG pin so the parent can
 *                     render the animated v3 PatientPin overlay instead
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  GREEN_AREAS,
  PLACE_LABELS,
  ROAD_NETWORK,
  WATER_BODIES,
  haversineKm,
  project,
  radiusToPixels,
  unproject,
  type LatLng,
  type Point,
} from "../../lib/map/mapEngine";
import { Colors } from "@/lib/colors";

// ── Map palette (CareLink brand) ──────────────────────────────────────────────
const MAP = {
  bg:          "#EDE5CC", // warm cream — base land
  bgDeep:      "#E4D9BB", // slightly deeper for depth
  road: {
    highway:   { stroke: "#FFFFFF",  width: 4,   opacity: 1    },
    primary:   { stroke: "#FFFFFF",  width: 2.5, opacity: 0.9  },
    secondary: { stroke: "#F4EDDA",  width: 1.8, opacity: 0.85 },
    local:     { stroke: "#EBE1CC",  width: 1.2, opacity: 0.75 },
  },
  roadCasing: {
    highway:   { stroke: "#C8BAA0", width: 5.5 },
    primary:   { stroke: "#C8BAA0", width: 4   },
    secondary: { stroke: "#D4C8B0", width: 2.8 },
    local:     { stroke: "#D4C8B0", width: 2   },
  },
  water:       "#B8D9E8",
  waterStroke: "#A0C8D8",
  green:       "#CDDEC8",
  greenStroke: "#B8CCAA",
  label: {
    city:         "#0D0870",
    district:     "#4A4580",
    neighborhood: "#7A7490",
  },
  radius:     Colors.primary,
  radiusFill: "rgba(13,8,112,0.06)",
  pinOuter:   Colors.primary,
  pinInner:   "#FFFFFF",
  pinGlow:    "rgba(13,8,112,0.2)",
  proPin:     "#5BB8D4",
  proPinGlow: "rgba(91,184,212,0.25)",
  grid:       "rgba(13,8,112,0.04)",
  shadow:     "rgba(0,0,0,0.12)",
};

// ── SVG coordinate helpers ────────────────────────────────────────────────────
function coordsToPath(
  coords: LatLng[],
  center: LatLng,
  zoom: number,
  vw: number,
  vh: number
): string {
  if (coords.length === 0) return "";
  const pts = coords.map((c) => project(c, center, zoom, vw, vh));
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

function coordsToPolygon(
  coords: LatLng[],
  center: LatLng,
  zoom: number,
  vw: number,
  vh: number
): string {
  return coordsToPath(coords, center, zoom, vw, vh) + " Z";
}

// ── Built-in SVG pin (used in tracking mode / when hideBuiltInPin is false) ───
function MapPin(props: { cx: number; cy: number; color: string; glowColor: string; scale?: number }) {
  const { cx, cy, color, glowColor, scale = 1 } = props;
  const r     = 13 * scale;
  const bodyH = 28 * scale;
  const innerR = 5 * scale;
  const glowR  = 22 * scale;

  return (
    <G>
      <Circle cx={cx} cy={cy - r - (10 * scale) / 2} r={glowR} fill={glowColor} />
      <Path
        d={`
          M ${cx} ${cy}
          L ${cx - r * 0.55} ${cy - bodyH * 0.45}
          C ${cx - r} ${cy - bodyH * 0.5} ${cx - r} ${cy - bodyH * 0.85} ${cx} ${cy - bodyH}
          C ${cx + r} ${cy - bodyH * 0.85} ${cx + r} ${cy - bodyH * 0.5} ${cx + r * 0.55} ${cy - bodyH * 0.45}
          Z
        `}
        fill={color}
      />
      <Circle cx={cx} cy={cy - bodyH * 0.65} r={innerR} fill="#FFFFFF" opacity={0.95} />
    </G>
  );
}

// ── Pro moving dot (tracking mode) ────────────────────────────────────────────
function ProDot({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={18} fill={MAP.proPinGlow} />
      <Circle cx={x} cy={y} r={11} fill={MAP.proPin} />
      <Circle cx={x} cy={y} r={5}  fill="#FFFFFF" />
    </G>
  );
}

// ── Main map component ────────────────────────────────────────────────────────
type Mode = "booking" | "tracking";

export type CareLinkMapProps = {
  center?: LatLng;
  markerCoord?: LatLng;
  proCoord?: LatLng | null;
  radiusKm?: number;
  zoom?: number;
  onPress?: (coord: LatLng) => void;
  mode?: Mode;
  primaryColor?: string;
  height?: number;
  /** When true, the internal SVG patient pin is not drawn.
   *  Use this when the parent renders the animated v3 PatientPin overlay. */
  hideBuiltInPin?: boolean;
};

const DEFAULT_CENTER: LatLng = { lat: 34.037, lng: -5.004 }; // Fès centre
const DEFAULT_ZOOM = 8000;

export function CareLinkMap({
  center,
  markerCoord,
  proCoord = null,
  radiusKm = 5,
  zoom = DEFAULT_ZOOM,
  onPress,
  mode = "booking",
  primaryColor = Colors.primary,
  height = 280,
  hideBuiltInPin = false,
}: CareLinkMapProps) {
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 375, h: height });
  const hasLayout = useRef(false);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    if (width > 0 && h > 0) {
      setSize({ w: width, h: h });
      hasLayout.current = true;
    }
  }, []);

  const vw = size.w;
  const vh = size.h;

  const mapCenter: LatLng = center ?? markerCoord ?? DEFAULT_CENTER;

  const proj = useCallback(
    (coord: LatLng): Point => project(coord, mapCenter, zoom, vw, vh),
    [mapCenter, zoom, vw, vh]
  );

  const markerPt = markerCoord ? proj(markerCoord) : { x: vw / 2, y: vh / 2 };
  const proPt    = proCoord    ? proj(proCoord)    : null;
  const rPx      = useMemo(
    () => radiusToPixels(radiusKm, zoom, mapCenter.lat),
    [radiusKm, zoom, mapCenter.lat]
  );

  const handlePress = useCallback(
    (evt: any) => {
      if (!onPress) return;
      const { locationX, locationY } = evt.nativeEvent ?? {};
      if (locationX == null || locationY == null) return;
      onPress(unproject({ x: locationX, y: locationY }, mapCenter, zoom, vw, vh));
    },
    [onPress, mapCenter, zoom, vw, vh]
  );

  // ── Render SVG paths for each layer ──────────────────────────────────────────
  const waterPaths = WATER_BODIES.map((w) =>
    coordsToPolygon(w.coords, mapCenter, zoom, vw, vh)
  );
  const greenPaths = GREEN_AREAS.map((g) =>
    coordsToPolygon(g.coords, mapCenter, zoom, vw, vh)
  );
  const roadsByType = useMemo(
    () => ({
      highway:   ROAD_NETWORK.filter((r) => r.type === "highway"),
      primary:   ROAD_NETWORK.filter((r) => r.type === "primary"),
      secondary: ROAD_NETWORK.filter((r) => r.type === "secondary"),
      local:     ROAD_NETWORK.filter((r) => r.type === "local"),
    }),
    []
  );
  const roadPath = (road: typeof ROAD_NETWORK[0]) =>
    coordsToPath(road.coords, mapCenter, zoom, vw, vh);

  const labelPts = PLACE_LABELS.map((pl) => ({ ...pl, pt: proj(pl.coord) }));

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      <Svg
        width={vw}
        height={vh}
        onPress={onPress ? handlePress : undefined}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <ClipPath id="mapClip">
            <Rect x={0} y={0} width={vw} height={vh} />
          </ClipPath>
          {/* Subtle vignette for depth */}
          <RadialGradient id="vignette" cx="50%" cy="50%" r="75%">
            <Stop offset="60%" stopColor="transparent" stopOpacity={0} />
            <Stop offset="100%" stopColor="#C8BAAA"   stopOpacity={0.18} />
          </RadialGradient>
        </Defs>

        <G clipPath="url(#mapClip)">
          {/* ── Land base ────────────────────────────────────────────── */}
          <Rect x={0} y={0} width={vw} height={vh} fill={MAP.bg} />

          {/* Subtle grid (very faint) */}
          {Array.from({ length: 6 }).map((_, i) => (
            <Line
              key={`gl-${i}`}
              x1={0}  y1={(vh / 5) * i}
              x2={vw} y2={(vh / 5) * i}
              stroke={MAP.grid} strokeWidth={1}
            />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <Line
              key={`gv-${i}`}
              x1={(vw / 7) * i} y1={0}
              x2={(vw / 7) * i} y2={vh}
              stroke={MAP.grid} strokeWidth={1}
            />
          ))}

          {/* ── Water ────────────────────────────────────────────────── */}
          {waterPaths.map((d, i) => (
            <Path key={`w-${i}`} d={d} fill={MAP.water} stroke={MAP.waterStroke} strokeWidth={1} />
          ))}

          {/* ── Green areas ──────────────────────────────────────────── */}
          {greenPaths.map((d, i) => (
            <Path key={`g-${i}`} d={d} fill={MAP.green} stroke={MAP.greenStroke} strokeWidth={0.8} />
          ))}

          {/* ── Road casings (drawn first = below fills) ──────────────── */}
          {(["local", "secondary", "primary", "highway"] as const).map((type) =>
            roadsByType[type].map((r) => (
              <Path
                key={`rc-${r.id}`}
                d={roadPath(r)}
                fill="none"
                stroke={MAP.roadCasing[type].stroke}
                strokeWidth={MAP.roadCasing[type].width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
          )}

          {/* ── Road fills ───────────────────────────────────────────── */}
          {(["local", "secondary", "primary", "highway"] as const).map((type) =>
            roadsByType[type].map((r) => (
              <Path
                key={`rf-${r.id}`}
                d={roadPath(r)}
                fill="none"
                stroke={MAP.road[type].stroke}
                strokeWidth={MAP.road[type].width}
                strokeOpacity={MAP.road[type].opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
          )}

          {/* ── Place labels (bilingual) ──────────────────────────────── */}
          {labelPts.map((pl) => {
            const isVisible =
              pl.pt.x > -20 && pl.pt.x < vw + 20 &&
              pl.pt.y > -10 && pl.pt.y < vh + 10;
            if (!isVisible) return null;
            const color  = MAP.label[pl.type];
            const fSize  = pl.type === "city" ? 11 : pl.type === "district" ? 9 : 7.5;
            const weight = pl.type === "city" ? "700" : pl.type === "district" ? "600" : "400";
            return (
              <G key={`lbl-${pl.id}`}>
                {/* White halo for legibility */}
                <SvgText
                  x={pl.pt.x} y={pl.pt.y}
                  fontSize={fSize} fontWeight={weight}
                  fill="#EDE5CC" stroke="#EDE5CC" strokeWidth={3}
                  textAnchor="middle" opacity={0.9}
                >{pl.name}</SvgText>
                <SvgText
                  x={pl.pt.x} y={pl.pt.y}
                  fontSize={fSize} fontWeight={weight}
                  fill={color} textAnchor="middle"
                >{pl.name}</SvgText>
                {/* Arabic subtitle */}
                {pl.type !== "neighborhood" && (
                  <SvgText
                    x={pl.pt.x} y={pl.pt.y + fSize + 2}
                    fontSize={fSize - 1.5}
                    fill={color} textAnchor="middle" opacity={0.6}
                  >{pl.nameAr}</SvgText>
                )}
              </G>
            );
          })}

          {/* ── Vignette overlay ─────────────────────────────────────── */}
          <Rect x={0} y={0} width={vw} height={vh} fill="url(#vignette)" />

          {/* ── Radius dashed ring (booking mode only) ───────────────── */}
          {mode === "booking" && (
            <>
              <Circle
                cx={markerPt.x} cy={markerPt.y}
                r={rPx}
                fill={MAP.radiusFill}
              />
              <Circle
                cx={markerPt.x} cy={markerPt.y}
                r={rPx}
                fill="none"
                stroke={primaryColor}
                strokeWidth={1.5}
                strokeDasharray="6 5"
                strokeOpacity={0.5}
              />
            </>
          )}

          {/* ── Tracking: route line between pro and patient ────────── */}
          {mode === "tracking" && proPt && (
            <Path
              d={`M ${proPt.x.toFixed(1)} ${proPt.y.toFixed(1)} L ${markerPt.x.toFixed(1)} ${markerPt.y.toFixed(1)}`}
              fill="none"
              stroke={Colors.primary}
              strokeWidth={3}
              strokeDasharray="8 5"
              strokeOpacity={0.45}
              strokeLinecap="round"
            />
          )}

          {/* ── Pro dot (tracking mode) ──────────────────────────────── */}
          {proPt && <ProDot x={proPt.x} y={proPt.y} />}

          {/* ── Built-in SVG patient pin (skipped when hideBuiltInPin) ── */}
          {!hideBuiltInPin && (
            <MapPin
              cx={markerPt.x}
              cy={markerPt.y}
              color={primaryColor}
              glowColor={MAP.pinGlow}
            />
          )}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: MAP.bg,
  },
});
