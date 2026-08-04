# Tracking renderer benchmark

A permanent tool for measuring the live-tracking render path. It exists so that
renderer choices, and every later change to the tracking stack, are decided by
measurement rather than by preference — and so that performance regressions are
caught, since they are invisible in code review and unreliable to judge by eye.

**Location:** `mobile-app/lib/tracking/bench/` · **Screen:** `/dev/bench`
**Headless tests:** `pnpm -C mobile-app test:tracking`

---

## 1. How it works

| Piece | Responsibility |
|---|---|
| `traces.ts` | Reproducible sessions. Synthetic traces come from a **seeded** PRNG, so the same trace is byte-identical on every run and every device. |
| `scenarios.ts` | A trace plus a **scripted** camera choreography. |
| `runner.ts` | Drives one candidate through one scenario, guaranteeing identical conditions. |
| `metrics.ts` | Frame timing, JS-stall probe, heap sampling. Pure, unit-tested. |
| `report.ts` | Comparison table and regression check against a stored baseline. |
| `candidates.tsx` | The renderers under test, plus the mandatory **control**. |

Three properties make the comparison trustworthy:

1. **Identical input.** Same fixes, same arrival offsets, same duration. Fixes are
   delivered against *elapsed time*, not a chain of timers, so a stuttering
   device still receives the whole trace instead of silently replaying less of it.
2. **Identical interaction.** Camera movements are scripted. No human can swipe
   the same way twice, so hand-driven gesture testing cannot compare renderers.
3. **Warm-up excluded.** The first 1.5 s (JIT, shader compilation, first texture
   upload) is discarded — those costs belong to the platform, not the candidate.

Only **one candidate is mounted at a time**. Two live maps would contend for the
GPU and neither number would mean anything.

---

## 2. Running it

```bash
pnpm -C mobile-app android      # a dev build; the route is inert in release
```

Navigate to **`/dev/bench`**.

1. Select candidates and scenarios (chips). Default is everything.
2. **Plug the phone in, set brightness to a fixed level, close other apps.**
   Thermal throttling and background work will otherwise dominate your results.
3. Tap **Run benchmark**. Keep the app foregrounded — backgrounding suspends
   `requestAnimationFrame` and voids the run.
4. Each run is ~61 s. Seven scenarios × two candidates ≈ 15 minutes.
5. **Save baseline** on the first good run. **Export JSON** to archive it
   alongside the commit it describes.

Run the full set **twice** and keep the second. The first pass warms caches and
brings the device to a steady thermal state.

### Battery — measured out of band

The app cannot measure its own power draw honestly. Use `adb`:

```bash
# 1. Reset counters, unplug the phone (battery stats only accrue on battery)
adb shell dumpsys batterystats --reset
adb shell dumpsys battery unplug

# 2. Run ONE candidate across all scenarios (~7 min), screen on, foregrounded

# 3. Read it back
adb shell dumpsys batterystats --charged ma.carelink.app > battery-<candidate>.txt
adb shell dumpsys battery reset      # IMPORTANT: restores normal charging

grep -A 20 "Estimated power use" battery-<candidate>.txt
```

Compare the `mAh` figure between candidates over the **same wall-clock
duration**. Absolute values are not meaningful; the ratio is.

### CPU

```bash
adb shell top -m 10 -d 1 | grep carelink        # coarse, live
adb shell dumpsys cpuinfo | grep carelink       # snapshot
```

For anything more precise use **Android Studio → Profiler**, or capture a
Perfetto trace and read the actual presented-frame record:

```bash
adb shell perfetto -o /data/misc/perfetto-traces/trace -t 30s sched freq idle am wm gfx view
adb pull /data/misc/perfetto-traces/trace ./perfetto-trace
```

Perfetto is the authority on dropped frames. See the caveat in §4.

---

## 3. Reading the report

```
                          Control   Candidate A   Candidate B
avg FPS                      59.8          58.1          52.4
p50 frame ms                 16.6          16.8          17.9
p95 frame ms                 17.1          19.4          31.2
p99 frame ms                 18.0          24.6          48.9
worst frame ms               22.3          41.0          96.4
>16.7ms frames                 12            88           402
>33.4ms frames                  0             9            77
dropped (est)                   0            11           131
JS stall worst ms               8            34           142
heap peak                     n/a           n/a           n/a
marker updates                561           559           178
store emitted                 561           561           561
store suppressed               58            58            58
```

**Read the percentiles, not the average.** Average FPS hides everything that
matters: a renderer averaging 58 fps with a p99 of 49 ms feels *worse* than one
averaging 55 fps with a p99 of 20 ms, because users perceive the stutters, not
the mean. p95 and p99 are the experience.

**Read everything relative to the control.** The control has no map, so it is
this device's ceiling for the store and subscription path. A candidate close to
the control is paying almost nothing for rendering. If the *control itself* is
far below 60 fps, the device or the dev build is the limit and candidate
differences within that noise are not meaningful.

**`marker updates` far below `store emitted`** means the renderer is coalescing
or dropping updates — smoother numbers bought by moving the marker less often.
That may be a legitimate trade or it may be a visibly laggier marker; check it
by eye before rewarding it.

**`JS stalls > 100 ms`** is the strongest signal that a renderer is blocking the
thread. Any non-zero value under normal tracking is disqualifying.

**Interaction-stress is the decisive scenario.** Users fidget with the map
exactly when they are anxious about where their nurse is.

### Regressions

With a baseline saved, each run appends a comparison. Defaults: >5 % average FPS
drop, >15 % p95 increase, >20 % p99 increase, >25 % more dropped frames. Only
compare runs from the **same device and the same build type**.

---

## 4. What these numbers are not

Frame timings come from `requestAnimationFrame` on the JS thread. They measure
when JS was handed a frame. That is the right signal for comparing two
JS-driven renderers, and it is **not** the compositor's record of what was
presented to the user.

A renderer that pushes work to the native/UI thread — which is exactly what a
MapLibre `SymbolLayer` candidate does — can post excellent JS frame times while
the user still sees jank, because the cost moved somewhere this harness cannot
see. **Confirm the winner with Perfetto before committing to it.** If the JS
numbers and the presented-frame record disagree, Perfetto is right.

Other limits, stated plainly:

- **Heap** is `performance.memory`, which Hermes generally does not expose. The
  report prints `n/a`; it never prints a fabricated zero. Use Android Studio's
  memory profiler for real figures.
- **Dropped frames** in the table is an *estimate* derived from how many 60 Hz
  budgets each interval overran.
- **Dev builds** are substantially slower than release. The report warns when it
  detects one. Relative comparison stays valid; absolute FPS does not.
- **Emulators** are flagged and must not be used to choose a renderer.

---

## 5. Extending it

**A new renderer:** add an entry to `CANDIDATES` in `bench/candidates.tsx`
implementing `BenchRendererProps` and exposing a `BenchRendererHandle` ref.
Nothing else changes.

**A real-world trace:** capture fixes from a live session, then

```ts
import { toTrace } from "@/lib/tracking/bench/traces";
const trace = toTrace({ id: "fes-evening", label: "Fès, evening traffic" }, captured);
```

Offsets are rebased to zero automatically. Recorded traces replay exactly like
synthetic ones, so real sessions can be added to the standard suite over time —
that is the point of the format.

**A new scenario:** add to `SCENARIOS` with a `rationale` explaining what it is
designed to expose. A scenario without a stated purpose is noise.
