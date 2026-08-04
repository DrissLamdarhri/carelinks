/**
 * CANDIDATE A — ViewAnnotation.
 *
 * The marker is a real React Native view, positioned by passing `lngLat` as a
 * prop. This is how the app draws markers today, so it is both a candidate and
 * the incumbent baseline.
 *
 * COST MODEL
 *   Every position change is a React render of this component, followed by
 *   MapLibre repositioning a native view in the Android/iOS view hierarchy and
 *   the RN shadow tree reconciling its children. The map itself never learns
 *   that the marker "moved"; it re-lays-out a view that happens to be anchored
 *   to a coordinate.
 *
 * WHY IT MIGHT STILL WIN
 *   The marker is ordinary RN, so it can contain anything — an avatar photo,
 *   a pulsing halo, a status badge — with no new concepts and no shader work.
 *   Debugging is React DevTools and a `console.log`. That is worth real money
 *   over the life of a product, and the benchmark must be allowed to tell us it
 *   is fast enough.
 *
 * FAIRNESS: subscribes through exactly the same useSyncExternalStore path as
 * Candidate B, renders the same visual (a navy arrow of the same size), and
 * uses the shared map shell. Nothing here is tuned in a way B is denied.
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useSyncExternalStore,
} from "react";
import { Image, StyleSheet, View } from "react-native";
import { ViewAnnotation } from "@maplibre/maplibre-react-native";
import { BenchMapShell, type BenchMapShellHandle } from "./BenchMapShell";
import type { BenchRendererHandle, BenchRendererProps } from "./types";

const ARROW = require("../../../assets/tracking/marker-arrow.png");
/** Matches the SymbolLayer candidate's rendered size exactly. */
export const MARKER_PX = 32;

export const ViewAnnotationCandidate = forwardRef<BenchRendererHandle, BenchRendererProps>(
  function ViewAnnotationCandidate({ store, center }, ref) {
    const shellRef = useRef<BenchMapShellHandle>(null);
    const markerUpdates = useRef(0);

    const sample = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    // Counted at the point the marker is actually repositioned, which for this
    // candidate is every render that carries a new sample.
    if (sample) markerUpdates.current++;

    useImperativeHandle(ref, () => ({
      camera: {
        zoomTo: (z, d) => shellRef.current?.camera.zoomTo(z, d),
        panBy: (a, b, d) => shellRef.current?.camera.panBy(a, b, d),
        rotateTo: (b, d) => shellRef.current?.camera.rotateTo(b, d),
        pitchTo: (p, d) => shellRef.current?.camera.pitchTo(p, d),
      },
      markerUpdates: () => markerUpdates.current,
      cameraUpdates: () => shellRef.current?.cameraUpdates() ?? 0,
    }));

    return (
      <BenchMapShell ref={shellRef} center={center}>
        {sample ? (
          <ViewAnnotation lngLat={[sample.lng, sample.lat]} anchor="center">
            <View style={[styles.wrap, { transform: [{ rotate: `${sample.bearing}deg` }] }]}>
              <Image source={ARROW} style={styles.icon} resizeMode="contain" />
            </View>
          </ViewAnnotation>
        ) : null}
      </BenchMapShell>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { width: MARKER_PX, height: MARKER_PX, alignItems: "center", justifyContent: "center" },
  icon: { width: MARKER_PX, height: MARKER_PX },
});
