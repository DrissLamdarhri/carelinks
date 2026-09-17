/**
 * CareLink — the live professional marker on the native map.
 * ────────────────────────────────────────────────────────────────────────────
 * This component exists to be SMALL.
 *
 * It is the only thing in the tree that subscribes to the animated tracking
 * store, so it is the only thing that re-renders as the marker moves. Its
 * parent — the map, the bottom sheet, the ETA, the action row — renders once
 * and then stays still while the nurse drives across town.
 *
 * That separation is the entire point of Phase 2. The previous implementation
 * smoothed the position with a hook inside the tracking SCREEN, so every
 * animation frame re-rendered the whole screen to move one dot a few pixels,
 * which is where the reported flickering and shaking came from.
 *
 * Only ever rendered as a child of the MapLibre `Map` — `ViewAnnotation` is
 * meaningless outside it.
 */
import React, { memo, useRef, useSyncExternalStore } from "react";
import { ViewAnnotation } from "@maplibre/maplibre-react-native";
import type { ImageSourcePropType } from "react-native";
import { MeMarker } from "./MapMarkers";
import { TrackingMarker, type TrackingStatus } from "./TrackingMarker";
import { holdHeading } from "@/lib/tracking/heading-hold";
import { STALE_AFTER_MS, type TrackingStore } from "@/lib/tracking/store";

export type LiveProMarkerProps = {
  store: TrackingStore;
  /**
   * "pro"  — the professional as seen BY THE PATIENT: avatar, halo, status.
   * "self" — your own position on your own screen (the nurse's map). A person
   *          does not need their own photo pinned to their own dot, and an
   *          avatar there competes with the destination for attention; the
   *          familiar heading arrow is the right affordance.
   */
  variant?: "pro" | "self";
  /** Booking-level state. `arrived` outranks any GPS-derived status. */
  arrived?: boolean;
  avatarUrl?: string | null;
  avatarSource?: ImageSourcePropType;
  initials?: string;
};

export const LiveProMarker = memo(function LiveProMarker({
  store,
  variant = "pro",
  arrived = false,
  avatarUrl,
  avatarSource,
  initials,
}: LiveProMarkerProps) {
  const sample = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  /**
   * Last heading the "self" marker was drawn at, held through stops.
   *
   * Derived from the current snapshot only — no subscription of its own, no
   * effect — so this stays the cheap leaf it was designed to be. Written during
   * render for the same reason the snapshot is read during render: it is a
   * function of the value we already have.
   *
   * Only the "self" variant consults it. The professional's marker as seen BY
   * THE PATIENT still takes `bearing` and `moving` straight from the sample, so
   * nothing about the patient's screen changes.
   */
  const heldHeadingRef = useRef<number | null>(null);
  heldHeadingRef.current = holdHeading(heldHeadingRef.current, sample);

  if (!sample) return null;

  // Arrival is a fact the professional declared; it outranks anything inferred
  // from the position stream. Staleness is derived from the sample rather than
  // polled, so the marker stops claiming liveness the moment the pipeline stops
  // having real data to interpolate.
  const status: TrackingStatus = arrived
    ? "arrived"
    : sample.stale || sample.ageMs > STALE_AFTER_MS
      ? "stale"
      : "live";

  return (
    <ViewAnnotation lngLat={[sample.lng, sample.lat]} anchor="center">
      {variant === "self" ? (
        <MeMarker heading={heldHeadingRef.current} />
      ) : (
      <TrackingMarker
        status={status}
        bearing={sample.bearing}
        moving={sample.moving}
        avatarUrl={avatarUrl}
        avatarSource={avatarSource}
        initials={initials}
      />
      )}
    </ViewAnnotation>
  );
});
