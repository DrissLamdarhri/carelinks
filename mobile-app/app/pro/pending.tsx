/**
 * Pro "application under review" gate screen.
 *
 * Shown to any professional whose verification_status is not yet 'approved'.
 * The real access gate lives in app/pro/_layout.tsx — this is the screen it
 * redirects to. It live-tracks the verification status (realtime, via the
 * layout) and lets the pro re-submit documents, refresh, contact support or
 * sign out. On approval the layout guard automatically sends them to /pro.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { CheckCircle2, Clock, FileWarning, LogOut, MessageCircle, RefreshCw, Upload } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { supabase } from "@/lib/supabase";

const NAVY = "#0D0870";
const SUPPORT_EMAIL = "support@carelink.ma";
const SUPPORT_WHATSAPP = "212600000000"; // TODO: replace with the real support number

type Status = "pending" | "rejected" | "approved" | null;

export default function ProPendingScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const pro = await db.pros.get(user.id).catch(() => null);
      setStatus((pro?.verification_status as Status) ?? "pending");
      setReason(pro?.rejection_reason ?? null);
      const { count } = await supabase
        .from("pro_documents")
        .select("id", { count: "exact", head: true })
        .eq("professional_id", user.id);
      setDocCount(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Live-refresh if the admin approves/rejects while this screen is open.
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`pending-verif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "professionals", filter: `id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, load]);

  const rejected = status === "rejected";

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.iconHalo, rejected && styles.iconHaloWarn]}>
          {loading ? (
            <ActivityIndicator color={NAVY} />
          ) : rejected ? (
            <FileWarning size={40} color="#B45309" strokeWidth={1.6} />
          ) : (
            <Clock size={40} color={NAVY} strokeWidth={1.6} />
          )}
        </View>

        <Text style={styles.title}>{rejected ? t("kyc_rejected_title") : t("kyc_review_title")}</Text>
        <Text style={styles.subtitle}>
          {rejected ? reason || t("kyc_rejected_sub") : t("kyc_review_sub")}
        </Text>

        {/* Progress checklist */}
        <View style={styles.card}>
          <Row done label={t("kyc_step_account")} />
          <Row done={docCount > 0} label={`${t("kyc_step_documents")}${docCount > 0 ? ` (${docCount})` : ""}`} />
          <Row done={false} pending={!rejected} warn={rejected} label={t("kyc_step_review")} last />
        </View>

        {/* Actions */}
        {rejected ? (
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={() => router.push("/pro/documents")}>
            <Upload size={17} color="white" />
            <Text style={styles.primaryTxt}>{t("kyc_resubmit")}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={() => void load()}>
            <RefreshCw size={17} color="white" />
            <Text style={styles.primaryTxt}>{t("kyc_check_status")}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.ghostBtn}
          activeOpacity={0.8}
          onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`).catch(() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`))}
        >
          <MessageCircle size={16} color={NAVY} />
          <Text style={styles.ghostTxt}>{t("contact_support")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOut} activeOpacity={0.7} onPress={() => void signOut()}>
          <LogOut size={15} color={Colors.textMuted} />
          <Text style={styles.signOutTxt}>{t("sign_out")}</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>{t("kyc_review_hint")}</Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, done, pending, warn, last }: { label: string; done?: boolean; pending?: boolean; warn?: boolean; last?: boolean }) {
  return (
    <View style={[styles.stepRow, !last && styles.stepRowBorder]}>
      <View
        style={[
          styles.stepDot,
          done && styles.stepDotDone,
          pending && styles.stepDotPending,
          warn && styles.stepDotWarn,
        ]}
      >
        {done ? <CheckCircle2 size={16} color="white" /> : null}
      </View>
      <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { paddingTop: 90, paddingHorizontal: 24, paddingBottom: 40, alignItems: "center" },
  iconHalo: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: "#E7E4FA",
    alignItems: "center", justifyContent: "center", marginBottom: 22,
  },
  iconHaloWarn: { backgroundColor: "#FEF3C7" },
  title: { fontSize: 24, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular", textAlign: "center" },
  subtitle: { fontSize: 14, color: Colors.textMuted, textAlign: "center", marginTop: 8, lineHeight: 21, paddingHorizontal: 6 },
  card: {
    width: "100%", backgroundColor: "white", borderRadius: 20, paddingHorizontal: 18, marginTop: 26,
    shadowColor: NAVY, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15 },
  stepRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F2F1F6" },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#E3E2EA", alignItems: "center", justifyContent: "center" },
  stepDotDone: { backgroundColor: "#16A34A" },
  stepDotPending: { backgroundColor: NAVY },
  stepDotWarn: { backgroundColor: "#B45309" },
  stepLabel: { flex: 1, fontSize: 14.5, color: Colors.textMuted, fontWeight: "600" },
  stepLabelDone: { color: Colors.textPrimary },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
    backgroundColor: NAVY, borderRadius: 15, height: 54, width: "100%", marginTop: 26,
  },
  primaryTxt: { color: "white", fontSize: 15.5, fontWeight: "700" },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 15, height: 50, width: "100%", marginTop: 12, backgroundColor: "white",
    borderWidth: 1, borderColor: "#E7E4FA",
  },
  ghostTxt: { color: NAVY, fontSize: 14.5, fontWeight: "700" },
  signOut: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 22, padding: 8 },
  signOutTxt: { color: Colors.textMuted, fontSize: 13.5, fontWeight: "600" },
  hint: { fontSize: 12, color: Colors.textSubtle, textAlign: "center", marginTop: 18, lineHeight: 18, paddingHorizontal: 10 },
});
