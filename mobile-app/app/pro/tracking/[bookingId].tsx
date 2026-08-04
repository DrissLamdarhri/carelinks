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
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  MapPin,
  Phone,
} from "lucide-react-native";
import { CareLinkMapView, type LatLng } from "@/components/map/CareLinkMapView";
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
import { fetchRoute } from "@/lib/routing";
import { TrackingStore } from "@/lib/tracking/store";
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

// ── In-app turn-by-turn (OSRM maneuvers → French instructions) ───────────────
type NavStep = { instruction: string; loc: LatLng; dir: "left" | "right" | "straight" | "arrive" };

function parseManeuver(m: { type?: string; modifier?: string }, name: string, t: (k: string) => string): { instruction: string; dir: NavStep["dir"] } {
  const type = m?.type ?? "";
  const mod = m?.modifier ?? "";
  const on = name ? ` ${t("nav_on")} ${name}` : "";
  if (type === "arrive") return { instruction: t("you_arrived"), dir: "arrive" };
  if (type === "depart") return { instruction: name ? `${t("nav_take")} ${name}` : t("nav_start"), dir: "straight" };
  if (type === "roundabout" || type === "rotary") return { instruction: `${t("nav_roundabout")}${on}`, dir: "straight" };
  if (mod.includes("left")) return { instruction: `${t("nav_turn_left")}${on}`, dir: "left" };
  if (mod.includes("right")) return { instruction: `${t("nav_turn_right")}${on}`, dir: "right" };
  return { instruction: `${t("nav_straight")}${on}`, dir: "straight" };
}

function fmtDist(km: number): string {
  const m = km * 1000;
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${km.toFixed(1)} km`;
}

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
  const [navSteps, setNavSteps] = useState<NavStep[]>([]);
  const [navIdx, setNavIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Safety gate: the patient accepting a bid only sets the booking to
  // `matched` — it does NOT mean money changed hands. `accept_bid` never
  // touches `payments`; the patient still has to clear a separate pay screen,
  // and can back out or kill the app before doing so. Until a real
  // `authorized`/`captured` payment row exists for this booking, the nurse
  // gets no map, no route, and no GPS broadcast — just a waiting state.
  const [paymentReady, setPaymentReady] = useState(false);

  // ── Load booking + resolve the patient's destination coords ────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bookingId) { setLoading(false); return; }
      try {
        const b = await db.bookings.get(bookingId);
        if (cancelled) return;
        setBooking(b);
        const pays = await db.payments.listForBookings([b.id]).catch(() => []);
        if (!cancelled) setPaymentReady(pays.some((p) => PAID_STATUSES.has(p.status)));
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
  }, [trackingStore, route]);

  const onNursePosition = useCallback(
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
    },
    [trackingStore],
  );
  const broadcasting = booking?.status === "en_route";
  const ownPosition = useForegroundPosition(!broadcasting);
  useEffect(() => {
    if (!broadcasting && ownPosition) {
      setNurse(ownPosition);
      trackingStore.push({
        lat: ownPosition.lat, lng: ownPosition.lng,
        heading: null, speed: null, accuracy: null,
        seq: Date.now(), receivedAt: Date.now(),
      });
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
  const routeOriginRef = useRef<LatLng | null>(null);
  useEffect(() => {
    if (!nurse || !dest) return;

    // Standing at the door: nothing to route. Clearing beats drawing a residual
    // squiggle between two points that are the same place.
    if (haversineKm(nurse, dest) <= 0.06) {
      routeOriginRef.current = null;
      setRoute(null);
      setNavSteps([]);
      return;
    }

    // The line must start where the nurse IS. Anchoring on the origin it was
    // computed from (rather than on distance to the nearest point of the line)
    // is what makes it redraw instead of hanging around stale.
    const anchor = routeOriginRef.current;
    if (anchor && haversineKm(nurse, anchor) < 0.06) return;
    if (reroutingRef.current || Date.now() - lastRerouteAtRef.current < 10000) return;
    reroutingRef.current = true;
    lastRerouteAtRef.current = Date.now();
    routeOriginRef.current = nurse;

    void (async () => {
      const { coords, steps } = await fetchRoute(nurse, dest, { steps: true });
      setRoute(coords);
      // Turn-by-turn steps → localised instructions
      const parsed: NavStep[] = steps.map((st) => {
        const p = parseManeuver(st.maneuver, st.name ?? "", t);
        return {
          instruction: p.instruction,
          dir: p.dir,
          loc: { lat: st.maneuver.location[1], lng: st.maneuver.location[0] },
        };
      });
      if (parsed.length) {
        setNavSteps(parsed);
        setNavIdx(parsed.length > 1 && parsed[0].dir !== "arrive" ? 1 : 0); // skip "depart"
      }
      reroutingRef.current = false;
    })();
  }, [nurse, dest, t]);

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
    setRoute(null);
    setNavSteps([]);
    trackingStore.setRoute(null);
  }, [booking?.status, trackingStore]);

  // ── Dev-only trip simulator ───────────────────────────────────────────────
  // Publishes a synthetic drive along the real route onto the real channel, so
  // the patient screen can be judged for FEEL without two people driving. Not a
  // replacement for an outdoor test — real multipath, tunnels and thermal
  // behaviour only appear outside — but it makes the UX reviewable indoors.
  const simRef = useRef<SimulationHandle | null>(null);
  const [simulating, setSimulating] = useState(false);
  useEffect(() => () => simRef.current?.stop(), []);
  const toggleSimulation = useCallback(async (wrongTurn = false) => {
    if (simRef.current) {
      simRef.current.stop();
      simRef.current = null;
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
    const target = dest ?? nurse;
    if (!target) {
      showToast("Position inconnue — impossible de simuler");
      return;
    }
    setSimulating(true);
    // A fixed bearing keeps runs comparable between attempts.
    const startM = 1600;
    const brg = 40 * (Math.PI / 180);
    const start = {
      lat: target.lat + (startM * Math.cos(brg)) / 111_320,
      lng: target.lng + (startM * Math.sin(brg)) / (111_320 * Math.cos((target.lat * Math.PI) / 180)),
    };

    const { coords, fromRouter } = await fetchRoute(start, target);
    // A straight line is not a road; map-matching would rightly distrust it and
    // the run would tell us nothing about the real experience.
    const path = fromRouter && coords.length >= 2 ? coords : syntheticLoop(target, 500);
    if (!fromRouter) showToast("Routage indisponible — boucle synthétique");

    simRef.current = simulateTrip({
      bookingId,
      path,
      speedMps: 11,
      intervalMs: 1500,
      jitterM: 6,
      // Scenario B: leave the planned road partway and drive a genuinely
      // different one to the same destination, so the whole deviation path is
      // observable — snapping disengaging, the eased correction back to real
      // GPS, the re-route, and the new road replacing the old.
      wrongTurnAtMs: wrongTurn ? 35_000 : undefined,
      destination: wrongTurn ? target : undefined,
      onWrongTurn: () => showToast("Mauvais virage — déviation en cours"),
      // A 10s dropout partway, so dead reckoning and the staleness banner are
      // exercised in the same run rather than needing a separate tunnel test.
      outage: wrongTurn ? undefined : [30_000, 40_000],
      onDone: () => {
        simRef.current = null;
        setSimulating(false);
        showToast("Simulation terminée");
      },
    });
  }, [bookingId, nurse, dest]);

  // Advance the turn instruction as the nurse reaches each maneuver point.
  useEffect(() => {
    if (!nurse || navSteps.length === 0) return;
    const cur = navSteps[Math.min(navIdx, navSteps.length - 1)];
    if (navIdx < navSteps.length - 1 && haversineKm(nurse, cur.loc) < 0.035) {
      setNavIdx((i) => Math.min(i + 1, navSteps.length - 1));
    }
  }, [nurse, navSteps, navIdx]);

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

  const patientName = patient?.full_name ?? "Patient";
  const distanceKm = nurse && dest ? haversineKm(nurse, dest) : null;
  const etaMin = distanceKm != null ? Math.max(1, Math.round((distanceKm / 30) * 60)) : null;
  const status = booking?.status;
  const farFromPatient = distanceKm != null && distanceKm > 0.2;

  const fit = nurse && dest ? [nurse, dest] : undefined;
  const curStep = navSteps.length ? navSteps[Math.min(navIdx, navSteps.length - 1)] : null;
  const stepDistKm = curStep && nurse ? haversineKm(nurse, curStep.loc) : null;

  // Sheet drag: pull the handle down to see the full map, back up to restore
  // the mission card. Measured on layout since its content height varies
  // (address line, action row, status button, etc.) — not a fixed constant.
  const [sheetHeight, setSheetHeight] = useState(0);
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
    });
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  if (!loading && !paymentReady && status !== "completed" && status !== "cancelled") {
    return (
      <View style={s.waitRoot}>
        <TouchableOpacity style={[s.iconBtn, s.waitBack]} onPress={() => router.back()} accessibilityLabel="Retour">
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
            <Text style={s.price}>{booking?.final_price_mad ?? booking?.budget_max_mad ?? "—"} MAD</Text>
          </View>
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
      {bookingId && paymentReady ? (
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
            route={route ?? undefined}
            fitCoords={fit}
            trackingStore={trackingStore}
            trackingVariant="self"
            radiusKm={0}
            nightAuto
          />
        )}

        {/* Turn-by-turn banner (our own map — no external app) */}
        <View style={s.navBar} pointerEvents="box-none">
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} accessibilityLabel="Retour">
            <ArrowLeft size={20} color="#1F2937" strokeWidth={2.4} />
          </TouchableOpacity>
          <View style={s.navCard}>
            <View style={s.navIcon}>
              <StepIcon dir={curStep?.dir ?? "straight"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.navInstruction} numberOfLines={2}>
                {curStep ? curStep.instruction : nurse ? t("calculating_route") : t("locating")}
              </Text>
              <Text style={s.navSub}>
                {stepDistKm != null ? `${fmtDist(stepDistKm)} · ` : ""}
                {distanceKm != null ? `${distanceKm.toFixed(1)} km au total · ~${etaMin} min` : ""}
              </Text>
            </View>
          </View>
        </View>
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
        <Text style={s.title}>{t("en_route_to_patient")}</Text>

        <View style={s.row}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{patientName.slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{patientName}</Text>
            <Text style={s.care} numberOfLines={1}>{(booking?.specialty ?? "").replaceAll("_", " ")}</Text>
          </View>
          <View style={s.priceCol}>
            <Text style={s.price}>{booking?.final_price_mad ?? booking?.budget_max_mad ?? "—"}</Text>
            <Text style={s.priceUnit}>MAD</Text>
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

function StepIcon({ dir }: { dir: NavStep["dir"] }) {
  const c = "#FFFFFF";
  if (dir === "left") return <CornerUpLeft size={24} color={c} strokeWidth={2.6} />;
  if (dir === "right") return <CornerUpRight size={24} color={c} strokeWidth={2.6} />;
  if (dir === "arrive") return <Flag size={22} color={c} strokeWidth={2.6} />;
  return <ArrowUp size={24} color={c} strokeWidth={2.6} />;
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
  navCard: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: NAVY, borderRadius: 18, padding: 12, minHeight: 64,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8,
  },
  navIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  navInstruction: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", lineHeight: 20 },
  navSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },

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
});
