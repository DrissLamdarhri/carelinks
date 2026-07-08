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
import { LinearGradient } from "expo-linear-gradient";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Wallet } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { showToast } from "@/lib/toast";
import { useAuth } from "@/lib/auth-context";
import { db, type Payment, type Payout } from "@/lib/db/dal";

const NAVY = "#0D0870";
const CREAM = "#EDE5CC";
const COMMISSION_PCT = 20;
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
  const { t } = useI18n();
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const reload = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const [pays, pos] = await Promise.all([
        db.payments.listForPro(user.id).catch(() => [] as Payment[]),
        db.payouts.listForPro(user.id).catch(() => [] as Payout[]),
      ]);
      setPayments(pays);
      setPayouts(pos);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Wallet math (real captured money, net of commission, minus withdrawals) ──
  const netOf = (p: Payment) => Number(p.amount_mad) - Number(p.commission_mad);
  const captured = useMemo(() => payments.filter((p) => p.status === "captured"), [payments]);
  const earned = captured.reduce((s, p) => s + netOf(p), 0);
  const pendingNet = payments.filter((p) => p.status === "authorized").reduce((s, p) => s + netOf(p), 0);
  const activePayouts = payouts.filter((p) => p.status !== "rejected");
  const withdrawn = activePayouts.reduce((s, p) => s + Number(p.amount_mad), 0);
  const available = Math.max(0, earned - withdrawn);

  const movements: Move[] = useMemo(() => {
    const list: Move[] = [];
    for (const p of captured) {
      list.push({ id: `${p.id}-p`, kind: "prestation", label: t("home_service"), sub: fmtDate(p.created_at), amount: Number(p.amount_mad), date: p.created_at });
      list.push({ id: `${p.id}-c`, kind: "commission", label: `Commission CareLink (${COMMISSION_PCT}%)`, sub: `sur ${p.amount_mad} MAD`, amount: -Number(p.commission_mad), date: p.created_at });
    }
    for (const po of activePayouts) {
      list.push({ id: po.id, kind: "payout", label: t("withdrawal"), sub: payoutLabel(po.status, t), amount: -Number(po.amount_mad), date: po.created_at });
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [captured, activePayouts]);

  const requestPayout = () => {
    if (!user?.id || requesting) return;
    if (available < 50) { showToast("Minimum 50 MAD pour un retrait."); return; }
    Alert.alert("Demander un retrait", `Retirer ${available} MAD vers votre compte bancaire ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Confirmer",
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
        <Text style={s.walletVal}>{available.toLocaleString("fr-MA")} <Text style={s.walletUnit}>MAD</Text></Text>
        <View style={s.walletRow}>
          <View style={s.walletBox}>
            <Text style={s.walletBoxLbl}>{t("pending_capture")}</Text>
            <Text style={s.walletBoxVal}>{pendingNet} MAD</Text>
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

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <CheckCircle2 size={17} color={NAVY} />
          <Text style={s.statVal}>{captured.length}</Text>
          <Text style={s.statLbl}>{t("paid_services")}</Text>
        </View>
        <View style={s.statCard}>
          <ArrowUpRight size={17} color={GREEN} />
          <Text style={s.statVal}>{earned} MAD</Text>
          <Text style={s.statLbl}>{t("total_earned_net")}</Text>
        </View>
      </View>

      {/* Movements */}
      <Text style={s.sectionTitle}>{t("wallet_movements")}</Text>
      {movements.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyTxt}>{t("no_movements")}</Text>
          <Text style={s.emptySub}>{t("paid_services_hint")}</Text>
        </View>
      ) : (
        movements.map((m) => {
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
                {credit ? "+" : "−"}{Math.abs(m.amount)} MAD
              </Text>
            </View>
          );
        })
      )}
      <View style={{ height: 20 }} />
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

  statsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, padding: 13 },
  statVal: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800", marginTop: 6 },
  statLbl: { color: Colors.textMuted, fontSize: 11.5, marginTop: 2 },

  sectionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", marginTop: 20, marginBottom: 10 },
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
