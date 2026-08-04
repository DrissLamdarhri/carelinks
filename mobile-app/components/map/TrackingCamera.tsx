/**
 * CareLink — the tracking camera.
 * ────────────────────────────────────────────────────────────────────────────
 * Applies the pure policy in `lib/tracking/camera.ts` to a real MapLibre
 * camera. All the judgement lives in that module and is unit-tested; this file
 * only owns the wiring — subscribing to the store, measuring the gap between
 * marker and centre, and issuing `easeTo`.
 *
 * Like `LiveProMarker`, this subscribes to the animated store itself so the
 * per-frame work stays on a leaf. It renders no visible output at all: it is a
 * `<Camera>` and nothing else.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Dimensions } from "react-native";
import { Camera, type CameraRef } from "@maplibre/maplibre-react-native";
import { distanceM } from "@/lib/tracking/route";
import {
  initialCameraState,
  nextCameraCommand,
  withRecenterRequest,
  withUserGesture,
  type CameraState,
} from "@/lib/tracking/camera";
import type { TrackingStore } from "@/lib/tracking/store";

export type TrackingCameraHandle = {
  /** Called when the user pans/zooms — suspends following. */
  notifyUserGesture(): void;
  /** Explicit recentre affordance. */
  recenter(): void;
};

type Props = {
  store: TrackingStore;
  /** Initial framing before the first fix lands. */
  fallbackCenter: { lat: number; lng: number };
};

export const TrackingCamera = forwardRef<TrackingCameraHandle, Props>(function TrackingCamera(
  { store, fallbackCenter },
  ref,
) {
  const cameraRef = useRef<CameraRef>(null);
  const state = useRef<CameraState>(initialCameraState());

  useImperativeHandle(ref, () => ({
    notifyUserGesture: () => {
      state.current = withUserGesture(state.current, Date.now());
    },
    recenter: () => {
      state.current = withRecenterRequest(state.current);
      // Re-evaluate immediately rather than waiting for the next fix: a
      // recentre tap that does nothing for two seconds feels broken.
      apply();
    },
  }));

  const apply = useCallback(() => {
    const sample = store.getSnapshot();
    const cam = cameraRef.current;
    if (!sample || !cam) return;

    const target = { lat: sample.lat, lng: sample.lng };
    const { state: next, command } = nextCameraCommand(state.current, {
      now: Date.now(),
      target,
      speedMps: store.latestFix?.speed ?? null,
      // The map is full-width; its shorter side is the window width.
      viewportPx: Dimensions.get("window").width,
      distanceFromCenterM: state.current.center
        ? distanceM(state.current.center, target)
        : Number.POSITIVE_INFINITY,
    });
    state.current = next;
    if (!command) return; // the common case, and the point of the policy

    cam.easeTo({
      center: [command.center.lng, command.center.lat],
      zoom: command.zoom,
      duration: command.durationMs,
    });
  }, [store]);

  // Driven by the store rather than a timer: the camera is only ever asked to
  // reconsider when the marker actually moved.
  useEffect(() => store.subscribe(apply), [store, apply]);

  return (
    <Camera
      ref={cameraRef}
      initialViewState={{
        center: [fallbackCenter.lng, fallbackCenter.lat],
        zoom: 16.2,
        bearing: 0,
        pitch: 0,
      }}
    />
  );
});
