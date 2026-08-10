/**
 * CANDIDATE B — SymbolLayer over a GeoJSON source.
 *
 * The marker is a symbol inside the map's own render pass. Position changes are
 * a source update; rotation is a data-driven style property, so the GPU turns
 * the icon and no JS is involved in the rotation at all.
 *
 * COST MODEL
 *   A React render produces a new GeoJSON feature, which MapLibre uploads to
 *   the source. The map then draws the symbol as part of the frame it was
 *   already drawing. There is no extra native view, no view-hierarchy layout,
 *   and no RN shadow-tree work for the marker.
 *
 * WHY IT MIGHT LOSE ANYWAY
 *   • The icon is a raster. Anything richer than an image — a live avatar
 *     photo, a pulsing halo, a badge — is not simply "styled", it has to become
 *     an image, or move to a separate annotation, which reintroduces the cost
 *     this candidate exists to avoid.
 *   • Debugging is a style expression and a source diff, not a component tree.
 *   • `iconRotate` is a style property, so rotation is smoothed by the map, not
 *     by us; we lose direct control over the exact interpolation curve.
 *
 * FAIRNESS: same store, same useSyncExternalStore subscription, same map shell,
 * same 32px navy arrow asset. Deliberately NOT Reanimated-driven — attaching
 * Reanimated to the source would change TWO variables at once (renderer AND
 * subscription mechanism) and confound the comparison. It is a follow-up
 * optimisation to be measured separately, on top of whichever renderer wins.
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { GeoJSONSource, Images, Layer } from "@maplibre/maplibre-react-native";
import { BenchMapShell, type BenchMapShellHandle } from "./BenchMapShell";
import { MARKER_PX } from "./ViewAnnotationCandidate";
import type { BenchRendererHandle, BenchRendererProps } from "./types";

const ARROW = require("../../../assets/tracking/marker-arrow.png");
const ICON_NAME = "bench-marker-arrow";
/** The PNG is 96px; render it at the same on-screen size as Candidate A. */
const ICON_SCALE = MARKER_PX / 96;

export const SymbolLayerCandidate = forwardRef<BenchRendererHandle, BenchRendererProps>(
  function SymbolLayerCandidate({ store, center }, ref) {
    const shellRef = useRef<BenchMapShellHandle>(null);
    const markerUpdates = useRef(0);
    // If the icon fails to load, the layer draws NOTHING and this candidate
    // would post beautiful numbers for rendering an empty scene. Surfacing it
    // is the difference between a benchmark and a fiction.
    const [iconMissing, setIconMissing] = useState(false);

    const sample = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    if (sample) markerUpdates.current++;

    const feature = useMemo(
      () =>
        sample
          ? ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [sample.lng, sample.lat] },
              // Bearing travels as a FEATURE PROPERTY so `iconRotate` can read
              // it via a style expression — the rotation then costs no JS.
              properties: { bearing: sample.bearing },
            } as GeoJSON.Feature<GeoJSON.Point>)
          : null,
      [sample],
    );

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
      <View style={StyleSheet.absoluteFill}>
        <BenchMapShell ref={shellRef} center={center}>
          <Images images={{ [ICON_NAME]: ARROW }} onImageMissing={() => setIconMissing(true)} />
          {feature ? (
            <GeoJSONSource id="bench-marker-source" data={feature}>
              <Layer
                id="bench-marker-layer"
                type="symbol"
                style={{
                  iconImage: ICON_NAME,
                  iconSize: ICON_SCALE,
                  iconRotate: ["get", "bearing"],
                  // Rotate with the map, so the arrow keeps pointing at a real
                  // world bearing when the camera itself rotates.
                  iconRotationAlignment: "map",
                  iconAllowOverlap: true,
                  iconIgnorePlacement: true,
                }}
              />
            </GeoJSONSource>
          ) : null}
        </BenchMapShell>

        {/* A silently-missing icon would mean this candidate renders an EMPTY
            scene and posts excellent numbers for doing nothing. That is the
            most dangerous way for a benchmark to be wrong, so it is made
            impossible to overlook rather than merely logged. */}
        {iconMissing ? (
          <View style={styles.invalid} pointerEvents="none">
            <Text style={styles.invalidText}>
              ICON FAILED TO LOAD — THIS RUN IS INVALID
            </Text>
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  invalid: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "#B91C1C",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  invalidText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12, textAlign: "center" },
});

/** Exposed so the bench screen can refuse to report an invalid run. */
export const SYMBOL_ICON_NAME = ICON_NAME;
