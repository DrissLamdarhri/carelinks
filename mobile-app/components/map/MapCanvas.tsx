/**
 * CareLink — MapCanvas
 * SVG map background: land, water, roads, labels, vignette.
 * Accepts an `offset` prop (pan state) so the parent can drive panning.
 * Direct port of MapCanvas() from carelinks_map_enhanced.jsx.
 */

import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  CREAM,
  GREENS,
  LABELS,
  NAVY,
  ROAD_STYLE,
  ROADS,
  WATER_LINE,
  centerWithOffset,
  project,
  toSvgPath,
  type Offset,
} from "./engine";

type Props = {
  offset: Offset;
  vw: number;
  vh: number;
  zoom?: number;
  /** Optional dashed radius ring (booking mode) */
  radiusKm?: number;
  primaryColor?: string;
  showRadius?: boolean;
  /** Patient / marker coordinate — needed for radius ring centre */
  markerLat?: number;
  markerLng?: number;
};

const ZOOM = 7500;

export function MapCanvas({
  offset,
  vw,
  vh,
  zoom = ZOOM,
  radiusKm,
  primaryColor = NAVY,
  showRadius = false,
  markerLat,
  markerLng,
}: Props) {
  const cx = useMemo(() => centerWithOffset(offset, zoom), [offset, zoom]);

  const proj = (lat: number, lng: number) =>
    project({ lat, lng }, cx, zoom, vw, vh);

  // Water polyline path
  const waterD = useMemo(() => {
    const pts = WATER_LINE.map(([lng, lat]) => proj(lat, lng));
    return pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  }, [cx, vw, vh, zoom]);

  // Green area paths
  const greenDs = useMemo(
    () =>
      GREENS.map((pts) =>
        toSvgPath(pts as [number, number][], cx, zoom, vw, vh, true)
      ),
    [cx, vw, vh, zoom]
  );

  // Road paths — sorted so casings drawn first, fills on top
  const roadOrder: (keyof typeof ROAD_STYLE)[] = [
    "local", "secondary", "primary", "highway",
  ];

  const roadPaths = useMemo(
    () =>
      roadOrder.flatMap((type) =>
        ROADS.filter((r) => r.type === type).map((r) => ({
          id: r.id,
          type,
          d: toSvgPath(r.pts, cx, zoom, vw, vh),
        }))
      ),
    [cx, vw, vh, zoom]
  );

  // Radius ring
  const markerPt =
    markerLat != null && markerLng != null
      ? proj(markerLat, markerLng)
      : { x: vw / 2, y: vh / 2 };

  const rPx =
    radiusKm != null
      ? (radiusKm / 111) *
        zoom *
        Math.cos((cx.lat * Math.PI) / 180)
      : 0;

  return (
    <View style={[StyleSheet.absoluteFillObject, { overflow: "hidden" }]}>
      <Svg
        width={vw}
        height={vh}
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          <RadialGradient id="vig" cx="50%" cy="50%" r="70%">
            <Stop offset="55%" stopColor="transparent" stopOpacity={0} />
            <Stop offset="100%" stopColor="#C8BAAA" stopOpacity={0.18} />
          </RadialGradient>
        </Defs>

        {/* Land */}
        <Rect x={0} y={0} width={vw} height={vh} fill={CREAM} />
        <Ellipse
          cx={vw * 0.5} cy={vh * 0.5}
          rx={vw * 0.48} ry={vh * 0.44}
          fill="#E4D9BB" opacity={0.5}
        />

        {/* Grid */}
        {[1, 2, 3, 4].map((i) => (
          <Line
            key={`gh${i}`}
            x1={0} y1={vh * i / 5}
            x2={vw} y2={vh * i / 5}
            stroke="rgba(13,8,112,0.04)" strokeWidth={1}
          />
        ))}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Line
            key={`gv${i}`}
            x1={vw * i / 7} y1={0}
            x2={vw * i / 7} y2={vh}
            stroke="rgba(13,8,112,0.04)" strokeWidth={1}
          />
        ))}

        {/* Green areas */}
        {greenDs.map((d, i) => (
          <Path
            key={`g${i}`} d={d}
            fill="#CDDEC8" stroke="#B8CCAA" strokeWidth={0.8}
          />
        ))}

        {/* Water */}
        <Path
          d={waterD} fill="none"
          stroke="#B8D9E8" strokeWidth={8} strokeLinecap="round"
        />
        <Path
          d={waterD} fill="none"
          stroke="#A0C8D8" strokeWidth={5} strokeLinecap="round"
        />

        {/* Road casings */}
        {roadPaths.map(({ id, type, d }) => {
          const s = ROAD_STYLE[type];
          return (
            <Path
              key={`rc-${id}`} d={d} fill="none"
              stroke={s.casing} strokeWidth={s.cw}
              strokeLinecap="round" strokeLinejoin="round"
            />
          );
        })}

        {/* Road fills */}
        {roadPaths.map(({ id, type, d }) => {
          const s = ROAD_STYLE[type];
          return (
            <Path
              key={`rf-${id}`} d={d} fill="none"
              stroke={s.fill} strokeWidth={s.fw}
              strokeLinecap="round" strokeLinejoin="round"
            />
          );
        })}

        {/* Labels */}
        {LABELS.map((lbl) => {
          const p = proj(lbl.lat, lbl.lng);
          if (p.x < -30 || p.x > vw + 30 || p.y < -15 || p.y > vh + 15)
            return null;
          const fs =
            lbl.type === "city" ? 11 : lbl.type === "district" ? 9 : 7.5;
          const fw =
            lbl.type === "city" ? "700" : lbl.type === "district" ? "600" : "400";
          const col =
            lbl.type === "city"
              ? NAVY
              : lbl.type === "district"
              ? "#4A4580"
              : "#7A7490";

          return (
            <React.Fragment key={lbl.name}>
              {/* White halo */}
              <SvgText
                x={p.x} y={p.y}
                textAnchor="middle"
                fontSize={fs} fontWeight={fw}
                fill={CREAM} stroke={CREAM} strokeWidth={3}
              >
                {lbl.name}
              </SvgText>
              {/* Label */}
              <SvgText
                x={p.x} y={p.y}
                textAnchor="middle"
                fontSize={fs} fontWeight={fw}
                fill={col}
              >
                {lbl.name}
              </SvgText>
              {lbl.type !== "neighborhood" && (
                <SvgText
                  x={p.x} y={p.y + fs + 2}
                  textAnchor="middle"
                  fontSize={fs - 1.5}
                  fill={col} fillOpacity={0.55}
                >
                  {lbl.nameAr}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}

        {/* Vignette */}
        <Rect
          x={0} y={0} width={vw} height={vh}
          fill="url(#vig)"
        />

        {/* Radius ring (booking mode) */}
        {showRadius && rPx > 0 && (
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

        {/* Tracking: dashed route line between pro and patient */}
        {/* (drawn here when proLat/proLng injected via optional props) */}
      </Svg>
    </View>
  );
}
