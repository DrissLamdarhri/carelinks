# Benchmark baselines

Archived runs, kept so future tracking changes can be checked against known-good
numbers on the same hardware. Compare with `compareToBaseline()` in `../report.ts`.

Only compare runs from the **same device and the same build type** — the report
flags mixed devices, but nothing can rescue a cross-device comparison.

| File | Device | Build | Notes |
|---|---|---|---|
| `2026-08-04-SM-A065F-dev.txt` | Samsung SM-A065F, Android 36 | dev | Renderer selection run (ADR 0001). Control 47.4 FPS avg. |
