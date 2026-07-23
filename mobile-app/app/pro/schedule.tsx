import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CalendarClock, ChevronRight, Clock, MapPin } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { formatAddress } from "@/lib/db/geo";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import type { Booking } from "@/lib/db/types";

const NAVY = "#0D0870";
const SCREEN_W = Dimensions.get("window").width;
const SPEC_LABEL: Record<string, string> = {
  nurse: "spec_nurse",
  physiotherapist: "spec_physio",
  psychologist: "spec_psy",
  yoga_instructor: "spec_yoga",
};

export default function ProScheduleScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"upcoming" | "done">("upcoming");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (!user?.id) { setLoading(false); return; }
        try {
          const rows = await db.bookings.listForPro(user.id);
          if (!cancelled) setBookings(rows.filter((b) => b.status !== "open"));
        } catch {
          /* ignore */
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [user?.id]),
  );

  const upcoming = useMemo(
    () => bookings.filter((b) => b.status === "matched" || b.status === "in_progress"),
    [bookings],
  );
  const done = useMemo(
    () => bookings.filter((b) => b.status === "completed" || b.status === "cancelled"),
    [bookings],
  );
  // Tabs and horizontal swipe drive the same state, so dragging left/right feels
  // native and always stays in sync with the highlighted tab.
  const pagerRef = useRef<ScrollView>(null);
  const goTab = (next: "upcoming" | "done") => {
    setFilter(next);
    pagerRef.current?.scrollTo({ x: next === "upcoming" ? 0 : SCREEN_W, animated: true });
  };

  const renderCard = (b: Booking) => {
    const d = b.scheduled_at ? new Date(b.scheduled_at) : null;
    const done_ = b.status === "completed";
    const cancelled = b.status === "cancelled";
    return (
      <TouchableOpacity key={b.id} activeOpacity={0.9} onPress={() => router.push(`/pro/tracking/${b.id}`)} style={s.card}>
        <View style={s.dateTile}>
          <Text style={s.dateDay}>{d ? d.toLocaleDateString("fr-MA", { day: "2-digit" }) : "--"}</Text>
          <Text style={s.dateMon}>{d ? d.toLocaleDateString("fr-MA", { month: "short" }) : ""}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.rowTop}>
            <Text style={s.patient}>{t("patient")}</Text>
            <View style={[s.pill, done_ ? s.pillDone : cancelled ? s.pillCancel : b.status === "in_progress" ? s.pillLive : s.pillSoon]}>
              <Text style={[s.pillTxt, done_ ? s.pillTxtDone : cancelled ? s.pillTxtCancel : b.status === "in_progress" ? s.pillTxtLive : s.pillTxtSoon]}>
                {done_ ? t("status_completed") : cancelled ? t("status_cancelled") : b.status === "in_progress" ? t("status_in_progress") : t("tab_upcoming")}
              </Text>
            </View>
          </View>
          <Text style={s.spec}>{SPEC_LABEL[b.specialty] ? t(SPEC_LABEL[b.specialty]) : b.specialty}</Text>
          <View style={s.metaRow}>
            <Clock size={12} color={Colors.textMuted} />
            <Text style={s.metaTxt}>
              {d ? d.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" }) : t("flexible_time")}
            </Text>
          </View>
          {b.address ? (
            <View style={s.metaRow}>
              <MapPin size={12} color={Colors.textMuted} />
              <Text style={s.metaTxt} numberOfLines={1}>{formatAddress(b.address) || t("at_home")}</Text>
            </View>
          ) : null}
          <View style={s.foot}>
            <Text style={s.price}>{b.final_price_mad ?? b.budget_max_mad ?? 0} MAD</Text>
            {!done_ && !cancelled ? (
              <View style={s.openRow}>
                <Text style={s.openTxt}>{t("open_action")}</Text>
                <ChevronRight size={15} color={NAVY} />
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>{t("my_missions")}</Text>
        <Text style={s.subtitle}>
          {upcoming.length} à venir · {done.length} terminée{done.length > 1 ? "s" : ""}
        </Text>
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, filter === "upcoming" && s.tabActive]} onPress={() => goTab("upcoming")}>
            <Text style={[s.tabTxt, filter === "upcoming" && s.tabTxtActive]}>À venir ({upcoming.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, filter === "done" && s.tabActive]} onPress={() => goTab("done")}>
            <Text style={[s.tabTxt, filter === "done" && s.tabTxtActive]}>Terminées ({done.length})</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 46 }} color={NAVY} />
      ) : (
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            const next = i === 0 ? "upcoming" : "done";
            if (next !== filter) setFilter(next);
          }}
        >
          {([["upcoming", upcoming, "no_missions_upcoming"], ["done", done, "no_missions_done"]] as const).map(
            ([key, items, emptyKey]) => (
              <View key={key} style={{ width: SCREEN_W }}>
                {items.length === 0 ? (
                  <View style={s.emptyCard}>
                    <View style={s.emptyIcon}><CalendarClock size={22} color={Colors.textSubtle} /></View>
                    <Text style={s.emptyTitle}>{t(emptyKey)}</Text>
                    <Text style={s.emptySub}>{t("fill_schedule_hint")}</Text>
                  </View>
                ) : (
                  <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
                    {items.map(renderCard)}
                  </ScrollView>
                )}
              </View>
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: {
    backgroundColor: "white", paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  title: { fontSize: 24, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular" },
  subtitle: { fontSize: 12.5, color: Colors.textMuted, marginTop: 2, marginBottom: 12 },
  tabs: { flexDirection: "row", gap: 8, backgroundColor: Colors.input, borderRadius: 12, padding: 4 },
  tab: { flex: 1, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: NAVY },
  tabTxt: { color: Colors.textMuted, fontSize: 12.5, fontWeight: "700" },
  tabTxtActive: { color: "white" },

  emptyCard: { margin: 20, backgroundColor: "white", borderRadius: 18, paddingVertical: 30, alignItems: "center", gap: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  emptySub: { color: Colors.textMuted, fontSize: 12.5, textAlign: "center", paddingHorizontal: 24, lineHeight: 18 },

  card: {
    flexDirection: "row", gap: 12, backgroundColor: "white", borderRadius: 18, padding: 14,
    shadowColor: NAVY, shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  dateTile: { width: 54, borderRadius: 14, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  dateDay: { color: NAVY, fontSize: 20, fontWeight: "800", lineHeight: 22 },
  dateMon: { color: Colors.primary, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  patient: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  spec: { color: Colors.textMuted, fontSize: 12.5, marginTop: 1, marginBottom: 6, textTransform: "capitalize" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  metaTxt: { flex: 1, color: Colors.textMuted, fontSize: 12 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  price: { color: NAVY, fontSize: 15, fontWeight: "800" },
  openRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  openTxt: { color: NAVY, fontSize: 12.5, fontWeight: "700" },

  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillTxt: { fontSize: 10.5, fontWeight: "800" },
  pillSoon: { backgroundColor: Colors.surfaceWarm },
  pillTxtSoon: { color: Colors.primary },
  pillLive: { backgroundColor: "#E0F7FA" },
  pillTxtLive: { color: "#0891B2" },
  pillDone: { backgroundColor: "#E7F6EC" },
  pillTxtDone: { color: "#16A34A" },
  pillCancel: { backgroundColor: "#F3F3F5" },
  pillTxtCancel: { color: Colors.textMuted },
});
