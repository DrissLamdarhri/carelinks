/**
 * CareLink — shared map shell for benchmark candidates.
 * ────────────────────────────────────────────────────────────────────────────
 * FAIRNESS IS THE ENTIRE POINT OF THIS FILE.
 *
 * Both candidates render the same MapLibre map, the same style, the same
 * camera, the same initial framing, and expose the same imperative camera
 * surface. The ONLY difference between them is how the moving marker is drawn —
 * which is the variable under test. If each candidate built its own map, any
 * divergence in style complexity, tile load, pitch or zoom would silently leak
 * into the numbers and we would be measuring the shell, not the renderer.
 *
 * Camera commands are applied identically for both, and counted here rather
 * than in the candidates, so neither can flatter itself by coalescing them.
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import { StyleSheet } from "react-native";
import { Camera, type CameraRef, Map } from "@maplibre/maplibre-react-native";
import { autoMapStyle } from "@/components/map/maplibreStyle";
import type { BenchCamera } from "./types";

/** Identical starting camera for every candidate. */
export const BENCH_ZOOM = 15;
export const BENCH_PITCH = 0;
export const BENCH_BEARING = 0;

export type BenchMapShellHandle = {
  camera: BenchCamera;
  cameraUpdates(): number;
};

type Props = {
  center: { lat: number; lng: number };
  children: ReactNode;
};

export const BenchMapShell = forwardRef<BenchMapShellHandle, Props>(function BenchMapShell(
  { center, children },
  ref,
) {
  const cameraRef = useRef<CameraRef>(null);
  const updates = useRef(0);
  // Camera state is tracked here because MapLibre's imperative API has no
  // getter; panBy needs the current centre to compute an absolute target.
  const state = useRef({
    lat: center.lat,
    lng: center.lng,
    zoom: BENCH_ZOOM,
    bearing: BENCH_BEARING,
    pitch: BENCH_PITCH,
  });

  const fly = useCallback((durationMs: number) => {
    const c = cameraRef.current;
    if (!c) return;
    updates.current++;
    c.easeTo({
      center: [state.current.lng, state.current.lat],
      zoom: state.current.zoom,
      bearing: state.current.bearing,
      pitch: state.current.pitch,
      duration: durationMs,
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      camera: {
        zoomTo: (zoom, durationMs) => {
          state.current.zoom = zoom;
          fly(durationMs);
        },
        panBy: (dLat, dLng, durationMs) => {
          state.current.lat += dLat;
          state.current.lng += dLng;
          fly(durationMs);
        },
        rotateTo: (bearing, durationMs) => {
          state.current.bearing = bearing;
          fly(durationMs);
        },
        pitchTo: (pitch, durationMs) => {
          state.current.pitch = pitch;
          fly(durationMs);
        },
      },
      cameraUpdates: () => updates.current,
    }),
    [fly],
  );

  return (
    <Map style={StyleSheet.absoluteFill} mapStyle={autoMapStyle()} attribution={false} logo={false}>
      <Camera
        ref={cameraRef}
        initialViewState={{
          center: [center.lng, center.lat],
          zoom: BENCH_ZOOM,
          bearing: BENCH_BEARING,
          pitch: BENCH_PITCH,
        }}
      />
      {children}
    </Map>
  );
});
