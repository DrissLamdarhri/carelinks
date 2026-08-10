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
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrackingStore } from "@/lib/tracking/store";
import { CANDIDATES, type CandidateEntry } from "@/lib/tracking/bench/candidates";
import { SCENARIOS } from "@/lib/tracking/bench/scenarios";
import { runScenario } from "@/lib/tracking/bench/runner";
import {
  compareToBaseline,
  formatCompact,
  formatRegressions,
  formatSuite,
} from "@/lib/tracking/bench/report";
import type { BenchRendererHandle, BenchResult, BenchSuite } from "@/lib/tracking/bench/types";

const NAVY = "#0D0870";
const BASELINE_KEY = "carelink.bench.baseline";
const CENTER = { lat: 34.037, lng: -5.004 };

/**
 * Dev builds always allow it. A RELEASE build allows it only when explicitly
 * built with EXPO_PUBLIC_ENABLE_BENCH=1.
 *
 * The escape hatch exists because dev builds are substantially slower than
 * release, so if the control cannot hold a valid frame rate under __DEV__ the
 * only way to get trustworthy numbers is to measure a release build — and the
 * original `__DEV__`-only gate made that impossible. A shipped app is built
 * without the flag, so the route stays inert where it matters.
 */
const BENCH_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_BENCH === "1";

export default function BenchScreen() {
  if (!BENCH_ENABLED) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.unavailable}>
          Benchmark is unavailable in this build. Rebuild with EXPO_PUBLIC_ENABLE_BENCH=1.
        </Text>
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

  // Clipboard, not Share. A 21-run suite is ~30KB of pretty-printed JSON and
  // Android's share intent silently truncated it — a complete run was lost that
  // way, and the truncation is invisible until someone notices half the
  // candidates are missing. Clipboard has no such limit.
  const copy = useCallback(
    async (label: string, text: string) => {
      await Clipboard.setStringAsync(text);
      setReport((r) => `${r}\n\nCopied ${label} (${(text.length / 1024).toFixed(1)} KB) to clipboard.`);
    },
    [],
  );

  const copyCompact = useCallback(() => {
    if (suite) void copy("compact summary", formatCompact(suite));
  }, [suite, copy]);

  const copyReport = useCallback(() => {
    if (suite) void copy("report", formatSuite(suite));
  }, [suite, copy]);

  const copyJson = useCallback(() => {
    // Un-prettified: same data, roughly half the bytes.
    if (suite) void copy("full JSON", JSON.stringify(suite));
  }, [suite, copy]);

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <Text style={s.title}>Tracking renderer benchmark</Text>
      <Text style={s.sub}>
        {totalRuns} run{totalRuns === 1 ? "" : "s"} · ~{estMinutes} min · keep the screen on and the
        app foregrounded
      </Text>

      <View style={s.stage}>
        {active ? (
          <Stage entry={active.candidate} store={active.store} handleRef={handleRef} />
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
            <TouchableOpacity style={[s.btn, s.btnAlt]} onPress={copyCompact}>
              <Text style={s.btnAltText}>Copy summary</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnAlt]} onPress={copyReport}>
              <Text style={s.btnAltText}>Copy report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnAlt]} onPress={copyJson}>
              <Text style={s.btnAltText}>Copy JSON</Text>
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

/**
 * The mounted candidate, isolated from the benchmark screen's own state.
 *
 * Without this memo, every progress tick re-rendered Bench and cascaded into
 * the candidate — the harness measuring its own progress bar. Throttling
 * progress fixed the frequency; this fixes the coupling, so ANY future state
 * added to this screen (a timer, a log line, a cancel button) cannot silently
 * corrupt a run. Its props are all stable for the lifetime of one run, so it
 * re-renders only when the candidate itself pulls from the store.
 */
const Stage = memo(function Stage({
  entry,
  store,
  handleRef,
}: {
  entry: CandidateEntry;
  store: TrackingStore;
  handleRef: React.RefObject<BenchRendererHandle | null>;
}) {
  return <entry.Component ref={handleRef} store={store} center={CENTER} />;
});

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
