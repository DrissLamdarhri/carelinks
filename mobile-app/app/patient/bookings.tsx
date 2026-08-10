import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, AlertTriangle, Brain, Calendar, CalendarClock, ChevronRight, Flower2, MapPin, Star, Syringe, X } from "lucide-react-native";
import { Colors, Gradients, Shadows } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { usePatientBookingsWindow } from "@/lib/db/realtime";
import { addDays, dateKey, effectiveDate, friendlyDayLabel, intlLocale, isSameDay, startOfWeek } from "@/lib/date-utils";
import { DateStrip } from "@/components/DateStrip";
import { MonthCalendarModal } from "@/components/MonthCalendarModal";
import type { Booking } from "@/lib/db/types";
import { CancellationDialog } from "@/components/CancellationDialog";
import { YogaBookingDetails } from "@/components/YogaBookingDetails";
import { cancelYogaBooking, getBookingDetails } from "@/lib/db/yoga";
import { isRefundEligible } from "@/lib/yoga-cancellation";
import { showToast } from "@/lib/toast";
import { showAppAlert } from "@/lib/app-alert";
import type { YogaBookingDetails as YogaBookingDetailsT } from "@/types/yoga";

const SCREEN_W = Dimensions.get("window").width;

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  open: { color: "#B45309", bg: "#FFF7E6" },
  matched: { color: "#2563EB", bg: "#DBEAFE" },
  en_route: { color: "#7C3AED", bg: "#F3EEFE" },
  in_progress: { color: "#0891B2", bg: "#CFFAFE" },
  completed: { color: "#16A34A", bg: "#DCFCE7" },
  cancelled: { color: "#E24B4A", bg: "#FDE8E8" },
};
const SPECIALTY_META: Record<string, { grad: readonly [string, string]; icon: typeof Syringe }> = {
  nurse: { grad: Gradients.nurse, icon: Syringe },
  psychologist: { grad: Gradients.psy, icon: Brain },
  yoga_instructor: { grad: Gradients.yoga, icon: Flower2 },
  physiotherapist: { grad: Gradients.kine, icon: Activity },
};
const metaFor = (sp: string) => SPECIALTY_META[sp] ?? SPECIALTY_META.nurse;

type CardItem = {
  id: string;
  specialty: Booking["specialty"];
  specialtyLabel: string;
  name: string;
  price: number;
  dateLabel: string;
  scheduledAt: string | null;
  status: Booking["status"];
  isCompleted: boolean;
  rating?: number;
};

export default function PatientBookingsScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const STATUS_KEY: Record<string, string> = { open: "status_open", matched: "status_matched", en_route: "status_en_route", in_progress: "status_in_progress", completed: "status_completed", cancelled: "status_cancelled" };
  const { user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [yogaModalBookingId, setYogaModalBookingId] = useState<string | null>(null);
  const [yogaModalDetails, setYogaModalDetails] = useState<YogaBookingDetailsT | null>(null);
  const [yogaModalLoading, setYogaModalLoading] = useState(false);
  const [yogaCancelBusy, setYogaCancelBusy] = useState(false);

  // Scoped to the visible week instead of a patient's entire booking history
  // — that used to be fetched and rendered in full on every visit, getting
  // slower the longer someone had used the app. A week always stays small.
  const weekStartISO = useMemo(() => weekStart.toISOString(), [weekStart]);
  const weekEndISO = useMemo(() => addDays(weekStart, 7).toISOString(), [weekStart]);
  const { bookings, loading, error, refresh } = usePatientBookingsWindow(user?.id ?? null, weekStartISO, weekEndISO);

  const markedDates = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookings) set.add(dateKey(effectiveDate(b)));
    return set;
  }, [bookings]);

  const dayBookings = useMemo(
    () => bookings.filter((b) => isSameDay(effectiveDate(b), selectedDate)),
    [bookings, selectedDate],
  );

  const normalized = useMemo<CardItem[]>(
    () =>
      dayBookings.map((booking) => {
        const isPast = booking.status === "completed" || booking.status === "cancelled";
        return {
          id: booking.id,
          specialty: booking.specialty,
          specialtyLabel: booking.specialty.replaceAll("_", " "),
          name: booking.professional_id ? `${t("the_professional")} ${booking.professional_id.slice(0, 4)}` : t("your_request"),
          price: booking.final_price_mad ?? booking.budget_max_mad ?? booking.budget_min_mad ?? 0,
          dateLabel: new Date(booking.scheduled_at ?? booking.created_at).toLocaleString(intlLocale(locale), {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          }),
          scheduledAt: booking.scheduled_at,
          status: booking.status,
          isCompleted: isPast,
          rating: booking.status === "completed" ? 5 : undefined,
        };
      }),
    [dayBookings, locale, t],
  );

  const upcoming = useMemo(
    () => normalized.filter((item) => !item.isCompleted && item.status !== "cancelled"),
    [normalized]
  );
  const past = useMemo(
    () => normalized.filter((item) => item.isCompleted || item.status === "cancelled"),
    [normalized]
  );

  const selectDay = (d: Date) => {
    setSelectedDate(d);
    const ws = startOfWeek(d);
    if (!isSameDay(ws, weekStart)) setWeekStart(ws);
  };

  const pagerRef = useRef<ScrollView>(null);
  const goTab = (next: "upcoming" | "past") => {
    setTab(next);
    pagerRef.current?.scrollTo({ x: next === "upcoming" ? 0 : SCREEN_W, animated: true });
  };

  const openYogaDetails = async (bookingId: string) => {
    setYogaModalBookingId(bookingId);
    setYogaModalLoading(true);
    setYogaModalDetails(null);
    try {
      const d = await getBookingDetails(bookingId);
      setYogaModalDetails(d);
    } catch {
      // leave null — the modal shows a fallback message
    } finally {
      setYogaModalLoading(false);
    }
  };

  // Yoga has its own 24h refund rule, decided server-side by
  // cancel_yoga_booking() (migration 0041) — never the generic cancel_booking
  // RPC, which has no timing awareness at all. `item.scheduledAt` is the
  // session's own start time (set at booking creation, see app/patient/yoga.tsx),
  // so no extra lookup is needed to preview eligibility here.
  const handleYogaCancel = (item: CardItem) => {
    const eligible = item.scheduledAt ? isRefundEligible(item.scheduledAt) : true;
    showAppAlert(
      t("pay_cancel_booking_q"),
      eligible
        ? t("pay_yoga_refund_full")
        : t("pay_yoga_refund_none"),
      [
        { text: t("pay_keep_booking"), style: "cancel" },
        {
          text: t("cancel_reservation"),
          style: "destructive",
          onPress: async () => {
            if (yogaCancelBusy) return;
            setYogaCancelBusy(true);
            try {
              const res = await cancelYogaBooking(item.id);
              showToast(
                res.eligible && res.refund_mad > 0
                  ? t("pay_booking_cancelled_refund").replace("{n}", String(res.refund_mad))
                  : t("pay_booking_cancelled_no_refund"),
              );
              void refresh();
            } catch (e) {
              showAppAlert(t("error"), e instanceof Error ? e.message : t("cancel_impossible"));
            } finally {
              setYogaCancelBusy(false);
            }
          },
        },
      ],
    );
  };

  const renderCard = (item: CardItem) => {
    const isYoga = item.specialty === "yoga_instructor";
    const sm = metaFor(item.specialty);
    const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.open;
    const SIcon = sm.icon;
    return (
      <View key={item.id} style={styles.card}>
        <View style={[styles.accent, { backgroundColor: st.color }]} />
        <View style={styles.cardInner}>
          <View style={styles.bodyRow}>
            <LinearGradient colors={sm.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <SIcon size={22} color="#fff" strokeWidth={2} />
            </LinearGradient>
            <View style={styles.infoWrap}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.specialtyLabel} · {item.isCompleted ? t("mission_completed") : t("home_service")}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: st.color }]} />
              <Text style={[styles.statusPillTxt, { color: st.color }]}>{t(STATUS_KEY[item.status] ?? "status_open")}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <CalendarClock size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{item.dateLabel}</Text>
            <View style={styles.metaDot} />
            <MapPin size={13} color={Colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>{item.isCompleted ? t("tab_history") : t("at_home")}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.footerRow}>
            <View>
              {item.isCompleted ? (
                <View style={styles.ratingWrap}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={13} color={star <= (item.rating ?? 0) ? "#FBBF24" : "#E0E0E0"} fill={star <= (item.rating ?? 0) ? "#FBBF24" : "transparent"} />
                  ))}
                </View>
              ) : (
                <>
                  <Text style={styles.priceLbl}>{t("total_to_pay")}</Text>
                  <Text style={styles.price}>{item.price} {t("mad")}</Text>
                </>
              )}
            </View>

            <View style={styles.actions}>
              {item.isCompleted ? (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => router.push(`/patient/report/${item.id}`)}
                  accessibilityLabel={t("report_problem_title")}
                >
                  <AlertTriangle size={13} color={Colors.danger} />
                  <Text style={styles.secondaryBtnText}>{t("report_problem_short")}</Text>
                </TouchableOpacity>
              ) : null}
              {!item.isCompleted ? (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    if (isYoga) {
                      handleYogaCancel(item);
                      return;
                    }
                    setCancelTarget({
                      id: item.id,
                      patient_id: user?.id ?? "",
                      service_id: null,
                      specialty: item.specialty,
                      professional_id: null,
                      status: item.status,
                      urgency: "normal",
                      scheduled_at: item.scheduledAt,
                      address: null,
                      notes: null,
                      budget_min_mad: null,
                      budget_max_mad: null,
                      final_price_mad: item.price,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      completed_at: null,
                      cancelled_at: null,
                      cancel_reason: null,
                      cancel_case: null,
                      refund_mad: null,
                      cancelled_by: null,
                      session_mode: null,
                      plan_type: null,
                      recurrence: null,
                      series_id: null,
                      session_index: null,
                      session_total: null,
                      meet_link: null,
                      zoom_link: null,
                      yoga_session_id: null,
                      care_type: null,
                    });
                  }}
                >
                  <X size={13} color={Colors.danger} />
                  <Text style={styles.secondaryBtnText}>{t("cancel")}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  if (isYoga) {
                    void openYogaDetails(item.id);
                    return;
                  }
                  router.push(
                    item.isCompleted
                      ? `/patient/request?service=${encodeURIComponent(item.specialtyLabel)}`
                      : `/patient/tracking?bookingId=${encodeURIComponent(item.id)}`
                  );
                }}
              >
                <Text style={styles.primaryBtnText}>
                  {isYoga ? t("pay_view_details") : item.isCompleted ? t("book_again") : t("see_details")}
                </Text>
                {!item.isCompleted && !isYoga ? <ChevronRight size={14} color="white" /> : null}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("my_appointments_full")}</Text>
          <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveTxt}>{t("realtime_active")}</Text></View>
        </View>
        <Text style={styles.dayLabel}>{friendlyDayLabel(selectedDate, t, intlLocale(locale))}</Text>

        <DateStrip
          weekStart={weekStart}
          selectedDate={selectedDate}
          markedDates={markedDates}
          onSelectDate={selectDay}
          onChangeWeek={setWeekStart}
          onOpenCalendar={() => setCalendarOpen(true)}
          locale={locale}
        />

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "upcoming" && styles.tabBtnActive]}
            onPress={() => goTab("upcoming")}
          >
            <Text style={[styles.tabText, tab === "upcoming" && styles.tabTextActive]}>
              {t("tab_upcoming")} ({upcoming.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "past" && styles.tabBtnActive]}
            onPress={() => goTab("past")}
          >
            <Text style={[styles.tabText, tab === "past" && styles.tabTextActive]}>
              {t("tab_history")} ({past.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            const next = i === 0 ? "upcoming" : "past";
            if (next !== tab) setTab(next);
          }}
        >
          {([["upcoming", upcoming], ["past", past]] as const).map(([key, items]) => (
            <View key={key} style={{ width: SCREEN_W }}>
              {items.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIcon}>
                    <Calendar size={28} color={Colors.textSubtle} />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {key === "upcoming" ? t("no_upcoming") : t("no_history")}
                  </Text>
                  {key === "upcoming" ? (
                    <TouchableOpacity style={styles.emptyCta} onPress={() => router.push("/patient/request")}>
                      <Text style={styles.emptyCtaText}>{t("book_appointment")}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
                  {items.map(renderCard)}
                </ScrollView>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
      {cancelTarget ? (
        <CancellationDialog
          visible
          bookingId={cancelTarget.id}
          scheduledAt={cancelTarget.scheduled_at}
          status={cancelTarget.status}
          price={cancelTarget.final_price_mad ?? cancelTarget.budget_max_mad ?? cancelTarget.budget_min_mad ?? 0}
          onClose={() => setCancelTarget(null)}
          onCancelled={refresh}
        />
      ) : null}

      <MonthCalendarModal
        visible={calendarOpen}
        initialDate={selectedDate}
        onClose={() => setCalendarOpen(false)}
        onSelect={selectDay}
      />

      <Modal
        transparent
        visible={!!yogaModalBookingId}
        animationType="fade"
        onRequestClose={() => setYogaModalBookingId(null)}
      >
        <View style={styles.yogaModalBackdrop}>
          <View style={styles.yogaModalCard}>
            <View style={styles.yogaModalHeader}>
              <Text style={styles.yogaModalTitle}>{t("pay_booking_details_title")}</Text>
              <TouchableOpacity onPress={() => setYogaModalBookingId(null)} style={styles.yogaModalClose}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {yogaModalLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginVertical: 30 }} />
              ) : yogaModalDetails ? (
                <YogaBookingDetails
                  details={yogaModalDetails}
                  onResumePayment={() => {
                    const id = yogaModalDetails.booking_id;
                    setYogaModalBookingId(null);
                    router.push(`/patient/payment/${encodeURIComponent(id)}`);
                  }}
                />
              ) : (
                <Text style={styles.errorText}>{t("pay_details_load_failed")}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  yogaModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  yogaModalCard: { backgroundColor: "#F7F9FC", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", padding: 18 },
  yogaModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  yogaModalTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary },
  yogaModalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EFEFEF", alignItems: "center", justifyContent: "center" },
  root: { flex: 1, backgroundColor: "#F7F9FC" },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 26 },
  title: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  dayLabel: { fontSize: 12.5, color: Colors.textMuted, marginTop: 2, marginBottom: 12, textTransform: "capitalize" },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.input,
    borderRadius: 12,
    padding: 4,
    marginTop: 12,
  },
  tabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: { backgroundColor: "white" },
  tabText: { color: Colors.textMuted, fontSize: 13 },
  tabTextActive: { color: Colors.textPrimary, fontWeight: "600" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 56 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { color: Colors.textMuted, fontSize: 15, fontWeight: "500" },
  emptyCta: {
    marginTop: 12,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  emptyCtaText: { color: "white", fontSize: 13, fontWeight: "600" },
  headerBlock: { paddingHorizontal: 20, paddingTop: 20 },
  pageContent: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EAF7EF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#16A34A" },
  liveTxt: { color: "#16A34A", fontSize: 11, fontWeight: "700" },
  card: { backgroundColor: "white", borderRadius: 20, marginBottom: 12, flexDirection: "row", overflow: "hidden", ...Shadows.md },
  accent: { width: 5 },
  cardInner: { flex: 1, padding: 15 },
  bodyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  infoWrap: { flex: 1, minWidth: 0 },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillTxt: { fontSize: 11, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  metaText: { color: Colors.textMuted, fontSize: 12, flexShrink: 1 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textSubtle, marginHorizontal: 2 },
  divider: { height: 1, backgroundColor: "#F2F2F4", marginVertical: 13 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  priceLbl: { color: Colors.textMuted, fontSize: 10.5, fontWeight: "600" },
  price: { color: Colors.primary, fontSize: 18, fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: "#F1D9D9", paddingHorizontal: 14, backgroundColor: "#FEF5F5" },
  secondaryBtnText: { color: Colors.danger, fontSize: 12.5, fontWeight: "700" },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 40, borderRadius: 12, backgroundColor: Colors.primary, paddingHorizontal: 16 },
  primaryBtnText: { color: "white", fontSize: 12.5, fontWeight: "700" },
  ratingWrap: { flexDirection: "row", gap: 3 },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
