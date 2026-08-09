/**
 * Nurse (pro) navigation screen — "go to the patient".
 * Shows the same labeled MapLibre map with the patient's destination pin, the
 * nurse's LIVE GPS position, and the road route between them. Plus the patient's
 * address, live distance/ETA, and a Google-Maps "Naviguer" hand-off + call.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Crosshair,
  MapPin,
  Phone,
} from "lucide-react-native";
import { CareLinkMapView, type LatLng } from "@/components/map/CareLinkMapView";
import { ManeuverBanner, TripStrip, type NavStatus } from "@/components/nav/ManeuverBanner";
import { LiveTrackingChannel } from "@/components/LiveTrackingChannel";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { haptics } from "@/lib/haptics";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useDeviceHeading } from "@/lib/hooks/useDeviceHeading";
import { useForegroundPosition } from "@/lib/hooks/useForegroundPosition";
import { fetchRoute, type RouteStep } from "@/lib/routing";
import { TrackingStore } from "@/lib/tracking/store";
import { Route } from "@/lib/tracking/route";
import { GuidanceRoute, arrivalClock } from "@/lib/tracking/guidance";
import { simulateTrip, syntheticLoop, type SimulationHandle } from "@/lib/tracking/simulate";
import type { Booking, BookingStatus, Profile } from "@/lib/db/types";

const NAVY = "#0D0870";
const MAP_CENTER: LatLng = { lat: 34.037, lng: -5.004 };
const PAID_STATUSES = new Set(["authorized", "captured"]);
const SHEET_PEEK = 108; // handle + title strip left visible when dragged down

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Lateral distance from the road that counts as genuinely off-route.
 *
 * Comfortably wider than urban GPS error (5-15 m) and than the motion
 * pipeline's own 25 m snap radius, so ordinary noise and a lane-level wander
 * never trigger a recompute — only actually taking a different street does.
 */
const OFF_ROUTE_M = 45;
/** Three consecutive fixes take ~4.5s to accumulate, so this never gates. */
const REROUTE_COOLDOWN_MS = 4000;
/** Standing at the door: nothing left to route. */
const ARRIVAL_RADIUS_KM = 0.06;
/**
 * Hard cap on automatic recomputes for one trip.
 *
 * A phone bouncing between two parallel streets — which is what the Fès medina
 * does to GPS — can otherwise loop forever, and every iteration is a request to
 * a routing server we do not own. Past the cap the last good route stays on
 * screen and the professional gets an explicit retry instead.
 */
const MAX_AUTO_REROUTES = 25;
/** Longest stretch the dev simulator will drive, in metres. */
const SIM_MAX_M = 2500;

export default function ProTrackingScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [patient, setPatient] = useState<Profile | null>(null);
  const [dest, setDest] = useState<LatLng | null>(null);
  const [nurse, setNurse] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  /** Metres travelled along `route`, map-matched. Drives guidance AND the map. */
  const [routeProgressM, setRouteProgressM] = useState<number | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [rerouteBudgetSpent, setRerouteBudgetSpent] = useState(false);
  /** Bumped to ask the map to re-frame on the professional. */
  const [recenterKey, setRecenterKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Safety gate: the patient accepting a bid only sets the booking to
  // `matched` — it does NOT mean money changed hands. `accept_bid` never
  // touches `payments`; the patient still has to clear a separate pay screen,
  // and can back out or kill the app before doing so. Until a real
  // `authorized`/`captured` payment row exists for this booking, the nurse
  // gets no map, no route, and no GPS broadcast — just a waiting state.
  const [paymentReady, setPaymentReady] = useState(false);

  /**
   * Re-read the payment rows for this booking.
   *
   * This exists as its own function because a SINGLE read at mount plus a
   * SINGLE realtime subscription turned out to be a trap: if the socket was
   * asleep, the JWT had just rotated, or the INSERT landed in the gap between
   * the first read and `subscribe()` resolving, `paymentReady` stayed false
   * forever and the nurse sat on "waiting for payment" for a job that was paid
   * minutes ago. There is no user action that recovers from that — the screen
   * has no map, no route and no controls. Reported from the field as "the pro
   * blocks even if the patient payed".
   */
  const refreshPayment = useCallback(async () => {
    if (!bookingId) return false;
    const pays = await db.payments.listForBookings([bookingId]).catch(() => null);
    if (!pays) return false; // network/RLS error — say nothing, try again later
    const paid = pays.some((p) => PAID_STATUSES.has(p.status));
    if (paid) setPaymentReady(true);
    return paid;
  }, [bookingId]);

  // ── Load booking + resolve the patient's destination coords ────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bookingId) { setLoading(false); return; }
      try {
        const b = await db.bookings.get(bookingId);
        if (cancelled) return;
        setBooking(b);
        if (!cancelled) void refreshPayment();
        if (b.patient_id) {
          const pf = await db.profiles.get(b.patient_id).catch(() => null);
          if (!cancelled) setPatient(pf);
        }
        // dest: get_track_coords (deployed) → geocode(address) → demo center
        let d: LatLng | null = null;
        try {
          const tc = await geo.getTrackCoords(b.id);
          d = tc.dest;
        } catch {
          /* RPC not deployed — fall through */
        }
        if (!d && b.address) d = await geo.geocodeAddress(b.address);
        // No MAP_CENTER fallback: defaulting to a hardcoded point in Fès meant
        // that whenever the RPC and the geocoder both came up empty, the app
        // confidently drew a road route to an address nobody lives at — and
        // measured "distance to patient" against it. If we don't know where the
        // patient is, we say so (no pin, no route) instead of inventing it.
        if (!cancelled) setDest(d);
      } catch {
        if (!cancelled) showToast(t("reservation_not_found"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  // Keep paymentReady live: the patient may still be sitting on the payment
  // screen when the nurse opens this one — unlock the map the instant a real
  // authorization/capture lands, no reload needed.
  useEffect(() => {
    if (!bookingId || paymentReady) return;
    const channel = supabase
      .channel(`payments:protrack:${bookingId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const row = payload.new as { status?: string } | null;
          if (row?.status && PAID_STATUSES.has(row.status)) setPaymentReady(true);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, paymentReady]);

  // Belt and braces for the same gate. Realtime is the FAST path, not the only
  // one: while we're still waiting we also re-read every 5s, and immediately
  // whenever the app comes back to the foreground (a socket that died while
  // the screen was backgrounded reconnects silently but replays nothing).
  useEffect(() => {
    if (!bookingId || paymentReady) return;
    const poll = setInterval(() => void refreshPayment(), 5000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPayment();
    });
    return () => {
      clearInterval(poll);
      sub.remove();
    };
  }, [bookingId, paymentReady, refreshPayment]);

  // Departure is an explicit act, never a side effect of opening a screen.
  //
  // This used to auto-advance `matched → en_route` on render, which meant that
  // merely LOOKING at the booking — to check the address, read the notes, see
  // who the patient was — started broadcasting the nurse's live location and
  // told the patient she was on her way. A professional reviewing a job before
  // leaving, still finishing another visit, or preparing equipment was silently
  // put on the map. `en_route` now happens only when they press "Je pars".
  //
  // The original motivation (85 bookings frozen in `matched`) is real, but the
  // fix for a stalled booking is the timeout sweep in migration 0027, not
  // lying about where a nurse is.

  // Stay honest about the booking's real status: this screen used to have no
  // idea if the booking was cancelled by the patient (or by this same pro,
  // navigating back into a stale copy of this screen) — "Terminer la
  // mission" would then fire against a booking that no longer existed. The
  // database itself now rejects that transition outright (0038), but the pro
  // should never even see an active-looking screen for a dead booking.
  const cancelledHandledRef = useRef(false);
  useEffect(() => {
    if (!bookingId) return;
    const channel = supabase
      .channel(`booking:protrack:${bookingId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => {
          const next = payload.new as Booking;
          setBooking(next);
          if (next.status === "cancelled" && !cancelledHandledRef.current) {
            cancelledHandledRef.current = true;
            Alert.alert(t("reservation_cancelled_title"), t("reservation_cancelled_msg"), [
              { text: "OK", onPress: () => router.back() },
            ]);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, router, t]);

  // While en route, positions come from the background location service via
  // <LiveTrackingChannel mode="broadcast"> below (it owns the GPS and is the
  // only thing that publishes). Before departure and after arrival nothing is
  // being shared, so a light foreground watch keeps the nurse visible on their
  // own map without running a second watch against the sensor.
  // Same motion pipeline the patient sees, so the nurse's own dot is smoothed
  // and map-matched identically. Sharing it is not just tidiness: if the two
  // sides smoothed differently, a nurse comparing her screen with the patient's
  // would see two different positions for herself.
  const trackingStore = useMemo(() => new TrackingStore(), []);
  useEffect(() => () => trackingStore.destroy(), [trackingStore]);
  useEffect(() => {
    trackingStore.setRoute(route ?? null);
    // `setRoute` re-matches every buffered fix against the new geometry, so the
    // offset is already correct for it. Reading it here rather than waiting for
    // the next fix matters after a re-route: otherwise the banner spends up to
    // a second measuring the OLD offset against the NEW maneuvers, which is a
    // countdown to the wrong junction.
    setRouteProgressM(trackingStore.renderOffsetM ?? trackingStore.routeOffsetM ?? null);
  }, [trackingStore, route]);

  /**
   * True while the dev simulator owns the position stream.
   *
   * A ref, not state, because it is read inside the position callback and must
   * be correct on the very next fix rather than on the next render.
   */
  const simOwnsPositionRef = useRef(false);

  const pushPosition = useCallback(
    (p: { lat: number; lng: number; heading?: number | null; speed?: number | null; accuracy?: number | null; seq?: number | null }) => {
      setNurse({ lat: p.lat, lng: p.lng });
      trackingStore.push({
        lat: p.lat,
        lng: p.lng,
        heading: p.heading ?? null,
        speed: p.speed ?? null,
        accuracy: p.accuracy ?? null,
        seq: p.seq ?? Date.now(),
        receivedAt: Date.now(),
      });
      // The RENDER offset, not the raw one. The banner has to agree with the
      // avatar and with the colour seam; reading the newest fix's offset here
      // would put the turn countdown a render delay ahead of the marker, which
      // is the same defect as the seam and just as visible at the junction.
      setRouteProgressM(trackingStore.renderOffsetM ?? trackingStore.routeOffsetM ?? null);
    },
    [trackingStore],
  );

  /**
   * Positions arriving from the device.
   *
   * Dropped while the simulator is driving. Without this the two streams
   * interleave: the real GPS keeps reporting the phone parked on a desk while
   * the simulator reports a vehicle moving away from it, and every alternation
   * is a jump the motion filter correctly rejects as a teleport — so the marker
   * sits perfectly still and the run says nothing. In production the ref is
   * always false and this is a straight pass-through.
   */
  const onNursePosition = useCallback(
    (p: { lat: number; lng: number; heading?: number | null; speed?: number | null; accuracy?: number | null; seq?: number | null }) => {
      if (simOwnsPositionRef.current) return;
      pushPosition(p);
    },
    [pushPosition],
  );
  const broadcasting = booking?.status === "en_route";
  // `request: true` — this is the one screen where asking is unambiguous: the
  // nurse opened her navigation to a patient. Everywhere else location is
  // incidental and the hook stays silent.
  const ownPosition = useForegroundPosition(!broadcasting, { request: true });
  useEffect(() => {
    if (!broadcasting && ownPosition) {
      setNurse(ownPosition);
      trackingStore.push({
        lat: ownPosition.lat, lng: ownPosition.lng,
        heading: null, speed: null, accuracy: null,
        seq: Date.now(), receivedAt: Date.now(),
      });
      setRouteProgressM(trackingStore.routeOffsetM ?? null);
    }
  }, [broadcasting, ownPosition, trackingStore]);

  // Arrival is NEVER inferred from GPS proximity. It used to auto-advance
  // `en_route → in_progress` within 80 m of `dest`, which fired on a coarse
  // geocoded destination and told the patient "Arrivé !" while the pro was
  // still on the road. Only the pro pressing "Je suis arrivé" below moves the
  // booking forward.

  // ── Fetch the road route, and re-fetch if the nurse drifts off it ──────────
  // Used to fetch exactly once (`routeFetched.current` latch) and never again
  // — if the nurse took a different street than OSRM's first guess, the drawn
  // line just stayed put, disconnected from where they actually were. Now it
  // re-routes whenever the live position strays ~75m from the drawn path.
  const reroutingRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const hasRouteRef = useRef(false);
  const rerouteCountRef = useRef(0);

  const computeRoute = useCallback(
    async (origin: LatLng, destination: LatLng) => {
      reroutingRef.current = true;
      lastRerouteAtRef.current = Date.now();
      setRecalculating(true);
      try {
        const { coords, steps, fromRouter } = await fetchRoute(origin, destination, { steps: true });
        // OSRM snaps the endpoint to the nearest road, which can leave the line
        // stopping 10-20m short of the actual door — the route visibly ending
        // beside the destination pin instead of inside it. Walking the last leg
        // is both what navigation apps draw and what the nurse will physically
        // do. The patient's screen has always done this; the pro's did not, so
        // the two sides drew subtly different roads for the same journey.
        const last = coords[coords.length - 1];
        const withFinalLeg =
          last && haversineKm(last, destination) > 0.003 ? [...coords, destination] : coords;

        setRoute(withFinalLeg);
        setRouteSteps(steps);
        // A straight-line fallback is not a route. Leaving the flag false lets
        // the next fix retry immediately instead of waiting out the cooldown.
        hasRouteRef.current = fromRouter && coords.length >= 2;
      } finally {
        reroutingRef.current = false;
        setRecalculating(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!nurse || !dest) return;

    // Standing at the door: nothing to route. Clearing beats drawing a residual
    // squiggle between two points that are the same place.
    if (haversineKm(nurse, dest) <= ARRIVAL_RADIUS_KM) {
      hasRouteRef.current = false;
      setRoute(null);
      setRouteSteps([]);
      setRouteProgressM(null);
      return;
    }

    // RE-ROUTE ON LATERAL DEVIATION, NOT ON DISTANCE TRAVELLED.
    //
    // This previously refetched whenever the nurse moved 60m from the point the
    // route was computed FROM — which, for someone correctly FOLLOWING the
    // route, meant a fresh route every 60m: roughly every five seconds at
    // 40 km/h, throttled only by a 10s cooldown. Every one of those rebuilt the
    // instruction list from scratch and reset it to the first step, and every
    // one was a request to a routing server we do not own.
    //
    // Travelling along a road is not a reason to recompute it. Being off it is.
    // REALITY WINS OVER THE PLAN — but only once reality has said so more than
    // once: a single 60m outlier is a multipath bounce off a building, and
    // re-routing on it would discard a perfectly good road.
    const haveRoute = !!route && route.length >= 2 && hasRouteRef.current;
    const offRoute = haveRoute && trackingStore.isOffRoute(OFF_ROUTE_M, 3);

    if (haveRoute && !offRoute) return;
    if (reroutingRef.current) return;
    // The cooldown is applied to every ATTEMPT, not only to successful ones.
    //
    // Gating it on `haveRoute` looked right and was a hot loop: a failed route
    // returns the straight-line fallback, which leaves `hasRouteRef` false, so
    // `haveRoute` stayed false, so the cooldown was skipped and the effect
    // refetched on every single render for as long as the router was down.
    // The very first request is still immediate — the timestamp starts at 0.
    if (Date.now() - lastRerouteAtRef.current < REROUTE_COOLDOWN_MS) return;

    // Only deviations count against the budget. The first route of a trip, and
    // a retry after a routing failure, must never be rationed.
    if (haveRoute) {
      rerouteCountRef.current += 1;
      if (rerouteCountRef.current > MAX_AUTO_REROUTES) {
        setRerouteBudgetSpent(true);
        return;
      }
    }

    void computeRoute(nurse, dest);
  }, [nurse, dest, route, trackingStore, computeRoute]);

  /** Manual recompute, offered once the automatic budget is exhausted. */
  const retryRoute = useCallback(() => {
    rerouteCountRef.current = 0;
    lastRerouteAtRef.current = 0; // an explicit tap should not wait out a cooldown
    setRerouteBudgetSpent(false);
    if (nurse && dest) void computeRoute(nurse, dest);
  }, [nurse, dest, computeRoute]);

  // Compass heading for the pre-departure marker. Smoothing is NOT done here:
  // useGlidingPosition called setState every animation frame from this screen,
  // re-rendering the map, the nav strip and the sheet to move one dot. The
  // motion pipeline in TrackingStore does it outside React instead.
  const meHeading = useDeviceHeading();

  // Arrival retires the navigation: no route, no turn instructions. The nurse
  // is standing at the door; continuing to show "in 200m, turn left" is noise
  // at exactly the moment she needs the mission controls instead.
  useEffect(() => {
    if (booking?.status !== "in_progress") return;
    hasRouteRef.current = false;
    setRoute(null);
    setRouteSteps([]);
    setRouteProgressM(null);
    trackingStore.setRoute(null);
  }, [booking?.status, trackingStore]);

  // ── Dev-only trip simulator ───────────────────────────────────────────────
  // Publishes a synthetic drive along the real route onto the real channel, so
  // the patient screen can be judged for FEEL without two people driving. Not a
  // replacement for an outdoor test — real multipath, tunnels and thermal
  // behaviour only appear outside — but it makes the UX reviewable indoors.
  const simRef = useRef<SimulationHandle | null>(null);
  const [simulating, setSimulating] = useState(false);
  const PERSONALITIES = ["normal", "calm", "aggressive"] as const;
  const personalityIdx = useRef(0);
  useEffect(() => () => simRef.current?.stop(), []);
  const toggleSimulation = useCallback(async (wrongTurn = false) => {
    if (simRef.current) {
      simRef.current.stop();
      simRef.current = null;
      simOwnsPositionRef.current = false;
      // Hand the pipeline back to the device cleanly: the next real fix is
      // wherever the phone actually is, which is a long way from where the
      // simulation left the marker, and without a reset that first honest fix
      // would be thrown away as a teleport.
      trackingStore.reset();
      setSimulating(false);
      return;
    }
    if (!bookingId) return;

    // Drive a REAL APPROACH TO THE PATIENT, not a loop.
    //
    // The first version drove a synthetic circle around the current position.
    // But the patient's screen draws OSRM(marker -> patient's home), so the
    // route on screen was "how to get home from here" while the marker drove a
    // circle. They diverged permanently: the marker appeared to leave the
    // route, map-matching correctly refused to engage (it is off-road), motion
    // fell back to free-space splining and looked like sliding, and heading
    // came from noisy fix geometry instead of the street. Three of the four
    // reported symptoms, all from feeding the pipeline a path that was not the
    // route.
    //
    // Starting ~1.6km away and following the real road in means the drawn route
    // and the driven path are the same geometry, so map-matching engages and
    // the marker is glued to the street exactly as in production.
    // DRIVE AWAY FROM WHERE THE PROFESSIONAL ACTUALLY IS.
    //
    // This used to start 1.6 km from the DESTINATION, which works when the run
    // is being judged on the patient's screen but is unusable on this one: with
    // the patient 70 km away (a real test: pro in Fès, patient in Meknès) every
    // synthetic fix was 70 km from the last real one, and `MotionTrack.push`
    // rejected all of them as teleports — correctly. The marker never moved and
    // the run said nothing.
    //
    // Starting at the professional's own position keeps the fixes contiguous
    // with their real GPS, and drives the first stretch of the ACTUAL route, so
    // the road on screen and the road being driven are the same geometry.
    const target = dest ?? nurse;
    const origin = nurse ?? dest;
    if (!target || !origin) {
      showToast("Position inconnue — impossible de simuler");
      return;
    }
    setSimulating(true);
    // Take the stream before the first synthetic fix lands, and clear whatever
    // the device put in the pipeline so the handover is not read as a jump.
    simOwnsPositionRef.current = true;
    trackingStore.reset();
    const who = PERSONALITIES[personalityIdx.current % PERSONALITIES.length];
    personalityIdx.current += 1;
    showToast(`Conducteur : ${who}`);

    const { coords, fromRouter } = await fetchRoute(origin, target);
    // A straight line is not a road; map-matching would rightly distrust it and
    // the run would tell us nothing about the real experience.
    let path = fromRouter && coords.length >= 2 ? coords : syntheticLoop(origin, 500);
    if (!fromRouter) showToast("Routage indisponible — boucle synthétique");
    // A cross-city job is a 70 km road. Driving all of it at realistic speed is
    // an hour-long run; the first couple of kilometres contain every junction
    // type worth looking at.
    if (fromRouter) {
      const full = new Route(path);
      if (full.usable && full.length > SIM_MAX_M) {
        const stepM = 8;
        const truncated: LatLng[] = [];
        for (let m = 0; m <= SIM_MAX_M; m += stepM) {
          const at = full.positionAt(m);
          if (at) truncated.push(at.point);
        }
        path = truncated;
      }
    }

    simRef.current = simulateTrip({
      bookingId,
      path,
      // Cycles per run so successive tests are not the same driver: a calm
      // one hesitates at lights, an aggressive one brakes late into bends.
      personality: PERSONALITIES[personalityIdx.current % PERSONALITIES.length],
      intervalMs: 1500,
      jitterM: 6,
      // Scenario B: leave the planned road partway and drive a genuinely
      // different one to the same destination, so the whole deviation path is
      // observable — snapping disengaging, the eased correction back to real
      // GPS, the re-route, and the new road replacing the old.
      wrongTurnAtMs: wrongTurn ? 35_000 : undefined,
      destination: wrongTurn ? target : undefined,
      onWrongTurn: () => showToast("Mauvais virage — déviation en cours"),
      // Feed the local pipeline too. Broadcasting alone only drives the
      // PATIENT's map — this screen reads the device GPS, not the channel.
      //
      // The seq is REWRITTEN on the way in. The simulator numbers its own
      // fixes from 1, while real fixes arriving from the device carry
      // `Date.now()`; `MotionTrack` drops anything whose seq is not greater
      // than the last one it accepted, so a simulator started after even one
      // real fix had every single sample rejected as stale-seq and the marker
      // sat still. Wall-clock keeps it monotonic against both sources.
      onFix: (f) => pushPosition({ ...f, seq: Date.now() }),
      // A 10s dropout partway, so dead reckoning and the staleness banner are
      // exercised in the same run rather than needing a separate tunnel test.
      outage: wrongTurn ? undefined : [30_000, 40_000],
      onDone: () => {
        simRef.current = null;
        // Release the stream, or the device's own fixes stay blocked for the
        // rest of the session: the marker goes stale, `routeOffsetM` never
        // updates again, and the banner sits on "calculating" forever.
        simOwnsPositionRef.current = false;
        trackingStore.reset();
        setSimulating(false);
        showToast("Simulation terminée");
      },
    });
  }, [bookingId, nurse, dest, pushPosition, trackingStore]);

  const advance = useCallback(
    async (status: BookingStatus, doneMsg: string) => {
      if (!bookingId || busy) return;
      // Belt-and-suspenders: don't even try against local state we already
      // know is terminal (the DB trigger would reject it anyway, but this
      // skips a pointless round-trip and a confusing error toast for it).
      if (booking?.status === "completed" || booking?.status === "cancelled") {
        Alert.alert(t("reservation_cancelled_title"), t("reservation_cancelled_msg"), [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }
      setBusy(true);
      try {
        const b = await db.bookings.setStatus(bookingId, status);
        setBooking(b);
        haptics.success();
        showToast(doneMsg);
        if (status === "completed") router.back();
      } catch (error) {
        // The booking may have just been cancelled by someone else between
        // our last render and this tap — the DB trigger (0038) rejects the
        // update and tells us exactly that.
        showToast(error instanceof Error ? error.message : t("action_failed"));
      } finally {
        setBusy(false);
      }
    },
    [bookingId, busy, booking?.status, router, t],
  );

  // RULE #4 — cancellation caused BY the nurse: the RPC refunds the client in full
  // and debits a penalty from the nurse's balance.
  const cancelByNurse = useCallback(() => {
    if (!bookingId || busy) return;
    Alert.alert(t("cancel_job"), t("cancel_job_confirm"), [
      { text: t("keep"), style: "cancel" },
      {
        text: t("cancel_job"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await db.bookings.cancelBooking(bookingId, "pro_cancelled");
            haptics.success();
            showToast(t("job_cancelled"));
            router.back();
          } catch {
            showToast(t("action_failed"));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [bookingId, busy, router, t]);

  const patientName = patient?.full_name ?? t("patient");
  // Straight-line, and deliberately so: this is the ~200m courtesy gate on the
  // "I have arrived" button, which is a question about physical proximity, not
  // about how far there is left to drive.
  const distanceKm = nurse && dest ? haversineKm(nurse, dest) : null;
  const status = booking?.status;
  const farFromPatient = distanceKm != null && distanceKm > 0.2;

  // ── Guidance ───────────────────────────────────────────────────────────────
  // Built from the SAME coordinate array handed to the tracking store, so the
  // offsets the store map-matches and the offsets the maneuvers sit at are
  // measured along one geometry. Two `Route` instances over one array are
  // deterministic, so they agree by construction rather than by luck.
  const guidanceRoute = useMemo(
    () => (route && route.length >= 2 ? new GuidanceRoute(route, routeSteps) : null),
    [route, routeSteps],
  );

  /**
   * The polyline to DRAW — sampled along the same curve the marker walks.
   *
   * Derived synchronously here rather than read back off the store: `setRoute`
   * runs in an effect AFTER render, so reading `store.renderRoute` during
   * render draws the PREVIOUS curve for one frame, and because a store getter
   * cannot trigger a re-render it can keep drawing the stale line indefinitely.
   */
  const drawnRoute = useMemo(
    () => (route && route.length >= 2 ? new Route(route).renderPath() : route),
    [route],
  );

  const guidance = useMemo(
    () => (guidanceRoute && routeProgressM != null ? guidanceRoute.at(routeProgressM) : null),
    [guidanceRoute, routeProgressM],
  );

  const navigating = status === "matched" || status === "en_route";
  const navStatus: NavStatus = !nurse
    ? "locating"
    : recalculating
      ? "recalculating"
      : !route
        ? "calculating"
        : !guidanceRoute?.usable
          ? "unavailable"
          : guidance
            ? "guiding"
            : "calculating";

  // Clock time beats a duration for someone planning a day — "am I making my
  // 15:00?" is answered directly instead of by mental arithmetic.
  const arrivalAt =
    guidance?.remainingS != null && guidance.remainingS > 0 ? arrivalClock(guidance.remainingS) : null;

  // A booking that has moved past `matched` was, by construction, already past
  // this gate once — `en_route` is only reachable by pressing "Je pars" on the
  // unlocked screen. So if we can't read the payment row (RLS hiccup, offline,
  // realtime miss) but the booking says the trip is underway, the right answer
  // is to trust the booking rather than lock a nurse out of her own navigation
  // mid-journey.
  const paymentSettled =
    paymentReady || status === "en_route" || status === "in_progress";

  const fit = nurse && dest ? [nurse, dest] : undefined;

  // Sheet drag: pull the handle down to see the full map, back up to restore
  // the mission card. Measured on layout since its content height varies
  // (address line, action row, status button, etc.) — not a fixed constant.
  const [sheetHeight, setSheetHeight] = useState(0);
  /**
   * Mirrors the sheet's drag state on the JS thread.
   *
   * The camera needs to know how much of the map is actually covered so it can
   * hold the marker above it, and the translation itself lives in a shared
   * value the render pass cannot read. Only the settled state matters — the
   * camera should not chase the sheet mid-drag.
   */
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const sheetTranslateY = useSharedValue(0);
  const sheetDragStart = useSharedValue(0);
  const sheetMaxTranslate = Math.max(0, sheetHeight - SHEET_PEEK);
  const sheetPan = Gesture.Pan()
    .onStart(() => {
      sheetDragStart.value = sheetTranslateY.value;
    })
    .onUpdate((e) => {
      const next = sheetDragStart.value + e.translationY;
      sheetTranslateY.value = Math.max(0, Math.min(sheetMaxTranslate, next));
    })
    .onEnd((e) => {
      const shouldCollapse = sheetTranslateY.value > sheetMaxTranslate / 2 || e.velocityY > 800;
      sheetTranslateY.value = withSpring(shouldCollapse ? sheetMaxTranslate : 0, {
        damping: 22,
        stiffness: 220,
      });
      runOnJS(setSheetCollapsed)(shouldCollapse);
    });
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  if (!loading && !paymentSettled && status !== "completed" && status !== "cancelled") {
    return (
      <View style={s.waitRoot}>
        <TouchableOpacity style={[s.iconBtn, s.waitBack]} onPress={() => router.back()} accessibilityLabel={t("back")}>
          <ArrowLeft size={20} color="#1F2937" strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={s.waitCard}>
          <ActivityIndicator color={NAVY} size="large" />
          <Text style={s.waitTitle}>{t("waiting_payment_title")}</Text>
          <Text style={s.waitSub}>{t("waiting_payment_msg")}</Text>
          <View style={s.waitPatientRow}>
            <View style={s.avatar}><Text style={s.avatarTxt}>{patientName.slice(0, 1).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{patientName}</Text>
              <Text style={s.care} numberOfLines={1}>{(booking?.specialty ?? "").replaceAll("_", " ")}</Text>
            </View>
            <Text style={s.price}>{booking?.final_price_mad ?? booking?.budget_max_mad ?? "—"} {t("mad")}</Text>
          </View>
          {/* The automatic paths above should always win. This is here so that
              a nurse who KNOWS the patient has paid is never reduced to force-
              quitting the app to find out. */}
          <TouchableOpacity
            style={s.waitRetry}
            onPress={() => {
              void refreshPayment().then((paid) => {
                if (!paid) showToast(t("waiting_payment_title"));
              });
            }}
            accessibilityRole="button"
          >
            <Text style={s.waitRetryTxt}>{t("retry")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Broadcast the nurse's real GPS to the patient's live tracking — only
          once a real payment exists, per the gate above, and only while the
          trip is actually `en_route`. Before departure there is nothing to
          share; after arrival the patient is standing next to them and
          continuing to transmit is battery drain plus a privacy problem. */}
      {bookingId && paymentSettled ? (
        <LiveTrackingChannel
          bookingId={bookingId}
          mode="broadcast"
          onPosition={onNursePosition}
          active={status === "en_route"}
        />
      ) : null}

      <View style={[s.mapWrap, StyleSheet.absoluteFillObject]}>
        {loading ? (
          <View style={s.center}><ActivityIndicator color={NAVY} /></View>
        ) : (
          <CareLinkMapView
            center={nurse ?? dest ?? MAP_CENTER}
            meHeading={meHeading}
            destination={dest ?? undefined}
            // The SMOOTHED curve — exactly the path the marker walks.
            route={drawnRoute ?? undefined}
            // The seam comes from the store's per-frame RENDER offset, so it
            // depicts the same instant as the avatar. `trackingProgressM` is
            // kept as the fallback for the frames before the first match.
            trackingProgressFromStore
            trackingProgressM={routeProgressM}
            // Keep the marker clear of the sheet. Without this the camera
            // centres it in the full map view — which, with the sheet open, is
            // underneath the sheet. Passed as camera padding, so the map itself
            // stays full-bleed and dominant.
            trackingPaddingBottom={sheetCollapsed ? SHEET_PEEK : sheetHeight}
            fitCoords={fit}
            trackingStore={trackingStore}
            trackingVariant="self"
            radiusKm={0}
            nightAuto
            recenterKey={recenterKey}
          />
        )}

        {/* Turn-by-turn banner (our own map — no external app) */}
        <View style={s.navBar} pointerEvents="box-none">
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} accessibilityLabel={t("back")}>
            <ArrowLeft size={20} color="#1F2937" strokeWidth={2.4} />
          </TouchableOpacity>
          {/* Retired at arrival: the nurse is standing at the door, and "in
              200m, turn left" is noise at exactly the moment she needs the
              mission controls instead. */}
          {navigating ? (
            <ManeuverBanner status={navStatus} guidance={guidance} t={t} />
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>

        {/* Floating controls sit just above the sheet and ride down with it, so
            dragging the sheet away reveals more map instead of stranding the
            buttons underneath it. */}
        {navigating ? (
          <Animated.View
            style={[s.mapControls, { bottom: sheetHeight + 12 }, sheetAnimatedStyle]}
            pointerEvents="box-none"
          >
            {/* Automatic recomputes are capped so a GPS-hostile street cannot
                loop against the routing server. Past the cap she asks. */}
            {rerouteBudgetSpent ? (
              <TouchableOpacity style={s.retryRoute} onPress={retryRoute} accessibilityRole="button">
                <Text style={s.retryRouteTxt}>{t("retry")}</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            {/* The camera stops following the moment she pans, by design, so
                there has to be one tap back. */}
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => setRecenterKey((k) => k + 1)}
              accessibilityLabel={t("nav_recenter")}
              accessibilityRole="button"
            >
              <Crosshair size={20} color={NAVY} strokeWidth={2.4} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </View>

      {/* Bottom card — draggable: pull down to see the full map. */}
      <Animated.View
        style={[s.sheet, sheetAnimatedStyle]}
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
      >
        <GestureDetector gesture={sheetPan}>
          <View style={s.handleZone}>
            <View style={s.handle} />
          </View>
        </GestureDetector>
        {/* Sits in the peek strip on purpose: dragging the sheet down to see
            the map must never hide how much journey is left or when she gets
            there. Falls back to the title before there is a route to measure. */}
        {navigating && guidance ? (
          <View style={s.tripRow}>
            <TripStrip
              remainingM={guidance.remainingM}
              remainingS={guidance.remainingS}
              arrivalAt={arrivalAt}
              t={t}
            />
          </View>
        ) : (
          // "En route vers le patient" was printed on every state including
          // finished and cancelled missions, which is simply untrue by the time
          // someone opens one from their history.
          <Text style={s.title}>
            {status === "completed"
              ? t("mission_completed")
              : status === "cancelled"
                ? t("job_cancelled")
                : status === "in_progress"
                  ? t("mission_in_progress")
                  : t("en_route_to_patient")}
          </Text>
        )}

        <View style={s.row}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{patientName.slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{patientName}</Text>
            <Text style={s.care} numberOfLines={1}>{(booking?.specialty ?? "").replaceAll("_", " ")}</Text>
          </View>
          <View style={s.priceCol}>
            <Text style={s.price}>{booking?.final_price_mad ?? booking?.budget_max_mad ?? "—"}</Text>
            <Text style={s.priceUnit}>{t("mad")}</Text>
          </View>
        </View>

        {booking?.address ? (
          <View style={s.addrRow}>
            <MapPin size={15} color={NAVY} />
            <Text style={s.addr} numberOfLines={2}>{booking.address}</Text>
          </View>
        ) : null}

        <View style={s.actions}>
          <TouchableOpacity
            style={[s.actBtn, s.actGhost]}
            onPress={() => {
              if (patient?.phone) void Linking.openURL(`tel:${patient.phone}`);
              else showToast(t("number_unavailable"));
            }}
          >
            <Phone size={17} color={NAVY} strokeWidth={2.2} />
            <Text style={s.actGhostTxt}>{t("call_patient")}</Text>
          </TouchableOpacity>
        </View>

        {/* Nurse journey: matched → en_route (out) → in_progress → completed */}
        {status === "matched" ? (
          <TouchableOpacity style={s.statusBtn} disabled={busy} onPress={() => advance("en_route", t("en_route_toast"))}>
            <Text style={s.statusTxt}>{t("im_leaving")}</Text>
          </TouchableOpacity>
        ) : status === "en_route" ? (
          <TouchableOpacity
            style={[s.statusBtn, farFromPatient && s.statusBtnFar]}
            disabled={busy}
            onPress={() => {
              // ~200m courtesy check — a professional confirmation shouldn't be
              // tappable from across town. If we have no live GPS or no known
              // destination, trust the manual tap instead of blocking a mission
              // that has to move forward somehow. This tap is the ONLY thing
              // that marks arrival; nothing infers it from proximity.
              if (farFromPatient) {
                showToast(t("too_far_to_arrive"));
                return;
              }
              advance("in_progress", t("mission_started"));
            }}
          >
            <Text style={s.statusTxt}>{t("i_arrived")}</Text>
          </TouchableOpacity>
        ) : status === "in_progress" ? (
          <TouchableOpacity style={[s.statusBtn, s.statusDone]} disabled={busy} onPress={() => advance("completed", t("mission_completed"))}>
            <CheckCircle2 size={18} color="#FFFFFF" />
            <Text style={s.statusTxt}>{t("end_mission")}</Text>
          </TouchableOpacity>
        ) : null}

        {/* RULE #4 — nurse-initiated cancellation (penalty applies) */}
        {__DEV__ && status === "matched" ? (
          <Text style={s.simHint}>
            Simulation dev : disponible après « {t("im_leaving")} »
          </Text>
        ) : null}

        {__DEV__ && status === "en_route" ? (
          simulating ? (
            <TouchableOpacity
              style={[s.statusBtn, s.statusBtnFar]}
              onPress={() => void toggleSimulation()}
            >
              <Text style={s.statusTxt}>Arrêter la simulation</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.simRow}>
              <TouchableOpacity
                style={[s.statusBtn, s.simBtn, s.simHalf]}
                onPress={() => void toggleSimulation(false)}
              >
                <Text style={s.simTxt}>Trajet normal (dev)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.statusBtn, s.simBtnAlt, s.simHalf]}
                onPress={() => void toggleSimulation(true)}
              >
                <Text style={s.simTxt}>Mauvais virage (dev)</Text>
              </TouchableOpacity>
            </View>
          )
        ) : null}

        {status !== "completed" && status !== "cancelled" ? (
          <TouchableOpacity style={s.cancelJobBtn} disabled={busy} onPress={cancelByNurse}>
            <Text style={s.cancelJobTxt}>{t("cancel_job")}</Text>
          </TouchableOpacity>
        ) : null}

        {bookingId ? (
          <TouchableOpacity
            style={s.reportLink}
            onPress={() => router.push(`/pro/report/${bookingId}`)}
            accessibilityRole="button"
          >
            <AlertTriangle size={14} color="#E24B4A" />
            <Text style={s.reportLinkTxt}>{t("report_patient_link")}</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  mapWrap: { flex: 1, position: "relative", backgroundColor: "#EDE5CC" },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: 52, paddingHorizontal: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 16,
    borderRadius: 999, backgroundColor: "#FFFFFF",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  pillDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#22D3EE" },
  pillTxt: { fontSize: 14, fontWeight: "700", color: "#111827" },

  navBar: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 50, paddingHorizontal: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  mapControls: {
    position: "absolute", left: 14, right: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  retryRoute: {
    height: 40, paddingHorizontal: 22, borderRadius: 20, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  retryRouteTxt: { color: NAVY, fontSize: 14, fontWeight: "700" },
  tripRow: { marginBottom: 14, minHeight: 26, justifyContent: "center" },

  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 22, paddingTop: 4, paddingBottom: 30,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 12,
  },
  handleZone: { paddingTop: 10, paddingBottom: 8, alignItems: "center" },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB" },
  title: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#EDE5CC", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: NAVY, fontSize: 18, fontWeight: "800" },
  name: { fontSize: 16, fontWeight: "700", color: "#111827" },
  care: { fontSize: 12, color: "#6B7280", marginTop: 2, textTransform: "capitalize" },
  priceCol: { alignItems: "flex-end" },
  price: { fontSize: 24, fontWeight: "800", color: NAVY, lineHeight: 26 },
  priceUnit: { fontSize: 11, color: "#9CA3AF", fontWeight: "600" },
  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#F7F5EE", borderRadius: 12, padding: 12, marginBottom: 14 },
  addr: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 18 },
  actions: { flexDirection: "row", gap: 12, marginBottom: 12 },
  actBtn: { flex: 1, height: 52, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actPrimary: { backgroundColor: NAVY },
  actPrimaryTxt: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  actGhost: { backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#E5E7EB" },
  actGhostTxt: { color: NAVY, fontSize: 15, fontWeight: "700" },
  statusBtn: {
    height: 52, borderRadius: 16, backgroundColor: "#16A34A",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  statusDone: { backgroundColor: NAVY },
  statusBtnFar: { backgroundColor: "#9CA3AF" },
  simBtn: { backgroundColor: "#7C3AED" },
  simBtnAlt: { backgroundColor: "#B45309" },
  simRow: { flexDirection: "row", gap: 8 },
  simHalf: { flex: 1, paddingHorizontal: 4 },
  simTxt: { color: "#FFFFFF", fontWeight: "700", fontSize: 12, textAlign: "center" },
  simHint: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 8 },
  statusTxt: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  cancelJobBtn: { height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  cancelJobTxt: { color: "#E24B4A", fontSize: 14, fontWeight: "700" },
  reportLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  reportLinkTxt: { color: "#E24B4A", fontSize: 13, fontWeight: "600" },

  waitRoot: { flex: 1, backgroundColor: "#F7F5EE", paddingHorizontal: 20 },
  waitBack: { marginTop: 52, marginBottom: 10 },
  waitCard: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 80,
  },
  waitTitle: { fontSize: 19, fontWeight: "800", color: "#111827", textAlign: "center", marginTop: 4 },
  waitSub: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20, paddingHorizontal: 12 },
  waitPatientRow: {
    flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, width: "100%",
    backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  waitRetry: {
    marginTop: 14, height: 44, paddingHorizontal: 26, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF",
  },
  waitRetryTxt: { color: NAVY, fontSize: 14, fontWeight: "700" },
});
