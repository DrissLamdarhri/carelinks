/**
 * CareLink — native map (MapLibre + MapTiler). Real cream/navy streets.
 * ────────────────────────────────────────────────────────────────────────────
 * IMPORTANT: statically imports MapLibre, whose native module isn't in Expo Go
 * (getEnforcing throws there). Only ever `require()`d from CareLinkMapView when
 * the native module exists (dev/bare build). Never import from a screen.
 *
 * Pins reuse the branded PatientPin / ProPin (via ViewAnnotation = real RN
 * views, so their animations keep running). Route + radius are GeoJSON layers.
 * The Camera is controlled by `center`, so during tracking it follows the pro.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, type NativeSyntheticEvent } from "react-native";
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  type PressEvent,
  type PressEventWithFeatures,
  ViewAnnotation,
} from "@maplibre/maplibre-react-native";
import { ProAvatarMarker, MeMarker, DestinationPin } from "./MapMarkers";
import { LiveProMarker } from "./LiveProMarker";
import { TrackingCamera, type TrackingCameraHandle } from "./TrackingCamera";
import { creamMapStyle, autoMapStyle } from "./maplibreStyle";
import type { CareLinkMapViewProps, LatLng } from "./CareLinkMapView";
import type { ProPinData } from "./Pins";

const NAVY = "#0D0870";

const lineFeature = (pts: LatLng[]): GeoJSON.Feature<GeoJSON.LineString> => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: pts.map((p) => [p.lng, p.lat]) },
  properties: {},
});

/** Compass bearing (deg, 0=N) from a → b — used to orient the driver pointer. */
function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Circle polygon (km radius) around a center for the search-radius fill. */
function circleFeature(center: LatLng, radiusKm: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: number[][] = [];
  const latR = radiusKm / 110.574;
  const lngR = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    coords.push([center.lng + lngR * Math.cos(t), center.lat + latR * Math.sin(t)]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
}

export default function CareLinkMapNative({
  center,
  patient,
  meHeading,
  destination,
  pros = [],
  pro,
  route,
  progressIdx = 0,
  radiusKm = 5,
  primaryColor = NAVY,
  selectedProId,
  onSelectPro,
  onMapPress,
  followUser,
  fitCoords,
  nightAuto,
  recenterKey,
  fitAllKey,
  follow,
  trackingStore,
  trackingArrived,
  trackingVariant,
  style,
}: CareLinkMapViewProps) {
  const mapStyleSpec = useMemo(() => (nightAuto ? autoMapStyle() : creamMapStyle()), [nightAuto]);

  // Driver heading (deg) for the marker pointer — prefer the pro's real GPS
  // course (reported live, only valid while actually moving) over the
  // route-derived bearing, which is just a fallback for when the device
  // hasn't reported a usable heading yet (stationary, cold GPS fix, demo path).
  const driverBearing = useMemo(() => {
    if (pro?.heading != null) return pro.heading;
    if (!route || route.length < 2) return 0;
    const i = Math.min(progressIdx, route.length - 2);
    return bearingDeg(route[i], route[i + 1]);
  }, [pro?.heading, route, progressIdx]);
  // Memoized GeoJSON so frequent driver-position updates don't re-upload
  // unchanged sources (which caused flicker). Each segment needs ≥2 points.
  const radiusData = useMemo(
    () => (radiusKm > 0 ? circleFeature(patient ?? center, radiusKm) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patient?.lat, patient?.lng, center.lat, center.lng, radiusKm],
  );
  // Where to break the route into traversed and remaining.
  //
  // This used to be forced through `pro` — the RAW GPS fix — so BOTH lines were
  // dragged off the carriageway to wherever the last fix landed. With the
  // marker drawn at its map-matched position ON the road, the result was a
  // visible spur: the route detoured to a point beside the street while the
  // marker sat on it. Invisible zoomed out, glaring zoomed in, and the direct
  // cause of "the route doesn't pass underneath the marker".
  //
  // While tracking, the seam is a genuine route vertex instead. OSRM vertices
  // are only metres apart, so the seam still lands under the marker — but it
  // lands ON THE ROAD, because it IS the road.
  const splitPt = trackingStore ? null : pro ? { lat: pro.lat, lng: pro.lng } : null;
  const traversedData = useMemo(() => {
    if (!route || route.length < 2) return null;
    const pts = [...route.slice(0, progressIdx + 1), ...(splitPt ? [splitPt] : [])];
    return pts.length >= 2 ? lineFeature(pts) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, progressIdx, splitPt?.lat, splitPt?.lng]);
  const remainingData = useMemo(() => {
    if (!route || route.length < 2) return null;
    const pts = [...(splitPt ? [splitPt] : []), ...route.slice(progressIdx + 1)];
    return pts.length >= 2 ? lineFeature(pts) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, progressIdx, splitPt?.lat, splitPt?.lng]);

  // ── Camera: framed ONCE, then user-controlled (no fighting the finger) ──────
  // Tracking (has a route): fit the whole journey once → the driver glides
  // within view, user can pan/zoom freely. Booking: recenter only when the
  // patient's location actually changes (GPS / pin), not every render.
  const cameraRef = useRef<CameraRef>(null);
  const trackingCameraRef = useRef<TrackingCameraHandle>(null);
  // While the tracking camera owns the viewport, the legacy fit/fly effects
  // below must stay out of its way — two controllers issuing camera commands
  // is exactly the "map fights you" behaviour this replaces.
  const liveCamera = !!trackingStore;
  const didFit = useRef(false);
  // A bounding box needs actual area. When every point in `fitCoords` is the
  // same place (pro standing at the patient's door, two test phones on one
  // desk), fitBounds gets a zero-area box and MapLibre snaps the camera to a
  // meaningless zoom — the map just goes blank. Treat that as "no route" and
  // fly to the point instead.
  const fitSpan = useMemo(() => {
    if (!fitCoords || fitCoords.length < 2) return 0;
    const lngs = fitCoords.map((c) => c.lng);
    const lats = fitCoords.map((c) => c.lat);
    return Math.max(Math.max(...lngs) - Math.min(...lngs), Math.max(...lats) - Math.min(...lats));
  }, [fitCoords]);
  const hasRoute = fitSpan > 0.0004; // ≈45 m — below this there's nothing to frame

  useEffect(() => {
    if (liveCamera) return; // TrackingCamera owns the viewport
    const cam = cameraRef.current;
    if (!cam) return;
    if (follow) {
      // Navigation mode — keep the camera locked on the driver (tight zoom + tilt).
      cam.flyTo({ center: [center.lng, center.lat], zoom: 16.5, pitch: 50, duration: 700 });
      return;
    }
    if (hasRoute) {
      if (didFit.current) return;
      const lngs = fitCoords!.map((c) => c.lng);
      const lats = fitCoords!.map((c) => c.lat);
      cam.fitBounds(
        [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding: { top: 80, bottom: 280, left: 48, right: 48 }, duration: 700 },
      );
      didFit.current = true;
    } else {
      // Booking: slight 3-D tilt for a premium feel.
      cam.flyTo({ center: [center.lng, center.lat], zoom: radiusKm > 0 ? 14 : 15, pitch: radiusKm > 0 ? 30 : 0, duration: 500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRoute, center.lat, center.lng, radiusKm, follow, liveCamera]);

  // Re-center FAB → re-frame the route (tracking) or fly back to the patient (booking).
  useEffect(() => {
    if (recenterKey == null) return;
    if (liveCamera) {
      trackingCameraRef.current?.recenter();
      return;
    }
    const cam = cameraRef.current;
    if (!cam) return;
    if (hasRoute && fitCoords) {
      const lngs = fitCoords.map((c) => c.lng);
      const lats = fitCoords.map((c) => c.lat);
      cam.fitBounds(
        [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding: { top: 80, bottom: 280, left: 48, right: 48 }, duration: 600 },
      );
    } else {
      cam.flyTo({ center: [center.lng, center.lat], zoom: radiusKm > 0 ? 14 : 15, pitch: radiusKm > 0 ? 30 : 0, duration: 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  // Zoom-to-fit all pros (booking "envelope" button).
  useEffect(() => {
    if (fitAllKey == null || pros.length === 0) return;
    const cam = cameraRef.current;
    if (!cam) return;
    const pts = patient ? [...pros, patient] : pros;
    const lngs = pts.map((p) => p.lng);
    const lats = pts.map((p) => p.lat);
    cam.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 120, bottom: 90, left: 60, right: 60 }, duration: 600 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitAllKey]);

  return (
    <Map
      style={[StyleSheet.absoluteFill, style]}
      mapStyle={mapStyleSpec}
      attribution={false}
      logo={false}
      compass
      compassHiddenFacingNorth
      touchRotate
      touchPitch
      onRegionIsChanging={(e) => {
        // A real gesture, not our own easeTo. This is what stops the camera
        // fighting the finger.
        if (e.nativeEvent?.userInteraction) trackingCameraRef.current?.notifyUserGesture();
      }}
      onPress={(e: NativeSyntheticEvent<PressEvent | PressEventWithFeatures>) => {
        const coords = (e.nativeEvent as unknown as { geometry?: { coordinates?: number[] } })?.geometry
          ?.coordinates;
        if (!coords || coords.length < 2) return;
        const lng = coords[0];
        const lat = coords[1];
        // MapLibre ViewAnnotation children don't reliably receive taps, so we
        // resolve the tap here: if it lands near a pro pin, select that pro;
        // otherwise treat it as a location pick. (equirectangular ≈ fine at city scale)
        if (onSelectPro && pros.length) {
          let best: ProPinData | null = null;
          let bestKm = Infinity;
          for (const p of pros) {
            const dLat = (p.lat - lat) * 111;
            const dLng = (p.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
            const km = Math.sqrt(dLat * dLat + dLng * dLng);
            if (km < bestKm) {
              bestKm = km;
              best = p;
            }
          }
          if (best && bestKm <= 0.6) {
            onSelectPro(best.id);
            return;
          }
        }
        onMapPress?.({ lng, lat });
      }}
    >
      {/* Uncontrolled camera — positioned imperatively so the user stays in control */}
      {liveCamera && trackingStore ? (
        <TrackingCamera ref={trackingCameraRef} store={trackingStore} fallbackCenter={center} />
      ) : (
        <Camera ref={cameraRef} />
      )}

      {radiusData ? (
        <GeoJSONSource id="radius" data={radiusData}>
          <Layer id="radius-fill" type="fill" paint={{ "fill-color": primaryColor, "fill-opacity": 0.08 }} />
          <Layer id="radius-line" type="line" paint={{ "line-color": primaryColor, "line-width": 1.5 }} />
        </GeoJSONSource>
      ) : null}

      {/* Traversed portion — dimmed so the remaining route pops */}
      {traversedData ? (
        <GeoJSONSource id="route-done" data={traversedData}>
          <Layer
            id="route-done-l"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#B9B5D6", "line-width": 6, "line-opacity": 0.9 }}
          />
        </GeoJSONSource>
      ) : null}

      {/* Remaining route — white casing + solid navy core (premium, Uber-style) */}
      {remainingData ? (
        <GeoJSONSource id="route-rem" data={remainingData}>
          <Layer
            id="route-rem-casing"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#FFFFFF", "line-width": 11, "line-opacity": 0.95 }}
          />
          <Layer
            id="route-rem-l"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": primaryColor, "line-width": 6 }}
          />
          {/* dashed white centerline → adds a premium "lane" texture */}
          <Layer
            id="route-rem-dash"
            type="line"
            layout={{ "line-cap": "butt", "line-join": "round" }}
            paint={{ "line-color": "#FFFFFF", "line-width": 1.6, "line-opacity": 0.45, "line-dasharray": [2, 3] }}
          />
        </GeoJSONSource>
      ) : null}

      {patient ? (
        <ViewAnnotation lngLat={[patient.lng, patient.lat]} anchor="center">
          <MeMarker heading={meHeading} />
        </ViewAnnotation>
      ) : null}

      {destination ? (
        <ViewAnnotation lngLat={[destination.lng, destination.lat]} anchor="bottom">
          <DestinationPin />
        </ViewAnnotation>
      ) : null}

      {pros.map((p) => (
        <ViewAnnotation key={p.id} lngLat={[p.lng, p.lat]} anchor="center">
          <ProAvatarMarker
            pro={{
              avatarSource: p.avatarSource,
              avatarUrl: p.avatarUrl,
              initials: p.initials,
              specialty: p.specialty,
              name: p.name,
              rating: p.rating,
              distanceKm: p.distanceKm,
              priceMad: p.priceMad,
            }}
            selected={selectedProId === p.id}
            onPress={() => onSelectPro?.(p.id)}
          />
        </ViewAnnotation>
      ))}

      {liveCamera && trackingStore ? (
        // Live tracking: the marker subscribes to the store on its own leaf, so
        // moving it does not re-render this map or the screen around it.
        <LiveProMarker
          store={trackingStore}
          variant={trackingVariant}
          arrived={trackingArrived}
          avatarUrl={pro?.avatarUrl ?? null}
          avatarSource={pro?.avatarSource}
          initials={pro?.initials ?? ""}
        />
      ) : pro ? (
        <ViewAnnotation lngLat={[pro.lng, pro.lat]} anchor="center">
          <ProAvatarMarker
            pro={{ avatarSource: pro.avatarSource, avatarUrl: pro.avatarUrl, initials: pro.initials ?? "", specialty: pro.specialty, name: pro.name }}
            driver
            bearing={driverBearing}
          />
        </ViewAnnotation>
      ) : null}
    </Map>
  );
}
