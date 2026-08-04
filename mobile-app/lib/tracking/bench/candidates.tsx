/**
 * CareLink — renderer candidates under benchmark.
 *
 * Every candidate implements the same contract so the runner can drive them
 * identically. Adding a future candidate means adding one entry here; the
 * harness, scenarios and report need no changes.
 *
 * THE CONTROL IS NOT OPTIONAL. Without a no-map baseline you cannot separate
 * "this renderer is slow" from "this device tops out at 48fps in a dev build".
 * Every candidate's numbers are read relative to the control, never in absolute
 * terms.
 */
import React, { forwardRef, useImperativeHandle, useRef, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { BenchRendererHandle, BenchRendererProps, RendererCandidate } from "./types";

/**
 * CONTROL — subscribes to the store exactly as a real renderer would, but draws
 * only a text readout. Establishes this device's ceiling for the store + React
 * subscription path with zero map cost.
 */
export const ControlRenderer = forwardRef<BenchRendererHandle, BenchRendererProps>(
  function ControlRenderer({ store }, ref) {
    const markerUpdates = useRef(0);
    const cameraUpdates = useRef(0);

    const sample = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    if (sample) markerUpdates.current++;

    useImperativeHandle(ref, () => ({
      // The control has no camera; commands are counted so the run shape stays
      // comparable, but nothing is drawn.
      camera: {
        zoomTo: () => void cameraUpdates.current++,
        panBy: () => void cameraUpdates.current++,
        rotateTo: () => void cameraUpdates.current++,
        pitchTo: () => void cameraUpdates.current++,
      },
      markerUpdates: () => markerUpdates.current,
      cameraUpdates: () => cameraUpdates.current,
    }));

    return (
      <View style={styles.control}>
        <Text style={styles.controlLabel}>CONTROL — no map</Text>
        <Text style={styles.controlValue}>
          {sample ? `${sample.lat.toFixed(5)}, ${sample.lng.toFixed(5)}` : "waiting…"}
        </Text>
        <Text style={styles.controlValue}>{sample ? `${sample.bearing.toFixed(0)}°` : ""}</Text>
      </View>
    );
  },
);

export type CandidateEntry = RendererCandidate & {
  Component: React.ComponentType<BenchRendererProps & { ref?: React.Ref<BenchRendererHandle> }>;
};

/**
 * The registry. Phase 2 step 4 adds the two real candidates:
 *   • view-annotation — RN marker view, position driven as a React prop
 *   • symbol-layer    — native MapLibre SymbolLayer over an animated source
 */
export const CANDIDATES: CandidateEntry[] = [
  {
    id: "control",
    label: "Control",
    approach: "No map. Store + useSyncExternalStore only — the device's ceiling.",
    Component: ControlRenderer as CandidateEntry["Component"],
  },
];

export function candidateById(id: string): CandidateEntry | undefined {
  return CANDIDATES.find((c) => c.id === id);
}

const styles = StyleSheet.create({
  control: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D0870" },
  controlLabel: { color: "#9CA3AF", fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  controlValue: { color: "#FFFFFF", fontSize: 16, fontVariant: ["tabular-nums"] },
});
