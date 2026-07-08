/**
 * Password reset landing — opened by the Supabase recovery email link
 * (ma.carelink.app://auth/reset-password?code=...). Exchanges the code for a
 * recovery session, then lets the user set a new password.
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { showToast } from "@/lib/toast";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";

export default function ResetPasswordScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        const raw = parsed.queryParams?.code;
        const code = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (!exErr && active) setReady(true);
        }
      } catch {
        /* ignore */
      }
    };
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && active) setReady(true);
      await handleUrl(await Linking.getInitialURL());
      if (active) setChecking(false);
    })();
    const sub = Linking.addEventListener("url", ({ url }) => void handleUrl(url));
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const valid = password.length >= 6 && password === confirm;

  const submit = async () => {
    if (!valid || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await updatePassword(password);
      showToast(t("password_updated"));
      router.replace("/auth");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("cannot_update_password"));
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={s.center}>
        <Text style={s.title}>{t("invalid_link")}</Text>
        <Text style={s.sub}>{t("request_new_link")}</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace("/auth")}>
          <Text style={s.primaryTxt}>{t("back_to_login")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <View style={s.iconWrap}>
        <Lock size={26} color={Colors.primary} />
      </View>
      <Text style={s.title}>{t("new_password")}</Text>
      <Text style={s.sub}>{t("password_min_6")}</Text>

      <View style={s.field}>
        <Lock size={18} color={Colors.textMuted} />
        <TextInput
          style={s.input}
          placeholder={t("new_password")}
          placeholderTextColor={Colors.textSubtle}
          secureTextEntry={!show}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={() => setShow((v) => !v)}>
          {show ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
        </TouchableOpacity>
      </View>

      <View style={s.field}>
        <CheckCircle2 size={18} color={confirm && password === confirm ? "#16A34A" : Colors.textMuted} />
        <TextInput
          style={s.input}
          placeholder={t("confirm_password_ph")}
          placeholderTextColor={Colors.textSubtle}
          secureTextEntry={!show}
          value={confirm}
          onChangeText={setConfirm}
        />
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity style={[s.primaryBtn, !valid && { opacity: 0.5 }]} disabled={!valid || submitting} onPress={submit}>
        {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryTxt}>{t("update_action")}</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 24, paddingTop: 90 },
  center: { flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 30, gap: 10 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surfaceWarm,
    alignItems: "center", justifyContent: "center", marginBottom: 18,
  },
  title: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary, marginBottom: 6, textAlign: "center" },
  sub: { fontSize: 13, color: Colors.textMuted, marginBottom: 24, textAlign: "center", lineHeight: 19 },
  field: {
    flexDirection: "row", alignItems: "center", gap: 10,
    height: 52, borderRadius: 14, backgroundColor: Colors.input,
    paddingHorizontal: 14, marginBottom: 12,
  },
  input: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  error: { color: Colors.danger, fontSize: 13, marginBottom: 10 },
  primaryBtn: {
    height: 52, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  primaryTxt: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
