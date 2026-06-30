/**
 * CareLink — StaticMapLayer  (performance core)
 * ────────────────────────────────────────────────────────────────────────────
 * THE FIX for map slowness:
 *
 * Old approach (slow): every pan pixel / animation frame recomputed every
 * road path, label position, and water path as new SVG strings → React
 * re-rendered the whole SVG tree 60×/sec. That's why it felt laggy.
 *
 * New approach (smooth): the entire map (roads, water, parks, labels) is
 * drawn ONCE at a fixed oversized canvas (1.6× viewport). Panning is just a
 * native-driven `translateX/translateY` on that already-rendered View —
 * the GPU moves a static layer, nothing re-renders, nothing recomputes.
 *
 * Only the small, cheap things (pins, radius ring) are redrawn — and even
 * those run on requestAnimationFrame driven purely by Animated, never by
 * React state, so there's zero re-render cost per frame.
 */

import React, { useMemo } from "react";
import { Animated, StyleSheet, View } from "react-native";
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
  MAP_CENTER,
  NAVY,
  ROAD_STYLE,
  ROADS,
  WATER_LINE,
  project,
  toSvgPath,
} from "./engine";

const OVERSCAN = 1.7; // render this much bigger than viewport so panning never reveals empty edges

type Props = {
  vw: number;
  vh: number;
  zoom: number;
  /** Native-driven pan translation (Animated.ValueXY) */
  pan: Animated.ValueXY;
};

export const StaticMapLayer = React.memo(function StaticMapLayer({
  vw,
  vh,
  zoom,
  pan,
}: Props) {
  const canvasW = vw * OVERSCAN;
  const canvasH = vh * OVERSCAN;

  // Fixed center — the canvas is drawn once around MAP_CENTER and never recomputed.
  // Panning is purely visual (transform), not a re-projection.
  const cx = MAP_CENTER;

  const proj = (lat: number, lng: number) =>
    project({ lat, lng }, cx, zoom, canvasW, canvasH);

  // ── Compute everything ONCE via useMemo with empty-ish deps (zoom/vw/vh only
  //    change on orientation change, never during pan/animation) ─────────────
  const waterD = useMemo(() => {
    const pts = WATER_LINE.map(([lng, lat]) => proj(lat, lng));
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW, canvasH, zoom]);

  const greenDs = useMemo(
    () => GREENS.map((pts) => toSvgPath(pts, cx, zoom, canvasW, canvasH, true)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasW, canvasH, zoom]
  );

  const roadOrder: (keyof typeof ROAD_STYLE)[] = ["local", "secondary", "primary", "highway"];
  const roadPaths = useMemo(
    () =>
      roadOrder.flatMap((type) =>
        ROADS.filter((r) => r.type === type).map((r) => ({
          id: r.id,
          type,
          d: toSvgPath(r.pts, cx, zoom, canvasW, canvasH),
        }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasW, canvasH, zoom]
  );

  const labelNodes = useMemo(
    () =>
      LABELS.map((lbl) => {
        const p = proj(lbl.lat, lbl.lng);
        const fs = lbl.type === "city" ? 12 : lbl.type === "district" ? 10 : 8;
        const fw = lbl.type === "city" ? "700" : lbl.type === "district" ? "600" : "400";
        const col = lbl.type === "city" ? NAVY : lbl.type === "district" ? "#4A4580" : "#7A7490";
        return { ...lbl, p, fs, fw, col };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasW, canvasH, zoom]
  );

  // Center the oversized canvas behind the viewport, then apply pan transform
  const baseOffsetX = -(canvasW - vw) / 2;
  const baseOffsetY = -(canvasH - vh) / 2;

  return (
    <Animated.View
      style={[
        styles.canvasWrap,
        {
          width: canvasW,
          height: canvasH,
          transform: [
            { translateX: Animated.add(pan.x, baseOffsetX) },
            { translateY: Animated.add(pan.y, baseOffsetY) },
          ],
        },
      ]}
    >
      <Svg width={canvasW} height={canvasH}>
        <Defs>
          <RadialGradient id="vig" cx="50%" cy="50%" r="65%">
            <Stop offset="55%" stopColor="transparent" stopOpacity={0} />
            <Stop offset="100%" stopColor="#C8BAAA" stopOpacity={0.16} />
          </RadialGradient>
        </Defs>

        {/* Land */}
        <Rect x={0} y={0} width={canvasW} height={canvasH} fill={CREAM} />
        <Ellipse
          cx={canvasW * 0.5} cy={canvasH * 0.5}
          rx={canvasW * 0.46} ry={canvasH * 0.42}
          fill="#E4D9BB" opacity={0.45}
        />

        {/* Grid */}
        {Array.from({ length: 7 }).map((_, i) => (
          <Line key={`gh${i}`} x1={0} y1={(canvasH / 8) * i} x2={canvasW} y2={(canvasH / 8) * i}
            stroke="rgba(13,8,112,0.035)" strokeWidth={1} />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <Line key={`gv${i}`} x1={(canvasW / 10) * i} y1={0} x2={(canvasW / 10) * i} y2={canvasH}
            stroke="rgba(13,8,112,0.035)" strokeWidth={1} />
        ))}

        {/* Green areas */}
        {greenDs.map((d, i) => (
          <Path key={`g${i}`} d={d} fill="#CDDEC8" stroke="#B8CCAA" strokeWidth={0.8} />
        ))}

        {/* Water */}
        <Path d={waterD} fill="none" stroke="#B8D9E8" strokeWidth={9} strokeLinecap="round" />
        <Path d={waterD} fill="none" stroke="#A0C8D8" strokeWidth={5.5} strokeLinecap="round" />

        {/* Road casings */}
        {roadPaths.map(({ id, type, d }) => (
          <Path key={`rc-${id}`} d={d} fill="none"
            stroke={ROAD_STYLE[type].casing} strokeWidth={ROAD_STYLE[type].cw}
            strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Road fills */}
        {roadPaths.map(({ id, type, d }) => (
          <Path key={`rf-${id}`} d={d} fill="none"
            stroke={ROAD_STYLE[type].fill} strokeWidth={ROAD_STYLE[type].fw}
            strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Labels */}
        {labelNodes.map((lbl) => (
          <React.Fragment key={lbl.name}>
            <SvgText x={lbl.p.x} y={lbl.p.y} textAnchor="middle"
              fontSize={lbl.fs} fontWeight={lbl.fw}
              fill={CREAM} stroke={CREAM} strokeWidth={3.2}>{lbl.name}</SvgText>
            <SvgText x={lbl.p.x} y={lbl.p.y} textAnchor="middle"
              fontSize={lbl.fs} fontWeight={lbl.fw} fill={lbl.col}>{lbl.name}</SvgText>
            {lbl.type !== "neighborhood" && (
              <SvgText x={lbl.p.x} y={lbl.p.y + lbl.fs + 2} textAnchor="middle"
                fontSize={lbl.fs - 1.5} fill={lbl.col} fillOpacity={0.55}>{lbl.nameAr}</SvgText>
            )}
          </React.Fragment>
        ))}

        {/* Vignette */}
        <Rect x={0} y={0} width={canvasW} height={canvasH} fill="url(#vig)" />
      </Svg>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  canvasWrap: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
