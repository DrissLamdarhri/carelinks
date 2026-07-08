import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ShieldCheck, Smartphone, KeyRound } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { useMfa } from "@/lib/hooks/useMfa";

type ChallengeMode = "totp" | "backup" | "sms";

function CodeInput({
  value,
  onChange,
  length = 6,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
}) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.split("");

  return (
    <TouchableOpacity
      style={styles.codeRow}
      onPress={() => inputRef.current?.focus()}
      activeOpacity={0.9}
    >
      {Array.from({ length }).map((_, index) => (
        <View key={index} style={[styles.codeCell, digits[index] ? styles.codeCellFilled : null]}>
          <Text style={styles.codeCellText}>{digits[index] ?? ""}</Text>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        autoFocus
        style={styles.hiddenInput}
      />
    </TouchableOpacity>
  );
}

export default function MfaChallengeScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile, verifyMfaTotp, challengeMfaSms, verifyMfaSms } = useAuth();
  const { listTotpFactors, verifyBackupCode } = useMfa(user?.id);

  const [mode, setMode] = useState<ChallengeMode>("totp");
  const [totpAvailable, setTotpAvailable] = useState(false);
  const [code, setCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [smsAttempts, setSmsAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const smsAvailable = process.env.EXPO_PUBLIC_ENABLE_SMS_MFA === "true";
  const canSendSms = smsAvailable && Boolean(profile?.phone);

  useEffect(() => {
    let mounted = true;
    const loadFactors = async () => {
      try {
        const factors = await listTotpFactors();
        if (!mounted) return;
        const hasTotp = factors.some((factor) => factor.status === "verified");
        setTotpAvailable(hasTotp);
        if (hasTotp) {
          setMode("totp");
        } else if (smsAvailable) {
          setMode("sms");
        } else {
          setMode("totp");
          setErrorMessage(t("sms_disabled_desc"));
        }
      } catch (error) {
        if (!mounted) return;
        setErrorMessage(error instanceof Error ? error.message : t("cannot_load_mfa"));
        setMode(profile?.mfaMethod === "sms" && smsAvailable ? "sms" : "totp");
      }
    };
    void loadFactors();
    return () => {
      mounted = false;
    };
  }, [listTotpFactors, profile?.mfaMethod, smsAvailable]);

  useEffect(() => {
    if (mode !== "sms" || smsSent || !canSendSms) return;
    const send = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        await challengeMfaSms(profile?.phone ?? "");
        setSmsSent(true);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : t("sms_send_failed"));
      } finally {
        setLoading(false);
      }
    };
    void send();
  }, [mode, smsSent, canSendSms, challengeMfaSms, profile?.phone]);

  const resolvedRole = useMemo(() => {
    if (profile?.role) return profile.role;
    const paramRole = typeof params.role === "string" ? params.role : null;
    if (paramRole === "pro" || paramRole === "admin" || paramRole === "patient") return paramRole;
    return "patient";
  }, [params.role, profile?.role]);

  const finishLogin = () => {
    if (resolvedRole === "admin") {
      router.replace("/admin");
    } else if (resolvedRole === "pro") {
      router.replace("/pro");
    } else {
      router.replace("/patient");
    }
  };

  const handleVerify = async () => {
    if (loading) return;
    if (mode === "sms" && smsAttempts >= 5) return;
    setErrorMessage(null);
    setLoading(true);
    try {
      if (mode === "totp") {
        await verifyMfaTotp(code);
        finishLogin();
        return;
      }
      if (mode === "backup") {
        const ok = await verifyBackupCode(code);
        if (!ok) {
          setErrorMessage(t("invalid_backup_code"));
        } else {
          finishLogin();
        }
        return;
      }
      if (!profile?.phone) {
        setErrorMessage(t("missing_phone"));
        return;
      }
      await verifyMfaSms(profile.phone, code);
      finishLogin();
    } catch (error) {
      if (mode === "sms") setSmsAttempts((prev) => prev + 1);
      setErrorMessage(error instanceof Error ? error.message : t("invalid_code"));
    } finally {
      setLoading(false);
    }
  };

  const handleResendSms = async () => {
    if (!profile?.phone || loading) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      await challengeMfaSms(profile.phone);
      setSmsSent(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("sms_send_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            {mode === "sms" ? (
              <Smartphone size={22} color={Colors.primary} />
            ) : mode === "backup" ? (
              <KeyRound size={22} color={Colors.primary} />
            ) : (
              <ShieldCheck size={22} color={Colors.primary} />
            )}
          </View>
          <Text style={styles.title}>{t("security_verification")}</Text>
          <Text style={styles.subtitle}>
            {mode === "sms"
              ? t("confirm_identity_sms")
              : mode === "backup"
              ? "Saisissez un code de secours à usage unique."
              : "Saisissez le code de votre application d'authentification."}
          </Text>
        </View>

        {mode === "sms" && !canSendSms ? (
          <View style={styles.alertCard}>
            <Text style={styles.alertText}>{t("no_number_for_sms")}</Text>
          </View>
        ) : null}

        {mode === "backup" ? (
          <TextInput
            value={code}
            onChangeText={(text) => setCode(text.replace(/\s+/g, "").toUpperCase())}
            placeholder="XXXX-XXXX"
            autoCapitalize="characters"
            style={styles.backupInput}
            placeholderTextColor={Colors.textSubtle}
          />
        ) : (
          <CodeInput value={code} onChange={setCode} />
        )}

        {mode === "sms" ? (
          <View style={styles.smsRow}>
            <Text style={styles.smsHint}>
              {smsSent ? "Code SMS envoyé." : "Envoi du code en cours…"}
            </Text>
            <TouchableOpacity disabled={loading} onPress={handleResendSms}>
              <Text style={styles.smsResend}>{t("resend")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {mode === "sms" && smsAttempts > 0 ? (
          <Text style={styles.attemptsText}>Tentatives restantes: {Math.max(0, 5 - smsAttempts)}</Text>
        ) : null}

        <TouchableOpacity
          disabled={loading || code.trim().length === 0 || (mode === "sms" && smsAttempts >= 5)}
          onPress={handleVerify}
          style={[
            styles.submit,
            (loading || code.trim().length === 0 || (mode === "sms" && smsAttempts >= 5)) && styles.submitDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.submitText}>{t("verify")}</Text>
          )}
        </TouchableOpacity>

        {totpAvailable && mode !== "backup" ? (
          <TouchableOpacity onPress={() => setMode("backup")} style={styles.altButton}>
            <Text style={styles.altText}>{t("use_backup_code")}</Text>
          </TouchableOpacity>
        ) : null}

        {totpAvailable && mode === "backup" ? (
          <TouchableOpacity onPress={() => setMode("totp")} style={styles.altButton}>
            <Text style={styles.altText}>{t("use_authenticator")}</Text>
          </TouchableOpacity>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 28 },
  header: { alignItems: "center", marginBottom: 20 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 6,
  },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "center" },
  codeRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginVertical: 12 },
  codeCell: {
    width: 44,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.input,
  },
  codeCellFilled: {
    borderColor: Colors.primary,
    backgroundColor: "white",
  },
  codeCellText: { fontSize: 18, color: Colors.textPrimary, fontWeight: "600" },
  hiddenInput: { position: "absolute", opacity: 0 },
  backupInput: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    textAlign: "center",
    letterSpacing: 2,
    backgroundColor: Colors.input,
  },
  smsRow: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smsHint: { fontSize: 12, color: Colors.textMuted },
  smsResend: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  attemptsText: { marginTop: 6, fontSize: 11, color: Colors.textMuted },
  submit: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { backgroundColor: "#D9D9D9" },
  submitText: { color: "white", fontSize: 15, fontWeight: "600", fontFamily: "DMSans_500Medium" },
  altButton: { marginTop: 12, alignItems: "center" },
  altText: { color: Colors.primary, fontSize: 13, fontWeight: "600" },
  errorText: { marginTop: 10, color: Colors.danger, fontSize: 12, textAlign: "center" },
  alertCard: { marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: "#FDECEC" },
  alertText: { color: Colors.danger, fontSize: 12, textAlign: "center" },
});
