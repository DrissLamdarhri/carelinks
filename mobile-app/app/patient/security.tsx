/**
 * CareLink — account security: change your password.
 *
 * Reachable from Profil → Sécurité. Distinct from `auth/reset-password.tsx`,
 * which is the signed-OUT flow reached from an emailed link: that one proves
 * identity through the inbox, this one proves it through the current password.
 *
 * The current password is required even though Supabase does not ask for it.
 * Without that check, anyone holding an unlocked phone could change the
 * password and lock the real patient out of their own medical bookings — the
 * phone becomes the only credential. Asking for it costs one field.
 */
import { useState } from "react";
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
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { toastError, toastSuccess } from "@/lib/toast";
import { resetAcceptanceForTesting } from "@/lib/terms";

export default function SecurityScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { updatePassword, verifyCurrentPassword } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirm.length > 0 && next === confirm;
  const valid = current.length > 0 && next.length >= 6 && matches;

  const submit = async () => {
    if (!valid || submitting) return;
    setError(null);

    // Cheap client-side checks first, so the user is not made to wait on a
    // round-trip to be told the two fields disagree.
    if (next !== confirm) { setError(t("passwords_dont_match")); return; }
    if (next === current) { setError(t("password_same_as_old")); return; }

    setSubmitting(true);
    try {
      if (!(await verifyCurrentPassword(current))) {
        setError(t("current_password_wrong"));
        return;
      }
      await updatePassword(next);
      toastSuccess(t("password_changed"));
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("cmp_signup_server_error");
      setError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} accessibilityRole="button">
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("account_security")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.iconWrap}>
          <ShieldCheck size={26} color={Colors.primary} />
        </View>
        <Text style={s.title}>{t("change_password")}</Text>
        <Text style={s.sub}>{t("change_password_sub")}</Text>

        <Text style={s.label}>{t("current_password")}</Text>
        <View style={s.field}>
          <Lock size={18} color={Colors.textMuted} />
          <TextInput
            style={s.input}
            placeholder={t("current_password")}
            placeholderTextColor={Colors.textSubtle}
            secureTextEntry={!show}
            value={current}
            onChangeText={setCurrent}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShow((v) => !v)} accessibilityRole="button">
            {show ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
          </TouchableOpacity>
        </View>

        <Text style={s.label}>{t("new_password")}</Text>
        <View style={s.field}>
          <Lock size={18} color={Colors.textMuted} />
          <TextInput
            style={s.input}
            placeholder={t("password_min_6")}
            placeholderTextColor={Colors.textSubtle}
            secureTextEntry={!show}
            value={next}
            onChangeText={setNext}
            autoCapitalize="none"
          />
        </View>

        <Text style={s.label}>{t("confirm_new_password")}</Text>
        <View style={s.field}>
          <CheckCircle2 size={18} color={matches ? "#16A34A" : Colors.textMuted} />
          <TextInput
            style={s.input}
            placeholder={t("confirm_new_password")}
            placeholderTextColor={Colors.textSubtle}
            secureTextEntry={!show}
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
          />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {__DEV__ ? (
          <TouchableOpacity
            style={s.devBtn}
            activeOpacity={0.8}
            onPress={async () => {
              await resetAcceptanceForTesting();
              toastSuccess("Terms reset — restart the app to see the gate");
            }}
          >
            <Text style={s.devTxt}>DEV · show terms gate again</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[s.primaryBtn, (!valid || submitting) && { opacity: 0.5 }]}
          disabled={!valid || submitting}
          onPress={submit}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={s.primaryTxt}>{t("change_password")}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingTop: 54, paddingHorizontal: 18, paddingBottom: 12,
  },
  back: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceWarm,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary },
  body: { paddingHorizontal: 24, paddingBottom: 40 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surfaceWarm,
    alignItems: "center", justifyContent: "center", marginTop: 10, marginBottom: 18,
  },
  title: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary, marginBottom: 6 },
  sub: { fontSize: 13, color: Colors.textMuted, marginBottom: 22, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.textPrimary, marginBottom: 8 },
  field: {
    flexDirection: "row", alignItems: "center", gap: 10,
    height: 52, borderRadius: 14, backgroundColor: Colors.input,
    paddingHorizontal: 14, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  error: { color: "#DC2626", fontSize: 13, marginBottom: 14, lineHeight: 18 },
  primaryBtn: {
    height: 54, borderRadius: 16, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", marginTop: 6,
  },
  primaryTxt: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  // Stripped from production bundles by the __DEV__ guard at the call site.
  devBtn: {
    marginBottom: 14, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: "#CBD5E1", alignItems: "center",
  },
  devTxt: { fontSize: 12, fontWeight: "700", color: "#64748B" },
});
