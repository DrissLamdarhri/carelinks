import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Landmark, Wallet } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { showToast } from "@/lib/toast";
import { useAuth } from "@/lib/auth-context";
import { db, type Payment, type Payout, type PayoutMethod } from "@/lib/db/dal";
import { MonthCalendarModal } from "@/components/MonthCalendarModal";
import { intlLocale, startOfMonth } from "@/lib/date-utils";

const NAVY = "#0D0870";
const CREAM = "#EDE5CC";
const COMMISSION_PCT = 15;
const GREEN = "#16A34A";
const RED = "#E24B4A";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-MA", { day: "numeric", month: "short" });
const payoutLabel = (s: Payout["status"], t: (k: string) => string) =>
  s === "paid" ? t("payout_paid") : s === "processing" ? t("payout_processing") : s === "rejected" ? t("payout_rejected") : t("payout_requested");

type Move = {
  id: string;
  kind: "prestation" | "commission" | "payout";
  label: string;
  sub: string;
  amount: number;
  date: string;
};

export default function ProEarningsScreen() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const reload = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const [pays, pos, method] = await Promise.all([
        db.payments.listForPro(user.id).catch(() => [] as Payment[]),
        db.payouts.listForPro(user.id).catch(() => [] as Payout[]),
        db.payoutMethods.get(user.id).catch(() => null),
      ]);
      setPayments(pays);
      setPayouts(pos);
      setPayoutMethod(method);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Wallet math — ONLY captured money counts; escrow holds are NOT withdrawable ──
  // service + trip_comp credit the nurse (net of commission); penalty debits the balance.
  const netOf = (p: Payment) => Number(p.amount_mad) - Number(p.commission_mad);
  const captured = useMemo(() => payments.filter((p) => p.status === "captured"), [payments]);
  const paidServices = useMemo(() => captured.filter((p) => p.kind === "service"), [captured]);
  const earned = captured.reduce((s, p) => {
    if (p.kind === "penalty") return s - Number(p.amount_mad); // RULE #4 — full debit
    if (p.kind === "trip_comp") return s + Number(p.amount_mad); // RULE #3 — full credit (no commission)
    return s + netOf(p); // service — net of commission
  }, 0);
  // InHold (escrow): authorized service payments — shown but NOT withdrawable until the job is completed.
  const pendingNet = payments
    .filter((p) => p.status === "authorized")
    .reduce((s, p) => s + netOf(p), 0);
  const activePayouts = payouts.filter((p) => p.status !== "rejected");
  const withdrawn = activePayouts.reduce((s, p) => s + Number(p.amount_mad), 0);
  const available = Math.max(0, earned - withdrawn);

  const movements: Move[] = useMemo(() => {
    const list: Move[] = [];
    for (const p of captured) {
      if (p.kind === "penalty") {
        // RULE #4 — cancellation penalty debited from the nurse
        list.push({ id: `${p.id}-pen`, kind: "payout", label: t("cancellation_penalty"), sub: fmtDate(p.created_at), amount: -Number(p.amount_mad), date: p.created_at });
        continue;
      }
      if (p.kind === "trip_comp") {
        // RULE #3 — trip compensation credited to the nurse
        list.push({ id: `${p.id}-tc`, kind: "prestation", label: t("trip_compensation"), sub: fmtDate(p.created_at), amount: Number(p.amount_mad), date: p.created_at });
        continue;
      }
      list.push({ id: `${p.id}-p`, kind: "prestation", label: t("home_service"), sub: fmtDate(p.created_at), amount: Number(p.amount_mad), date: p.created_at });
      list.push({ id: `${p.id}-c`, kind: "commission", label: t("pro_commission_carelink").replace("{n}", String(COMMISSION_PCT)), sub: `${t("pro_commission_on").replace("{n}", String(p.amount_mad))} ${t("mad")}`, amount: -Number(p.commission_mad), date: p.created_at });
    }
    for (const po of activePayouts) {
      list.push({ id: po.id, kind: "payout", label: t("withdrawal"), sub: payoutLabel(po.status, t), amount: -Number(po.amount_mad), date: po.created_at });
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [captured, activePayouts]);

  // ── Period filter ──────────────────────────────────────────────────────────
  // The ledger only ever grows: after a few months of work it is hundreds of
  // rows on one scroll, and finding "what did I earn in August" means dragging
  // past every month since. A month is the unit a wallet is actually read in.
  //
  // `null` means every movement — kept reachable, because a running total is
  // sometimes exactly what you want.
  const [monthFilter, setMonthFilter] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterReady, setFilterReady] = useState(false);

  // Open on the most recent month that HAS movements rather than on today: a
  // pro who has not worked this month would otherwise land on an empty screen
  // and conclude the wallet was broken.
  useEffect(() => {
    if (filterReady || movements.length === 0) return;
    setMonthFilter(startOfMonth(new Date(movements[0].date)));
    setFilterReady(true);
  }, [movements, filterReady]);

  const shownMovements = useMemo(() => {
    if (!monthFilter) return movements;
    const y = monthFilter.getFullYear();
    const m = monthFilter.getMonth();
    return movements.filter((mv) => {
      const d = new Date(mv.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [movements, monthFilter]);

  /** Net change over the period on screen — the number the filter exists for. */
  const periodNet = useMemo(
    () => shownMovements.reduce((sum, mv) => sum + mv.amount, 0),
    [shownMovements],
  );

  /** Oldest month with activity, so the back arrow stops at real data. */
  const earliestMonth = useMemo(
    () =>
      movements.length
        ? startOfMonth(new Date(movements[movements.length - 1].date))
        : startOfMonth(new Date()),
    [movements],
  );
  const latestMonth = useMemo(
    () => (movements.length ? startOfMonth(new Date(movements[0].date)) : startOfMonth(new Date())),
    [movements],
  );
  const stepMonth = (delta: number) => {
    const base = monthFilter ?? latestMonth;
    setMonthFilter(startOfMonth(new Date(base.getFullYear(), base.getMonth() + delta, 1)));
  };
  const canGoBack = !!monthFilter && monthFilter > earliestMonth;
  const canGoForward = !!monthFilter && monthFilter < latestMonth;

  const requestPayout = () => {
    if (!user?.id || requesting) return;
    if (available < 50) { showToast(t("min_amount_50")); return; }
    // A payout with no RIB on file is rejected server-side (migration 0032) —
    // send the pro to add it rather than showing them that error.
    if (!payoutMethod) {
      Alert.alert(t("bank_details_required"), t("bank_details_required_msg"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("bank_details_add"), onPress: () => router.push("/pro/payout-method") },
      ]);
      return;
    }
    Alert.alert(t("withdraw"), t("withdraw_confirm_body").replace("%s", String(available)), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: async () => {
          setRequesting(true);
          try {
            await db.payouts.request({ professional_id: user.id, amount_mad: available, method: "bank" });
            showToast(t("withdraw_sent"));
            await reload();
          } catch {
            showToast(t("withdraw_failed"));
          } finally {
            setRequesting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={s.loadingRoot}><ActivityIndicator size="large" color={NAVY} /></View>;
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>{t("revenue")}</Text>

      {/* Wallet card */}
      <LinearGradient colors={[NAVY, "#241A9E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.wallet}>
        <View style={s.walletTop}>
          <Wallet size={16} color="rgba(255,255,255,0.7)" />
          <Text style={s.walletLbl}>{t("wallet_balance")}</Text>
        </View>
        <Text style={s.walletVal}>{available.toLocaleString("fr-MA")} <Text style={s.walletUnit}>{t("mad")}</Text></Text>
        <View style={s.walletRow}>
          <View style={s.walletBox}>
            <Text style={s.walletBoxLbl}>{t("pending_capture")}</Text>
            <Text style={s.walletBoxVal}>{pendingNet} {t("mad")}</Text>
          </View>
          <TouchableOpacity style={[s.walletBox, s.walletAction, available < 50 && { opacity: 0.55 }]} onPress={requestPayout} disabled={available < 50 || requesting}>
            {requesting ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <>
                <Text style={s.walletActionLbl}>{t("action")}</Text>
                <View style={s.walletActionRow}><ArrowUpRight size={15} color={NAVY} strokeWidth={2.4} /><Text style={s.walletActionTxt}>{t("withdraw_short")}</Text></View>
              </>
            )}
          </TouchableOpacity>
        </View>
        <View style={s.walletBlob} />
      </LinearGradient>

      {/* Where the money goes. Surfaced as its own row so a pro can set it up
          before they have anything to withdraw, instead of discovering it only
          when "Retirer" refuses. */}
      <TouchableOpacity style={s.bankRow} activeOpacity={0.85} onPress={() => router.push("/pro/payout-method")}>
        <View style={[s.bankIcon, !payoutMethod && s.bankIconWarn]}>
          <Landmark size={17} color={payoutMethod ? NAVY : "#B45309"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.bankTitle}>{t("bank_details")}</Text>
          <Text style={[s.bankSub, !payoutMethod && s.bankSubWarn]} numberOfLines={1}>
            {payoutMethod
              ? `${payoutMethod.bank_name} · •••• ${payoutMethod.rib.slice(-4)}`
              : t("bank_details_required_msg")}
          </Text>
        </View>
        <ChevronRight size={17} color={Colors.textSubtle} />
      </TouchableOpacity>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <CheckCircle2 size={17} color={NAVY} />
          <Text style={s.statVal}>{paidServices.length}</Text>
          <Text style={s.statLbl}>{t("paid_services")}</Text>
        </View>
        <View style={s.statCard}>
          <ArrowUpRight size={17} color={GREEN} />
          <Text style={s.statVal}>{earned} {t("mad")}</Text>
          <Text style={s.statLbl}>{t("total_earned_net")}</Text>
        </View>
      </View>

      {/* Movements */}
      <Text style={s.sectionTitle}>{t("wallet_movements")}</Text>

      {movements.length > 0 ? (
        <View style={s.periodBar}>
          <TouchableOpacity
            style={[s.periodArrow, !canGoBack && s.periodArrowOff]}
            disabled={!canGoBack}
            onPress={() => stepMonth(-1)}
            accessibilityLabel={t("previous_month")}
            accessibilityRole="button"
          >
            <ChevronLeft size={18} color={canGoBack ? NAVY : Colors.textSubtle} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.periodLabelBtn}
            onPress={() => setCalendarOpen(true)}
            accessibilityRole="button"
          >
            <CalendarDays size={15} color={NAVY} />
            <Text style={s.periodLabel} numberOfLines={1}>
              {monthFilter
                ? monthFilter.toLocaleDateString(intlLocale(locale), { month: "long", year: "numeric" })
                : t("all_periods")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.periodArrow, !canGoForward && s.periodArrowOff]}
            disabled={!canGoForward}
            onPress={() => stepMonth(1)}
            accessibilityLabel={t("next_month")}
            accessibilityRole="button"
          >
            <ChevronRight size={18} color={canGoForward ? NAVY : Colors.textSubtle} />
          </TouchableOpacity>
        </View>
      ) : null}

      {movements.length > 0 ? (
        <View style={s.periodSummary}>
          <Text style={s.periodCount}>
            {t("movements_count").replace("{n}", String(shownMovements.length))}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={[s.periodNet, { color: periodNet >= 0 ? GREEN : RED }]}>
            {periodNet >= 0 ? "+" : "−"}{Math.abs(periodNet)} {t("mad")}
          </Text>
          {monthFilter ? (
            <TouchableOpacity onPress={() => setMonthFilter(null)} hitSlop={8}>
              <Text style={s.periodAll}>{t("all_periods")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {movements.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyTxt}>{t("no_movements")}</Text>
          <Text style={s.emptySub}>{t("paid_services_hint")}</Text>
        </View>
      ) : shownMovements.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyTxt}>{t("no_movements_this_month")}</Text>
        </View>
      ) : (
        shownMovements.map((m) => {
          const credit = m.amount >= 0;
          return (
            <View key={m.id} style={s.moveRow}>
              <View style={[s.moveIcon, m.kind === "prestation" ? s.moveIconCredit : s.moveIconDebit]}>
                {credit ? <ArrowUpRight size={16} color={NAVY} /> : <ArrowDownLeft size={16} color={Colors.textMuted} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.moveLbl}>{m.label}</Text>
                <Text style={s.moveSub}>{m.sub}</Text>
              </View>
              <Text style={[s.moveAmt, { color: credit ? GREEN : RED }]}>
                {credit ? "+" : "−"}{Math.abs(m.amount)} {t("mad")}
              </Text>
            </View>
          );
        })
      )}
      <View style={{ height: 20 }} />

      {/* Jump to any month. Reuses the picker the missions calendar opens — the
          day tapped selects that day's MONTH, since a wallet is read by month. */}
      <MonthCalendarModal
        visible={calendarOpen}
        initialDate={monthFilter ?? new Date()}
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => {
          setMonthFilter(startOfMonth(d));
          setCalendarOpen(false);
        }}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  loadingRoot: { flex: 1, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingTop: 52 },
  title: { fontSize: 26, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular", marginBottom: 14 },

  wallet: { borderRadius: 22, padding: 20, overflow: "hidden" },
  walletBlob: { position: "absolute", top: -30, right: -25, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.07)" },
  walletTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  walletLbl: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
  walletVal: { color: "#FFF", fontSize: 38, fontWeight: "800", marginTop: 6, marginBottom: 16 },
  walletUnit: { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  walletRow: { flexDirection: "row", gap: 10 },
  walletBox: { flex: 1, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.1)", padding: 12, justifyContent: "center", minHeight: 62 },
  walletBoxLbl: { color: "rgba(255,255,255,0.6)", fontSize: 11 },
  walletBoxVal: { color: "#FFF", fontSize: 16, fontWeight: "800", marginTop: 3 },
  walletAction: { backgroundColor: "#FFF" },
  walletActionLbl: { color: Colors.textMuted, fontSize: 11 },
  walletActionRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  walletActionTxt: { color: NAVY, fontSize: 16, fontWeight: "800" },

  bankRow: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white",
    borderRadius: 16, padding: 14, marginTop: 14,
    shadowColor: NAVY, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  bankIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#E7E4FA", alignItems: "center", justifyContent: "center" },
  bankIconWarn: { backgroundColor: "#FEF3C7" },
  bankTitle: { fontSize: 14, fontWeight: "800", color: Colors.textPrimary },
  bankSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  bankSubWarn: { color: "#B45309" },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, padding: 13 },
  statVal: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800", marginTop: 6 },
  statLbl: { color: Colors.textMuted, fontSize: 11.5, marginTop: 2 },

  sectionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", marginTop: 20, marginBottom: 10 },

  // Period navigator. Same card language as the rest of the screen — white
  // surface, existing border and navy accent; nothing new introduced.
  periodBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 6, marginBottom: 8,
  },
  periodArrow: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  periodArrowOff: { opacity: 0.35 },
  periodLabelBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    height: 34, borderRadius: 10, backgroundColor: Colors.background,
  },
  periodLabel: {
    color: Colors.textPrimary, fontSize: 13.5, fontWeight: "800",
    textTransform: "capitalize", flexShrink: 1,
  },
  periodSummary: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, paddingHorizontal: 2 },
  periodCount: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  periodNet: { fontSize: 13.5, fontWeight: "800" },
  periodAll: { color: NAVY, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  emptyCard: { backgroundColor: "#FFF", borderRadius: 16, padding: 20, alignItems: "center", gap: 4 },
  emptyTxt: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  emptySub: { color: Colors.textMuted, fontSize: 12.5 },

  moveRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFF", borderRadius: 16, padding: 13, marginBottom: 8 },
  moveIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  moveIconCredit: { backgroundColor: CREAM },
  moveIconDebit: { backgroundColor: "#F1F1F4" },
  moveLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  moveSub: { color: Colors.textMuted, fontSize: 11.5, marginTop: 1 },
  moveAmt: { fontSize: 14.5, fontWeight: "800" },
});
