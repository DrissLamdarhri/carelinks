/**
 * Nurse (pro) navigation screen — "go to the patient".
 * Shows the same labeled MapLibre map with the patient's destination pin, the
 * nurse's LIVE GPS position, and the road route between them. Plus the patient's
 * address, live distance/ETA, and a Google-Maps "Naviguer" hand-off + call.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
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
import { showToast } from "@/lib/toast";
import { haptics } from "@/lib/haptics";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import type { Booking, BookingStatus, Profile } from "@/lib/db/types";

const NAVY = "#0D0870";
const MAP_CENTER: LatLng = { lat: 34.037, lng: -5.004 };

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

  // ── Load booking + resolve the patient's destination coords ────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bookingId) { setLoading(false); return; }
      try {
        const b = await db.bookings.get(bookingId);
        if (cancelled) return;
        setBooking(b);
        // Opening this screen IS setting out — the GPS broadcast starts right
        // below. Advance `matched → en_route` so the patient immediately sees
        // movement and the booking never stalls in `matched` waiting on a tap
        // nobody remembers to make (that stall is what froze 85 bookings).
        if (b.status === "matched") {
          db.bookings
            .markEnRoute(b.id)
            .then((up) => { if (!cancelled) setBooking(up); })
            .catch(() => { /* non-blocking — the manual button still works */ });
        }
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
        if (!cancelled) setDest(d ?? MAP_CENTER);
      } catch {
        if (!cancelled) showToast(t("reservation_not_found"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  // The nurse's live GPS is watched + broadcast to the patient by
  // <LiveTrackingChannel mode="broadcast"> below; onPosition updates our map.
  const onNursePosition = useCallback((p: { lat: number; lng: number }) => {
    setNurse({ lat: p.lat, lng: p.lng });
  }, []);

  // Arriving starts the visit on its own: `en_route → in_progress` as soon as the
  // nurse's GPS is within ~80 m of the patient. The pro has their hands full on
  // arrival, so waiting for a button here is what leaves escrow in limbo.
  const arrivalMarked = useRef(false);
  useEffect(() => {
    if (arrivalMarked.current || !nurse || !dest || !booking) return;
    if (booking.status !== "en_route") return;
    if (haversineKm(nurse, dest) > 0.08) return;
    arrivalMarked.current = true;
    db.bookings
      .setStatus(booking.id, "in_progress")
      .then(setBooking)
      .catch(() => { arrivalMarked.current = false; });
  }, [nurse, dest, booking]);

  // ── Fetch the road route once both endpoints are known ─────────────────────
  const routeFetched = useRef(false);
  useEffect(() => {
    if (routeFetched.current || !nurse || !dest) return;
    routeFetched.current = true;
    void (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${nurse.lng},${nurse.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=true`;
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timeoutId);
        const body = await res.json();
        const r = body.routes?.[0];
        const coords: LatLng[] | undefined = r?.geometry?.coordinates?.map(
          (c: number[]) => ({ lat: c[1], lng: c[0] }),
        );
        setRoute(coords && coords.length >= 2 ? coords : [nurse, dest]);
        // Turn-by-turn steps → French instructions
        const rawSteps: any[] = r?.legs?.[0]?.steps ?? [];
        const parsed: NavStep[] = rawSteps
          .filter((st) => Array.isArray(st?.maneuver?.location))
          .map((st) => {
            const p = parseManeuver(st.maneuver, st.name ?? "", t);
            return { instruction: p.instruction, dir: p.dir, loc: { lat: st.maneuver.location[1], lng: st.maneuver.location[0] } };
          });
        if (parsed.length) {
          setNavSteps(parsed);
          setNavIdx(parsed.length > 1 && parsed[0].dir !== "arrive" ? 1 : 0); // skip "depart"
        }
      } catch {
        setRoute([nurse, dest]);
      }
    })();
  }, [nurse, dest]);

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
      setBusy(true);
      try {
        const b = await db.bookings.setStatus(bookingId, status);
        setBooking(b);
        haptics.success();
        showToast(doneMsg);
        if (status === "completed") router.back();
      } catch {
        showToast(t("action_failed"));
      } finally {
        setBusy(false);
      }
    },
    [bookingId, busy, router],
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

  const fit = nurse && dest ? [nurse, dest] : undefined;
  const curStep = navSteps.length ? navSteps[Math.min(navIdx, navSteps.length - 1)] : null;
  const stepDistKm = curStep && nurse ? haversineKm(nurse, curStep.loc) : null;

  return (
    <View style={s.root}>
      {/* Broadcast the nurse's real GPS to the patient's live tracking. */}
      {bookingId ? (
        <LiveTrackingChannel bookingId={bookingId} mode="broadcast" onPosition={onNursePosition} />
      ) : null}

      <View style={s.mapWrap}>
        {loading ? (
          <View style={s.center}><ActivityIndicator color={NAVY} /></View>
        ) : (
          <CareLinkMapView
            center={nurse ?? dest ?? MAP_CENTER}
            patient={nurse ?? undefined}
            destination={dest ?? undefined}
            route={route ?? undefined}
            fitCoords={fit}
            follow={!!nurse}
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

      {/* Bottom card */}
      <View style={s.sheet}>
        <View style={s.handle} />
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
          <TouchableOpacity style={s.statusBtn} disabled={busy} onPress={() => advance("in_progress", t("mission_started"))}>
            <Text style={s.statusTxt}>{t("i_arrived")}</Text>
          </TouchableOpacity>
        ) : status === "in_progress" ? (
          <TouchableOpacity style={[s.statusBtn, s.statusDone]} disabled={busy} onPress={() => advance("completed", t("mission_completed"))}>
            <CheckCircle2 size={18} color="#FFFFFF" />
            <Text style={s.statusTxt}>{t("end_mission")}</Text>
          </TouchableOpacity>
        ) : null}

        {/* RULE #4 — nurse-initiated cancellation (penalty applies) */}
        {status !== "completed" && status !== "cancelled" ? (
          <TouchableOpacity style={s.cancelJobBtn} disabled={busy} onPress={cancelByNurse}>
            <Text style={s.cancelJobTxt}>{t("cancel_job")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
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
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 30,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 12,
  },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", marginTop: 10, marginBottom: 14 },
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
  statusTxt: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  cancelJobBtn: { height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  cancelJobTxt: { color: "#E24B4A", fontSize: 14, fontWeight: "700" },
});
