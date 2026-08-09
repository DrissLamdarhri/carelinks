/**
 * CareLink — development-only navigation preview.
 *
 * The professional's banner is defined by how it BEHAVES over a journey: what
 * it says 400 m before a turn versus 40 m, when the "then" line appears, what
 * happens at a roundabout, what it degrades to when routing fails. None of that
 * is judgeable from a static screen, and reproducing it for real means a real
 * booking, a real payment, a real departure and a real drive across Fès.
 *
 * So this drives the REAL `GuidanceRoute` — the same class the tracking screen
 * uses, no mock, no duplicated logic — along a synthetic street layout, and
 * renders the REAL `ManeuverBanner` from it. Scrub or play; what you see is what
 * the nurse sees at that point of a trip.
 *
 * Renders nothing outside __DEV__.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { ManeuverBanner, TripStrip, type NavStatus } from "@/components/nav/ManeuverBanner";
import { GuidanceRoute, arrivalClock, type GuidanceStep } from "@/lib/tracking/guidance";
import { useI18n } from "@/lib/i18n";
import type { LatLng } from "@/lib/tracking/route";

const NAVY = "#0D0870";
const LAT0 = 34.037;
const LNG0 = -5.004;
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);

/** One leg of the synthetic street layout. */
type Leg = {
  /** Compass bearing travelled along this leg. */
  bearing: number;
  lengthM: number;
  /** The maneuver performed at the START of this leg. */
  type: string;
  modifier?: string;
  exit?: number;
  name: string;
  ref?: string;
  /** Average speed used to derive a plausible OSRM duration. */
  kmh: number;
};

/**
 * A route shaped to exercise every case at least once: a long cruise, an
 * isolated turn, a roundabout with an exit number, and a pair of junctions
 * close enough together to trigger the "then" line twice in a row.
 */
const LEGS: Leg[] = [
  { bearing: 90, lengthM: 800, type: "depart", modifier: "straight", name: "Avenue Hassan II", ref: "N6", kmh: 50 },
  { bearing: 0, lengthM: 300, type: "turn", modifier: "right", name: "Rue de Fès", kmh: 40 },
  { bearing: 60, lengthM: 130, type: "roundabout", exit: 3, name: "Boulevard Allal Ben Abdellah", kmh: 25 },
  { bearing: 340, lengthM: 70, type: "turn", modifier: "left", name: "Rue Ibn Khaldoun", kmh: 25 },
  { bearing: 45, lengthM: 420, type: "turn", modifier: "right", name: "Derb El Miter", kmh: 30 },
  { bearing: 45, lengthM: 0, type: "arrive", modifier: "right", name: "", kmh: 30 },
];

function buildFixture(): { coords: LatLng[]; steps: GuidanceStep[] } {
  const coords: LatLng[] = [];
  const steps: GuidanceStep[] = [];
  let cur: LatLng = { lat: LAT0, lng: LNG0 };
  coords.push(cur);

  for (const leg of LEGS) {
    steps.push({
      maneuver: {
        type: leg.type,
        modifier: leg.modifier,
        location: [cur.lng, cur.lat],
        exit: leg.exit,
      },
      name: leg.name,
      ref: leg.ref,
      duration: leg.kmh > 0 ? leg.lengthM / ((leg.kmh * 1000) / 3600) : 0,
    });

    // 10 m sampling, so the polyline is "dense" exactly like an OSRM route and
    // the map-matching behaves the same way it will in production.
    const rad = (leg.bearing * Math.PI) / 180;
    const steps10 = Math.round(leg.lengthM / 10);
    for (let i = 1; i <= steps10; i++) {
      coords.push({
        lat: cur.lat + ((i * 10 * Math.cos(rad)) / M_PER_DEG_LAT),
        lng: cur.lng + ((i * 10 * Math.sin(rad)) / M_PER_DEG_LNG),
      });
    }
    if (steps10 > 0) cur = coords[coords.length - 1];
  }
  return { coords, steps };
}

const STATUSES: { key: NavStatus; label: string }[] = [
  { key: "guiding", label: "Guidage" },
  { key: "calculating", label: "Calcul" },
  { key: "recalculating", label: "Recalcul" },
  { key: "unavailable", label: "Indispo." },
  { key: "locating", label: "GPS" },
];

export default function NavPreviewScreen() {
  const router = useRouter();
  const { t } = useI18n();

  const { coords, steps } = useMemo(() => buildFixture(), []);
  const guidanceRoute = useMemo(() => new GuidanceRoute(coords, steps), [coords, steps]);
  const total = guidanceRoute.totalM;

  const [offset, setOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [kmh, setKmh] = useState(40);
  const [status, setStatus] = useState<NavStatus>("guiding");
  const [trackW, setTrackW] = useState(0);

  // Advance at a real road speed so the countdown ticks the way it will on the
  // road — the quantisation is only judgeable at a plausible rate of change.
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing) return;
    const stepM = ((kmh * 1000) / 3600) * 0.25;
    raf.current = setInterval(() => {
      setOffset((o) => {
        const next = o + stepM;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
    }, 250);
    return () => {
      if (raf.current) clearInterval(raf.current);
    };
  }, [playing, kmh, total]);

  const guidance = guidanceRoute.at(offset);
  const arrivalAt =
    guidance?.remainingS != null && guidance.remainingS > 0 ? arrivalClock(guidance.remainingS) : null;

  const scrub = useCallback(
    (x: number) => {
      if (trackW <= 0) return;
      setPlaying(false);
      setOffset(Math.max(0, Math.min(total, (x / trackW) * total)));
    },
    [trackW, total],
  );

  if (!__DEV__) return null;

  const pct = total > 0 ? (offset / total) * 100 : 0;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.body}>
      <View style={s.head}>
        <TouchableOpacity style={s.back} onPress={() => router.back()} accessibilityLabel="Back">
          <ArrowLeft size={18} color="#1F2937" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={s.h1}>Navigation preview</Text>
      </View>
      <Text style={s.note}>
        Real GuidanceRoute + real ManeuverBanner, driven along a synthetic street layout. Dev only.
      </Text>

      {/* ── The banner under test, on a map-coloured ground ─────────────── */}
      <View style={s.stage}>
        <ManeuverBanner status={status} guidance={guidance} t={t} />
      </View>

      {/* ── Scrubber ────────────────────────────────────────────────────── */}
      <View
        style={s.track}
        onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => scrub(e.nativeEvent.locationX)}
        onResponderMove={(e) => scrub(e.nativeEvent.locationX)}
      >
        <View style={[s.trackFill, { width: `${pct}%` }]} />
        {guidanceRoute.maneuvers.map((m) => (
          <View key={m.index} style={[s.tick, { left: `${(m.offsetM / total) * 100}%` }]} />
        ))}
      </View>

      <View style={s.readout}>
        <Text style={s.readoutTxt}>
          {Math.round(offset)} / {Math.round(total)} m
        </Text>
        <Text style={s.readoutTxt}>
          phase: <Text style={s.readoutHot}>{guidance?.phase ?? "—"}</Text>
        </Text>
        <Text style={s.readoutTxt}>
          to turn: {guidance ? Math.round(guidance.distanceToManeuverM) : "—"} m
        </Text>
      </View>

      <View style={s.row}>
        <TouchableOpacity style={[s.btn, playing && s.btnOn]} onPress={() => setPlaying((p) => !p)}>
          <Text style={[s.btnTxt, playing && s.btnTxtOn]}>{playing ? "Pause" : "Play"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => { setPlaying(false); setOffset(0); }}>
          <Text style={s.btnTxt}>Reset</Text>
        </TouchableOpacity>
        {[25, 40, 60].map((v) => (
          <TouchableOpacity key={v} style={[s.btn, kmh === v && s.btnOn]} onPress={() => setKmh(v)}>
            <Text style={[s.btnTxt, kmh === v && s.btnTxtOn]}>{v} km/h</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Jump straight to each approach state — the four cases that matter. */}
      <Text style={s.h2}>Jump to a maneuver</Text>
      <View style={s.row}>
        {guidanceRoute.maneuvers.map((m, i) => (
          <View key={m.index} style={s.jumpGroup}>
            <Text style={s.jumpLabel}>#{i + 1}</Text>
            {[
              { d: 500, l: "cruise" },
              { d: 250, l: "prep" },
              { d: 60, l: "imm" },
              { d: 10, l: "now" },
            ].map((j) => (
              <TouchableOpacity
                key={j.l}
                style={s.chip}
                onPress={() => { setPlaying(false); setOffset(Math.max(0, m.offsetM - j.d)); }}
              >
                <Text style={s.chipTxt}>{j.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <Text style={s.h2}>Banner status</Text>
      <View style={s.row}>
        {STATUSES.map((st) => (
          <TouchableOpacity
            key={st.key}
            style={[s.btn, status === st.key && s.btnOn]}
            onPress={() => setStatus(st.key)}
          >
            <Text style={[s.btnTxt, status === st.key && s.btnTxtOn]}>{st.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.h2}>Trip strip (as rendered in the sheet)</Text>
      <View style={s.sheetSim}>
        <TripStrip
          remainingM={guidance?.remainingM ?? null}
          remainingS={guidance?.remainingS ?? null}
          arrivalAt={arrivalAt}
          t={t}
        />
      </View>

      <Text style={s.h2}>Maneuver list</Text>
      {guidanceRoute.maneuvers.map((m, i) => (
        <Text key={m.index} style={s.listRow}>
          {i + 1}. {Math.round(m.offsetM)} m · {m.dir} · {m.instructionKey}
          {m.road ? ` · ${m.road}` : ""}
        </Text>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F6F5F0" },
  body: { padding: 16, paddingTop: 54, paddingBottom: 60 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
  },
  h1: { fontSize: 19, fontWeight: "800", color: "#111827" },
  h2: { fontSize: 12, fontWeight: "800", color: "#6B7280", marginTop: 18, marginBottom: 8, letterSpacing: 0.6 },
  note: { fontSize: 11.5, color: "#9CA3AF", marginBottom: 14, lineHeight: 16 },

  // Cream ground so the navy card is judged against the real map colour.
  stage: { backgroundColor: "#E9E4D4", borderRadius: 22, padding: 12, flexDirection: "row" },

  track: {
    height: 30, borderRadius: 8, backgroundColor: "#E5E4DC", marginTop: 16,
    justifyContent: "center", overflow: "hidden",
  },
  trackFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#C7D9E8" },
  tick: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: NAVY, opacity: 0.55 },

  readout: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  readoutTxt: { fontSize: 11.5, color: "#6B7280", fontWeight: "600" },
  readoutHot: { color: NAVY, fontWeight: "800" },

  row: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  btn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7E6E0",
  },
  btnOn: { backgroundColor: NAVY, borderColor: NAVY },
  btnTxt: { fontSize: 12, fontWeight: "700", color: "#374151" },
  btnTxtOn: { color: "#FFFFFF" },

  jumpGroup: { flexDirection: "row", alignItems: "center", gap: 4, marginRight: 6 },
  jumpLabel: { fontSize: 11, fontWeight: "800", color: "#9CA3AF", marginRight: 2 },
  chip: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7E6E0",
  },
  chipTxt: { fontSize: 10.5, fontWeight: "700", color: "#374151" },

  sheetSim: {
    backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#E7E6E0",
  },
  listRow: { fontSize: 11.5, color: "#4B5563", lineHeight: 19 },
});
