# ADR 0001 — Live-tracking marker renderer

**Status:** Accepted · **Date:** 2026-08-04 · **Phase:** 2, step 4

## Decision

The live-tracking marker is rendered with **MapLibre `ViewAnnotation`** — a React
Native view anchored to a coordinate — not with a `SymbolLayer` over a GeoJSON
source.

## Context

The tracking render path was rebuilt in Phase 2. Two candidates were implemented
against a shared benchmark contract (`lib/tracking/bench/`), using the same
store, the same `useSyncExternalStore` subscription, the same map shell and the
same 32 px icon, so that the marker renderer was the only variable.

The prior expectation, recorded before measuring, was that `SymbolLayer` would
win on frame times because it draws inside the map's own render pass and rotates
on the GPU. **That expectation was wrong.**

## Evidence

Samsung SM-A065F, Android 36, dev build. 3 candidates × 7 scenarios × 60 s,
single device, single session. A no-map **control** was run to establish the
device ceiling.

| | avg FPS | p95 ms | p99 ms | >33 ms | dropped | stalls >100 ms |
|---|---|---|---|---|---|---|
| Control (no map) | 47.37 | 38.14 | 48.57 | 560 | 6424 | 11 |
| ViewAnnotation | 46.80 | **37.43** | 49.29 | 529 | 6464 | 10 |
| SymbolLayer | 47.24 | 37.71 | **48.43** | **526** | **6389** | 9 |

Both candidates are statistically indistinguishable from the control:

1. **Both map renderers logged fewer long frames than the no-map control**
   (529 / 526 vs 560). Drawing a full map plus a moving marker cannot really be
   cheaper than drawing three lines of text — this is noise by definition.
2. The largest per-scenario gap between candidates is **1.0 FPS**, while the
   control alone varies **3.1 FPS** across scenarios. The signal is smaller than
   the instrument's variance.
3. The candidates **trade places** depending on the metric (ViewAnnotation wins
   p95, SymbolLayer wins p99) — the signature of no real difference.

SymbolLayer's theoretical advantage is worth **+0.44 FPS (<1%)** here.

Note the direction of the measurement bias: JS-thread frame timing tends to
*flatter* SymbolLayer by hiding native-thread cost. It held that advantage and
still did not separate, which strengthens rather than weakens the conclusion.

## Rationale

With performance tied, the decision rests on product requirements. The
production marker must carry a circular avatar photo, a rotating direction
indicator, a pulsing halo, and status states, and must later support arrival
animations and richer interactions.

| Requirement | ViewAnnotation | SymbolLayer |
|---|---|---|
| Avatar photo | `<Image source={{uri}}>` | Runtime rasterise per professional: download, circular crop, composite, register as a style image |
| Direction indicator | `transform: rotate` | `iconRotate` expression — genuinely better |
| Pulsing halo | `Animated.loop` + `useNativeDriver` — off-thread, **zero JS per frame** | No looping animation in MapLibre; drive `circle-radius`/`icon-opacity` from JS **every frame** |
| Status badge | A `<View>` | Extra icon variants or another layer |
| Debugging | Component tree, DevTools | Style expressions, source diffs, image registration |
| Failure mode | Slow (visible, gradual) | **Invisible** (nothing draws) |

The halo is pivotal: free in ViewAnnotation, per-frame JS in SymbolLayer —
reintroducing exactly the cost Phase 2 removed.

For a healthcare product, a *silent* failure (a nurse who cannot be seen) is far
worse than a *slow* one. During implementation this was not hypothetical: the
SymbolLayer candidate would have rendered an empty scene and posted excellent
numbers had the icon failed to register, which is why an explicit
"THIS RUN IS INVALID" guard exists in that candidate.

## Consequences

- Marker work stays in ordinary React; no runtime image pipeline is needed.
- Rotation gives up the GPU path. Acceptable: bearing smoothing already runs in
  `lib/tracking/motion.ts` and costs nothing measurable.
- If a future feature needs **many** simultaneous markers (dozens of nearby
  pros), SymbolLayer becomes the right tool for *that* layer. This ADR covers
  the single tracked marker only.
- `SymbolLayerCandidate.tsx` is retained in the benchmark, not deleted — it is
  the comparison point for any future re-evaluation.

## Limitations of the evidence

- **Dev build.** Absolute figures are not representative of release; both
  candidates were measured identically, so the relative result holds.
- **Device ceiling ~48 FPS.** A release build might resolve differences this run
  cannot. Given the margins involved, a difference too small to see here is also
  too small to outweigh the marker requirements.
- **Simple arrow, not the production marker.** The rich marker is where the two
  actually diverge — and that divergence favours ViewAnnotation.
- **JS-thread timing, not the compositor.** A Perfetto capture remains the
  authority on presented frames and should be run once against the final rich
  marker during integration.

## Revisit if

- Perfetto shows presented-frame jank that JS timing did not.
- The marker must be drawn dozens of times at once.
- A release-build benchmark shows separation beyond the noise floor here.
