/**
 * CareLink — CareLinkMapView (capability-gated map)
 * ────────────────────────────────────────────────────────────────────────────
 * Renders the REAL map (MapLibre + MapTiler) when its native module is present
 * (a dev/bare build), and gracefully falls back to the stylized SVG map when it
 * isn't (Expo Go). This lets the whole app run in Expo Go for testing while the
 * real map lights up automatically in a dev build — no code change needed.
 *
 * The MapLibre import lives in ./CareLinkMapNative and is only `require()`d when
 * the native module exists, so it never crashes Expo Go.
 */
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  NativeModules,
  StyleSheet,
  TurboModuleRegistry,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Path as SvgPath } from "react-native-svg";
import { StaticMapLayer } from "./StaticMapLayer";
import { type ProPinData } from "./Pins";
import { ProAvatarMarker, MeMarker, DestinationPin } from "./MapMarkers";
import { CREAM, DEFAULT_ZOOM, NAVY, project } from "./engine";

export type LatLng = { lat: number; lng: number };

export type CareLinkMapViewProps = {
  /** Initial map center. */
  center: LatLng;
  /** Patient ("Vous") pin + radius origin. */
  patient?: LatLng;
  /** Destination drop-pin (e.g. the patient's home on the nurse's navigation map). */
  destination?: LatLng;
  /** Nearby professionals to plot. */
  pros?: ProPinData[];
  /** Moving professional (tracking) — position + who they are (for the photo pin). */
  pro?: LatLng & {
    avatarUrl?: string | null;
    avatarSource?: import("react-native").ImageSourcePropType;
    initials?: string;
    specialty?: string;
    name?: string;
  };
  /** Road-following route polyline. */
  route?: LatLng[];
  /** Split index: route[0..idx] is dimmed (traversed), route[idx..] is solid. */
  progressIdx?: number;
  /** Search radius circle (km) around the patient. 0 hides it. */
  radiusKm?: number;
  primaryColor?: string;
  selectedProId?: string | null;
  onSelectPro?: (id: string) => void;
  /** Tap on the map → drop/move the location pin. */
  onMapPress?: (c: LatLng) => void;
  /** Show the OS blue user-location dot (native only). */
  followUser?: boolean;
  /** When set (≥2 points), frame the camera to fit these coords (native only). */
  fitCoords?: LatLng[];
  /** Auto day/night map style by local hour (tracking uses this). */
  nightAuto?: boolean;
  /** Increment to re-frame the camera (re-center FAB). */
  recenterKey?: number;
  /** Increment to zoom-to-fit all pros (booking envelope button). */
  fitAllKey?: number;
  /** Navigation mode — camera continuously follows `center` (tight zoom + pitch). */
  follow?: boolean;
  style?: StyleProp<ViewStyle>;
};

// ── Native-module detection ─────────────────────────────────────────────────
// MapLibre registers "MLRNMapViewModule" (+ MLRN*Module). In Expo Go these are
// absent — importing MapLibre would throw (getEnforcing) — so we only load the
// native map when the module is present (a dev/bare build).
function detectNativeMaps(): boolean {
  try {
    const get = (TurboModuleRegistry as { get?: (n: string) => unknown })?.get;
    if (get && get("MLRNMapViewModule")) return true;
  } catch {
    // ignore
  }
  const nm = NativeModules as Record<string, unknown>;
  return Boolean(nm.MLRNMapViewModule || nm.MLRNModule);
}

/** True when the real MapLibre native module is available (dev/bare build). */
export const HAS_NATIVE_MAPS = detectNativeMaps();

let NativeMap: React.ComponentType<CareLinkMapViewProps> | null = null;
if (HAS_NATIVE_MAPS) {
  try {
    NativeMap = require("./CareLinkMapNative").default as React.ComponentType<CareLinkMapViewProps>;
  } catch {
    NativeMap = null;
  }
}

export function CareLinkMapView(props: CareLinkMapViewProps) {
  if (NativeMap) {
    const Map = NativeMap;
    return <Map {...props} />;
  }
  return <FallbackMap {...props} />;
}

// ── Stylized fallback (Expo Go / no native module) ──────────────────────────
// Static cream SVG map with the patient + pro pins projected around the center.
// Not real geography, but keeps the whole app usable without a dev build.
function FallbackMap({
  center,
  patient,
  destination,
  pros = [],
  pro,
  route,
  progressIdx = 0,
  primaryColor = "#0D0870",
  selectedProId,
  onSelectPro,
  style,
}: CareLinkMapViewProps) {
  const [size, setSize] = useState({ w: Dimensions.get("window").width, h: 320 });
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height) setSize({ w: width, h: height });
  };

  const origin = patient ?? center;
  const toXY = (c: LatLng) => project({ lat: c.lat, lng: c.lng }, origin, DEFAULT_ZOOM, size.w, size.h);
  const pathOf = (pts: LatLng[]) =>
    pts.map((p, i) => { const xy = toXY(p); return `${i === 0 ? "M" : "L"}${xy.x.toFixed(1)},${xy.y.toFixed(1)}`; }).join(" ");
  const hasRoute = !!route && route.length > 1;

  return (
    <View
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { backgroundColor: CREAM, overflow: "hidden" }, style]}
    >
      <StaticMapLayer vw={size.w} vh={size.h} zoom={DEFAULT_ZOOM} pan={pan} />

      {hasRoute ? (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h} pointerEvents="none">
          {/* traversed dimmed */}
          <SvgPath d={pathOf(route!.slice(0, progressIdx + 1))} fill="none" stroke="#B9B5D6" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          {/* remaining: white casing + navy core */}
          <SvgPath d={pathOf(route!.slice(progressIdx))} fill="none" stroke="#FFFFFF" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
          <SvgPath d={pathOf(route!.slice(progressIdx))} fill="none" stroke={NAVY} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}

      {pros.map((p) => {
        const xy = toXY(p);
        return (
          <View key={p.id} style={[fb.pin, { left: xy.x - 30, top: xy.y - 56 }]}>
            <ProAvatarMarker
              pro={{ avatarSource: p.avatarSource, avatarUrl: p.avatarUrl, initials: p.initials, specialty: p.specialty, name: p.name, rating: p.rating, distanceKm: p.distanceKm, priceMad: p.priceMad }}
              selected={selectedProId === p.id}
              onPress={() => onSelectPro?.(p.id)}
            />
          </View>
        );
      })}

      {pro ? (
        <View style={[fb.pin, { left: toXY(pro).x - 30, top: toXY(pro).y - 56 }]}>
          <ProAvatarMarker
            pro={{ avatarSource: pro.avatarSource, avatarUrl: pro.avatarUrl, initials: pro.initials ?? "", specialty: pro.specialty, name: pro.name }}
            driver
          />
        </View>
      ) : null}

      {patient ? (
        <View pointerEvents="none" style={[fb.pin, { left: toXY(patient).x - 13, top: toXY(patient).y - 13 }]}>
          <MeMarker />
        </View>
      ) : null}

      {destination ? (
        <View pointerEvents="none" style={[fb.pin, { left: toXY(destination).x - 17, top: toXY(destination).y - 42 }]}>
          <DestinationPin />
        </View>
      ) : null}
    </View>
  );
}

const fb = StyleSheet.create({
  pin: { position: "absolute", zIndex: 20 },
});
