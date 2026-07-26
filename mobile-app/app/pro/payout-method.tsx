/**
 * Pro bank details (RIB) — where withdrawals are actually sent.
 *
 * Without this the payout flow is unpayable: a pro taps "Retirer", an admin
 * sees the request, and has no account number to transfer to. Migration 0032
 * enforces it server-side too — requesting a payout with no RIB on file is
 * rejected by a trigger, so this screen is the only way to unblock "Retirer".
 *
 * Note this has nothing to do with CMI: CMI takes card payments IN; paying a
 * pro is a bank transfer OUT.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, BadgeCheck, Landmark, Lock } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { showToast } from "@/lib/toast";

const NAVY = "#0D0870";

// Moroccan banks — the common ones, so the pro picks instead of mistyping.
const BANKS = [
  "Attijariwafa Bank",
  "Banque Populaire",
  "BMCE Bank of Africa",
  "BMCI",
  "Société Générale Maroc",
  "Crédit du Maroc",
  "CIH Bank",
  "Al Barid Bank",
  "Crédit Agricole du Maroc",
  "Bank Al Yousr",
];

/** Display helper: 007 780 0001234567890123 45 */
const formatRib = (digits: string) => {
  const d = digits.replace(/\D/g, "").slice(0, 24);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 22), d.slice(22, 24)].filter(Boolean);
  return parts.join(" ");
};

export default function PayoutMethodScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();

  const [holder, setHolder] = useState("");
  const [bank, setBank] = useState("");
  const [rib, setRib] = useState(""); // digits only
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const m = await db.payoutMethods.get(user.id).catch(() => null);
      if (m) {
        setHolder(m.holder_name);
        setBank(m.bank_name);
        setRib(m.rib);
        setExisting(true);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const ribValid = useMemo(() => rib.replace(/\D/g, "").length === 24, [rib]);
  const canSave = holder.trim().length > 2 && bank.trim().length > 1 && ribValid && !saving;

  const save = useCallback(async () => {
    if (!canSave || !user?.id) return;
    setSaving(true);
    try {
      await db.payoutMethods.save({
        professional_id: user.id,
        holder_name: holder.trim(),
        bank_name: bank.trim(),
        rib: rib.replace(/\D/g, ""),
      });
      showToast(t("payout_method_saved"));
      router.back();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("action_failed"));
    } finally {
      setSaving(false);
    }
  }, [canSave, user?.id, holder, bank, rib, router, t]);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("bank_details")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroIcon}>
          <Landmark size={30} color={NAVY} strokeWidth={1.6} />
        </View>
        <Text style={styles.title}>{existing ? t("bank_details_edit") : t("bank_details_add")}</Text>
        <Text style={styles.subtitle}>{t("bank_details_why")}</Text>

        {existing ? (
          <View style={styles.okBox}>
            <BadgeCheck size={16} color="#16A34A" />
            <Text style={styles.okTxt}>{t("bank_details_on_file")}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>{t("account_holder")}</Text>
        <TextInput
          value={holder}
          onChangeText={setHolder}
          placeholder={t("account_holder_ph")}
          placeholderTextColor={Colors.textSubtle}
          style={styles.input}
          autoCapitalize="words"
        />
        <Text style={styles.hint}>{t("account_holder_hint")}</Text>

        <Text style={styles.label}>{t("bank")}</Text>
        <TextInput
          value={bank}
          onChangeText={setBank}
          placeholder={t("bank_ph")}
          placeholderTextColor={Colors.textSubtle}
          style={styles.input}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {BANKS.map((b) => (
            <TouchableOpacity
              key={b}
              onPress={() => setBank(b)}
              style={[styles.chip, bank === b && styles.chipActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipTxt, bank === b && styles.chipTxtActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>{t("rib")}</Text>
        <TextInput
          value={formatRib(rib)}
          onChangeText={(v) => setRib(v.replace(/\D/g, "").slice(0, 24))}
          placeholder="007 780 0001234567890123 45"
          placeholderTextColor={Colors.textSubtle}
          style={[styles.input, styles.ribInput, rib.length > 0 && !ribValid && styles.inputError]}
          keyboardType="number-pad"
          maxLength={30} // formatted length (24 digits + 3 spaces)
        />
        <Text style={rib.length > 0 && !ribValid ? styles.errorHint : styles.hint}>
          {`${rib.replace(/\D/g, "").length}/24 ${t("digits")} · ${t("rib_hint")}`}
        </Text>

        <View style={styles.privacyBox}>
          <Lock size={15} color={Colors.textMuted} />
          <Text style={styles.privacyTxt}>{t("rib_privacy_note")}</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveDisabled]}
          activeOpacity={0.9}
          disabled={!canSave}
          onPress={() => void save()}
        >
          {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveTxt}>{t("save")}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15.5, fontWeight: "800", color: Colors.textPrimary },
  content: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 44 },
  heroIcon: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: "#E7E4FA",
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14,
  },
  title: { fontSize: 21, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular", textAlign: "center" },
  subtitle: { fontSize: 13.5, color: Colors.textMuted, textAlign: "center", marginTop: 8, lineHeight: 20 },
  okBox: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#DCFCE7",
    borderRadius: 12, padding: 12, marginTop: 18,
  },
  okTxt: { flex: 1, color: "#15803D", fontSize: 12.5, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "700", color: Colors.textPrimary, marginTop: 22, marginBottom: 8 },
  input: {
    backgroundColor: "white", borderRadius: 14, height: 52, paddingHorizontal: 16,
    fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: "#EDEBF5",
  },
  ribInput: { letterSpacing: 1, fontVariant: ["tabular-nums"] },
  inputError: { borderColor: "#DC2626" },
  hint: { fontSize: 11.5, color: Colors.textSubtle, marginTop: 6 },
  errorHint: { fontSize: 11.5, color: "#DC2626", marginTop: 6 },
  chipRow: { gap: 8, paddingTop: 10, paddingRight: 8 },
  chip: { backgroundColor: "white", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: "#EDEBF5" },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipTxt: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  chipTxtActive: { color: "white" },
  privacyBox: {
    flexDirection: "row", gap: 9, alignItems: "flex-start",
    backgroundColor: "#F4F3F8", borderRadius: 14, padding: 14, marginTop: 22,
  },
  privacyTxt: { flex: 1, color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  saveBtn: {
    backgroundColor: NAVY, borderRadius: 15, height: 54,
    alignItems: "center", justifyContent: "center", marginTop: 24,
  },
  saveDisabled: { opacity: 0.45 },
  saveTxt: { color: "white", fontSize: 15.5, fontWeight: "700" },
});
