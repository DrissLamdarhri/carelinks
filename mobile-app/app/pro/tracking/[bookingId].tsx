/**
 * Nurse (pro) navigation screen — "go to the patient".
 * Shows the same labeled MapLibre map with the patient's destination pin, the
 * nurse's LIVE GPS position, and the road route between them. Plus the patient's
 * address, live distance/ETA, and a Google-Maps "Naviguer" hand-off + call.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, MapPin, Navigation, Phone } from "lucide-react-native";
import { CareLinkMapView, type LatLng } from "@/components/map/CareLinkMapView";
import { LiveTrackingChannel } from "@/components/LiveTrackingChannel";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import { openNavigation } from "@/lib/nav";
import { showToast } from "@/lib/toast";
import { haptics } from "@/lib/haptics";
import { Colors } from "@/lib/colors";
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

export default function ProTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [patient, setPatient] = useState<Profile | null>(null);
  const [dest, setDest] = useState<LatLng | null>(null);
  const [nurse, setNurse] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);
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
        if (!cancelled) showToast("Réservation introuvable");
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

  // ── Fetch the road route once both endpoints are known ─────────────────────
  const routeFetched = useRef(false);
  useEffect(() => {
    if (routeFetched.current || !nurse || !dest) return;
    routeFetched.current = true;
    void (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${nurse.lng},${nurse.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        const body = await res.json();
        const coords: LatLng[] | undefined = body.routes?.[0]?.geometry?.coordinates?.map(
          (c: number[]) => ({ lat: c[1], lng: c[0] }),
        );
        setRoute(coords && coords.length >= 2 ? coords : [nurse, dest]);
      } catch {
        setRoute([nurse, dest]);
      }
    })();
  }, [nurse, dest]);

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
        showToast("Action impossible");
      } finally {
        setBusy(false);
      }
    },
    [bookingId, busy, router],
  );

  const patientName = patient?.full_name ?? "Patient";
  const distanceKm = nurse && dest ? haversineKm(nurse, dest) : null;
  const etaMin = distanceKm != null ? Math.max(1, Math.round((distanceKm / 30) * 60)) : null;
  const status = booking?.status;

  const fit = nurse && dest ? [nurse, dest] : undefined;

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
            radiusKm={0}
            nightAuto
          />
        )}

        {/* Top bar */}
        <View style={s.topBar} pointerEvents="box-none">
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} accessibilityLabel="Retour">
            <ArrowLeft size={20} color="#1F2937" strokeWidth={2.4} />
          </TouchableOpacity>
          <View style={s.pill}>
            <View style={s.pillDot} />
            <Text style={s.pillTxt}>
              {distanceKm != null ? `${distanceKm.toFixed(1)} km · ~${etaMin} min` : "Localisation…"}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {/* Bottom card */}
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>En route vers le patient</Text>

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
            style={[s.actBtn, s.actPrimary]}
            onPress={() => {
              if (!openNavigation({ lat: dest?.lat, lng: dest?.lng, address: booking?.address })) {
                showToast("Destination indisponible");
              }
            }}
          >
            <Navigation size={17} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={s.actPrimaryTxt}>Naviguer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actBtn, s.actGhost]}
            onPress={() => {
              if (patient?.phone) void Linking.openURL(`tel:${patient.phone}`);
              else showToast("Numéro indisponible");
            }}
          >
            <Phone size={17} color={NAVY} strokeWidth={2.2} />
            <Text style={s.actGhostTxt}>Appeler</Text>
          </TouchableOpacity>
        </View>

        {status === "matched" ? (
          <TouchableOpacity style={s.statusBtn} disabled={busy} onPress={() => advance("in_progress", "Mission démarrée")}>
            <Text style={s.statusTxt}>Démarrer la mission</Text>
          </TouchableOpacity>
        ) : status === "in_progress" ? (
          <TouchableOpacity style={[s.statusBtn, s.statusDone]} disabled={busy} onPress={() => advance("completed", "Mission terminée")}>
            <CheckCircle2 size={18} color="#FFFFFF" />
            <Text style={s.statusTxt}>Terminer la mission</Text>
          </TouchableOpacity>
        ) : null}
      </View>
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
});
