/**
 * CareLink — tracking renderer benchmark (DEVELOPMENT ONLY).
 *
 * Route: /dev/bench
 *
 * Refuses to render outside a development build. Expo Router turns every file
 * under app/ into a route, so the guard is what keeps this out of a shipped
 * app rather than the file's location.
 *
 * See docs/tracking-benchmark.md for how to run, collect and interpret.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrackingStore } from "@/lib/tracking/store";
import { CANDIDATES, type CandidateEntry } from "@/lib/tracking/bench/candidates";
import { SCENARIOS } from "@/lib/tracking/bench/scenarios";
import { runScenario } from "@/lib/tracking/bench/runner";
import {
  compareToBaseline,
  formatRegressions,
  formatSuite,
} from "@/lib/tracking/bench/report";
import type { BenchRendererHandle, BenchResult, BenchSuite } from "@/lib/tracking/bench/types";

const NAVY = "#0D0870";
const BASELINE_KEY = "carelink.bench.baseline";
const CENTER = { lat: 34.037, lng: -5.004 };

export default function BenchScreen() {
  // Hard gate. The route exists in the bundle either way; this is what makes
  // it inert in a production build.
  if (!__DEV__) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.unavailable}>Benchmark is available in development builds only.</Text>
      </SafeAreaView>
    );
  }
  return <Bench />;
}

function Bench() {
  const [selected, setSelected] = useState<string[]>(CANDIDATES.map((c) => c.id));
  const [scenarioIds, setScenarioIds] = useState<string[]>(SCENARIOS.map((x) => x.id));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>("");
  const [report, setReport] = useState<string>("");
  const [suite, setSuite] = useState<BenchSuite | null>(null);

  // The candidate currently mounted. Only ONE is mounted at a time: two live
  // maps would contend for the GPU and neither number would mean anything.
  const [active, setActive] = useState<{ candidate: CandidateEntry; store: TrackingStore } | null>(
    null,
  );
  const handleRef = useRef<BenchRendererHandle | null>(null);

  const chosen = useMemo(() => CANDIDATES.filter((c) => selected.includes(c.id)), [selected]);
  const chosenScenarios = useMemo(
    () => SCENARIOS.filter((x) => scenarioIds.includes(x.id)),
    [scenarioIds],
  );

  const totalRuns = chosen.length * chosenScenarios.length;
  const estMinutes = Math.ceil((totalRuns * 61.5) / 60);

  const run = useCallback(async () => {
    if (running || totalRuns === 0) return;
    setRunning(true);
    setReport("");
    const results: BenchResult[] = [];
    let done = 0;

    try {
      for (const candidate of chosen) {
        for (const scenario of chosenScenarios) {
          const store = new TrackingStore();
          setActive({ candidate, store });
          // Let the renderer mount and subscribe before the runner starts.
          await new Promise((r) => setTimeout(r, 400));

          const handle = handleRef.current;
          if (!handle) {
            console.warn(`[bench] ${candidate.id} did not expose a handle; skipped`);
            continue;
          }

          setPhase(`${candidate.label} — ${scenario.label}`);
          const result = await runScenario(candidate, scenario, store, handle, {
            onProgress: (f) => setProgress((done + f) / totalRuns),
            onPhase: (p) => setPhase(`${candidate.label} — ${scenario.label} (${p})`),
          });
          results.push(result);
          done++;
          setProgress(done / totalRuns);

          store.destroy();
          setActive(null);
          // Breathe: let the GPU and any pending GC settle so the next run does
          // not inherit this one's thermal or allocation state.
          await new Promise((r) => setTimeout(r, 1200));
        }
      }

      const next: BenchSuite = { ranAt: new Date().toISOString(), results };
      setSuite(next);
      let text = formatSuite(next);

      const raw = await AsyncStorage.getItem(BASELINE_KEY).catch(() => null);
      if (raw) {
        try {
          const baseline = JSON.parse(raw) as BenchSuite;
          text += `\n\nBASELINE (${baseline.ranAt}):\n${formatRegressions(compareToBaseline(next, baseline))}`;
        } catch {
          /* corrupt baseline — ignore rather than lose the run */
        }
      } else {
        text += "\n\nNo baseline stored. Save this run as the baseline to enable regression checks.";
      }
      setReport(text);
    } finally {
      setActive(null);
      setRunning(false);
      setPhase("");
    }
  }, [chosen, chosenScenarios, running, totalRuns]);

  const saveBaseline = useCallback(async () => {
    if (!suite) return;
    await AsyncStorage.setItem(BASELINE_KEY, JSON.stringify(suite));
    setReport((r) => `${r}\n\nSaved as baseline.`);
  }, [suite]);

  const exportJson = useCallback(async () => {
    if (!suite) return;
    // Share rather than write to disk: the JSON needs to leave the device to be
    // archived alongside the commit it describes.
    await Share.share({ message: JSON.stringify(suite, null, 2) }).catch(() => {});
  }, [suite]);

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <Text style={s.title}>Tracking renderer benchmark</Text>
      <Text style={s.sub}>
        {totalRuns} run{totalRuns === 1 ? "" : "s"} · ~{estMinutes} min · keep the screen on and the
        app foregrounded
      </Text>

      <View style={s.stage}>
        {active ? (
          <active.candidate.Component ref={handleRef} store={active.store} center={CENTER} />
        ) : (
          <View style={s.idle}>
            <Text style={s.idleText}>{running ? "switching…" : "idle"}</Text>
          </View>
        )}
      </View>

      {running ? (
        <View style={s.progressRow}>
          <ActivityIndicator color={NAVY} />
          <Text style={s.progressText}>
            {Math.round(progress * 100)}% · {phase}
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips}>
          {CANDIDATES.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              on={selected.includes(c.id)}
              onPress={() =>
                setSelected((prev) =>
                  prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                )
              }
            />
          ))}
          {SCENARIOS.map((x) => (
            <Chip
              key={x.id}
              label={x.id}
              on={scenarioIds.includes(x.id)}
              onPress={() =>
                setScenarioIds((prev) =>
                  prev.includes(x.id) ? prev.filter((y) => y !== x.id) : [...prev, x.id],
                )
              }
            />
          ))}
        </ScrollView>
      )}

      <View style={s.actions}>
        <TouchableOpacity style={[s.btn, running && s.btnOff]} onPress={run} disabled={running}>
          <Text style={s.btnText}>{running ? "Running…" : "Run benchmark"}</Text>
        </TouchableOpacity>
        {suite && !running ? (
          <>
            <TouchableOpacity style={[s.btn, s.btnAlt]} onPress={saveBaseline}>
              <Text style={s.btnAltText}>Save baseline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnAlt]} onPress={exportJson}>
              <Text style={s.btnAltText}>Export JSON</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      <ScrollView style={s.reportBox} horizontal>
        <ScrollView>
          <Text style={s.report} selectable>
            {report || "Results will appear here."}
          </Text>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, on && s.chipOn]} onPress={onPress}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 12 },
  unavailable: { margin: 24, fontSize: 15, color: "#6B7280" },
  title: { fontSize: 18, fontWeight: "700", color: NAVY, marginTop: 8 },
  sub: { fontSize: 12, color: "#6B7280", marginBottom: 8 },
  stage: { height: 220, borderRadius: 12, overflow: "hidden", backgroundColor: "#F3F4F6" },
  idle: { flex: 1, alignItems: "center", justifyContent: "center" },
  idleText: { color: "#9CA3AF", fontSize: 12 },
  chips: { marginVertical: 8, maxHeight: 40 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "#F3F4F6", marginRight: 6,
  },
  chipOn: { backgroundColor: NAVY },
  chipText: { fontSize: 11, color: "#374151" },
  chipTextOn: { color: "#FFFFFF", fontWeight: "600" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  progressText: { fontSize: 12, color: "#374151", flex: 1 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 8 },
  btn: { flex: 1, backgroundColor: NAVY, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  btnOff: { backgroundColor: "#9CA3AF" },
  btnAlt: { backgroundColor: "#EEF2FF" },
  btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  btnAltText: { color: NAVY, fontWeight: "700", fontSize: 13 },
  reportBox: { flex: 1, backgroundColor: "#0B1020", borderRadius: 10, padding: 10 },
  report: {
    color: "#D1D5DB",
    fontSize: 10,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
});
