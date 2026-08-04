/**
 * CareLink — development-only launcher for /dev/bench.
 *
 * Reaching a route that no product screen links to otherwise means firing a
 * deep link from adb every time, which is friction during a benchmarking
 * session that already requires the phone to be left alone.
 *
 * Renders NOTHING unless __DEV__. It is deliberately small, low-contrast and
 * bottom-left: the benchmark measures frame times, so a launcher that overlaps
 * the map or invites accidental taps would corrupt the very runs it exists to
 * start. Long-press to hide it for the rest of the session if it is in the way.
 */
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export function DevBenchLauncher() {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);

  if (!__DEV__ || hidden) return null;

  return (
    <TouchableOpacity
      style={s.pill}
      onPress={() => router.push("/dev/bench")}
      onLongPress={() => setHidden(true)}
      accessibilityRole="button"
      accessibilityLabel="Open the tracking benchmark (development only)"
      accessibilityHint="Long press to hide for this session"
    >
      <Text style={s.text}>BENCH</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  pill: {
    position: "absolute",
    left: 8,
    bottom: 28,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(13,8,112,0.72)",
    zIndex: 9999,
  },
  text: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
});
