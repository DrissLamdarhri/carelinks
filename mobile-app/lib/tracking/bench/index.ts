/**
 * CareLink — tracking benchmark framework.
 *
 * Public surface. See docs/tracking-benchmark.md for how to run it, collect
 * measurements, and read the results.
 *
 * DEV ONLY. Nothing in production code may import from this directory; the
 * benchmark screen (`app/dev/bench.tsx`) is the sole consumer and it refuses to
 * render outside a development build.
 */
export * from "./types";
export * from "./traces";
export * from "./scenarios";
export * from "./metrics";
export * from "./report";
export * from "./runner";
