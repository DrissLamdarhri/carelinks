/**
 * CareLink — the professional's maneuver banner.
 * ────────────────────────────────────────────────────────────────────────────
 * Answers, in this order and in this visual weight:
 *
 *     HOW FAR   →   WHAT DO I DO   →   ON WHICH ROAD   →   AND THEN?
 *
 * The order is the point. A driver glancing up for 300 ms reads the top-left of
 * the card first, so the distance goes there at the largest size: it is what
 * decides whether the instruction is relevant *yet*. The verb comes second, the
 * street name third — a street sign confirms a decision already made, it does
 * not make it.
 *
 * The previous banner inverted this. It led with the verb at 16 pt and buried
 * the distance in a 12 pt subtitle alongside two unrelated trip figures
 * ("80 m · 4.2 km total · ~12 min"), so the one number that changes meaning
 * second by second was the hardest one on the card to find.
 *
 * TRIP FIGURES LIVE SOMEWHERE ELSE. `TripStrip` below is deliberately a
 * separate component rendered in the sheet: mixing "turn left in 200 m" with
 * "arriving 14:32" in one container makes both slower to read.
 *
 * Brand: navy card, existing `Colors.accent` for the committed states. No new
 * colours are introduced.
 */
import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  MapPinOff,
  Merge,
  RotateCcw,
  Split,
} from "lucide-react-native";
import { Colors } from "@/lib/colors";
import {
  formatDistance,
  instructionText,
  type Guidance,
  type ManeuverDir,
  type NavPhase,
} from "@/lib/tracking/guidance";

const NAVY = "#0D0870";

/**
 * What the banner is currently able to say.
 *
 * `unavailable` is a real, first-class state rather than an empty card: when
 * routing fails, `fetchRoute` hands back a straight line between two real
 * points, and a confident turn instruction derived from that would be a lie.
 * Saying "follow the address" is the honest answer and keeps the call button
 * one tap away.
 */
export type NavStatus = "guiding" | "calculating" | "recalculating" | "unavailable" | "locating";

type Props = {
  status: NavStatus;
  guidance: Guidance | null;
  t: (k: string) => string;
};

/** The turn glyph. Never mirrored under RTL — left is left in every script. */
function ManeuverIcon({ dir, color, size = 26 }: { dir: ManeuverDir; color: string; size?: number }) {
  const w = 2.6;
  switch (dir) {
    case "left":
      return <CornerUpLeft size={size} color={color} strokeWidth={w} />;
    case "right":
      return <CornerUpRight size={size} color={color} strokeWidth={w} />;
    case "slight-left":
    case "fork-left":
      return <ArrowUpLeft size={size} color={color} strokeWidth={w} />;
    case "slight-right":
    case "fork-right":
      return <ArrowUpRight size={size} color={color} strokeWidth={w} />;
    // No distinct "sharp" glyph exists in the icon set. Reusing the plain turn
    // arrow is better than inventing one: the wording already says "franchement
    // à gauche", and an unfamiliar symbol costs more than the nuance is worth.
    case "sharp-left":
      return <CornerUpLeft size={size} color={color} strokeWidth={w} />;
    case "sharp-right":
      return <CornerUpRight size={size} color={color} strokeWidth={w} />;
    case "uturn":
      return <RotateCcw size={size} color={color} strokeWidth={w} />;
    case "roundabout":
      return <RotateCcw size={size} color={color} strokeWidth={w} />;
    case "merge":
      return <Merge size={size} color={color} strokeWidth={w} />;
    case "ramp":
      return <Split size={size} color={color} strokeWidth={w} />;
    case "arrive":
      return <Flag size={size - 2} color={color} strokeWidth={w} />;
    case "depart":
    case "straight":
    default:
      return <ArrowUp size={size} color={color} strokeWidth={w} />;
  }
}

/** Committed states get the brand accent; cruising stays quiet. */
function isCommitted(phase: NavPhase): boolean {
  return phase === "imminent" || phase === "now";
}

export function ManeuverBanner({ status, guidance, t }: Props) {
  const phase: NavPhase = guidance?.phase ?? "cruise";
  const committed = status === "guiding" && isCommitted(phase);

  // One slow breath while the turn is imminent. Deliberately subtle and
  // deliberately not a flash: peripheral vision notices a scale change without
  // it demanding a look, which is the correct amount of attention to ask of
  // someone driving.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!committed) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [committed, pulse]);

  const iconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  // ── Non-guiding states ────────────────────────────────────────────────────
  if (status !== "guiding" || !guidance) {
    const unavailable = status === "unavailable";
    return (
      <View style={[s.card, unavailable && s.cardMuted]}>
        <View style={s.iconTile}>
          {unavailable ? (
            <MapPinOff size={22} color="#FFFFFF" strokeWidth={2.4} />
          ) : (
            <ActivityIndicator color="#FFFFFF" />
          )}
        </View>
        <View style={s.body}>
          <Text style={s.pendingTitle} numberOfLines={1}>
            {unavailable
              ? t("nav_route_unavailable")
              : status === "recalculating"
                ? t("nav_recalculating")
                : status === "locating"
                  ? t("locating")
                  : t("calculating_route")}
          </Text>
          {unavailable ? (
            <Text style={s.road} numberOfLines={1}>
              {t("nav_route_unavailable_sub")}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Guiding ───────────────────────────────────────────────────────────────
  const { current, next, distanceToManeuverM } = guidance;
  const glyphColor = committed ? NAVY : "#FFFFFF";
  // At the junction the metres stop being useful — "maintenant" is what a
  // driver needs, and it is a word, so it takes the smaller size.
  const atManeuver = phase === "now";
  const distanceLabel = atManeuver ? t("nav_now") : formatDistance(distanceToManeuverM, t);

  return (
    <View style={s.card}>
      <View style={s.primaryRow}>
        <Animated.View
          style={[s.iconTile, committed && s.iconTileHot, { transform: [{ scale: iconScale }] }]}
        >
          <ManeuverIcon dir={current.dir} color={glyphColor} />
        </Animated.View>

        <View style={s.body}>
          <Text
            style={[s.distance, atManeuver && s.distanceWord, committed && s.distanceHot]}
            numberOfLines={1}
          >
            {distanceLabel}
          </Text>
          <Text style={s.instruction} numberOfLines={2}>
            {instructionText(current, t)}
          </Text>
          {current.road ? (
            <Text style={s.road} numberOfLines={1}>
              {current.road}
            </Text>
          ) : null}
        </View>
      </View>

      {/* "Then" — only when the following maneuver is close enough that the two
          have to be planned together. Otherwise it is noise competing with the
          instruction that matters. */}
      {next ? (
        <View style={s.thenRow}>
          <ManeuverIcon dir={next.dir} color="rgba(255,255,255,0.8)" size={15} />
          <Text style={s.thenTxt} numberOfLines={1}>
            {t("nav_then")} {instructionText(next, t).toLocaleLowerCase()}
          </Text>
          <Text style={s.thenDist} numberOfLines={1}>
            {formatDistance(Math.max(0, next.offsetM - current.offsetM), t)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Remaining journey — distance, duration, clock time of arrival.
 *
 * Rendered in the mission sheet rather than on the map, and sized so it stays
 * legible when the sheet is dragged down to its peek height: "how much is left"
 * and "when do I get there" are questions a professional asks once a minute,
 * not at every junction, but they must never require a drag to answer.
 */
export function TripStrip({
  remainingM,
  remainingS,
  arrivalAt,
  t,
}: {
  remainingM: number | null;
  remainingS: number | null;
  /** Pre-formatted clock time, e.g. "14:32". Null when no routed duration. */
  arrivalAt: string | null;
  t: (k: string) => string;
}) {
  if (remainingM == null) return null;
  const minutes = remainingS != null ? Math.max(1, Math.round(remainingS / 60)) : null;

  return (
    <View style={s.trip}>
      {minutes != null ? (
        <>
          <Text style={s.tripPrimary}>
            {minutes} {t("unit_min")}
          </Text>
          <View style={s.tripDot} />
        </>
      ) : null}
      <Text style={s.tripSecondary}>{formatDistance(remainingM, t)}</Text>
      {arrivalAt ? (
        <>
          <View style={s.tripDot} />
          <Text style={s.tripSecondary}>{t("nav_arrival_at").replace("%s", arrivalAt)}</Text>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  cardMuted: { backgroundColor: "#4B4A6A" },
  primaryRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileHot: { backgroundColor: Colors.accent },
  body: { flex: 1 },

  // The hierarchy: distance loudest, verb next, street quietest.
  distance: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", lineHeight: 30 },
  distanceWord: { fontSize: 20, lineHeight: 26 },
  distanceHot: { color: Colors.accent },
  instruction: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "700", lineHeight: 20, marginTop: 1 },
  road: { color: "rgba(255,255,255,0.72)", fontSize: 12.5, marginTop: 2 },

  pendingTitle: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "700", lineHeight: 20 },

  thenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.14)",
  },
  thenTxt: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
  thenDist: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700" },

  trip: { flexDirection: "row", alignItems: "center", gap: 9 },
  tripPrimary: { fontSize: 20, fontWeight: "800", color: NAVY },
  tripSecondary: { fontSize: 13.5, fontWeight: "600", color: "#6B7280" },
  tripDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#C9C8D6" },
});
