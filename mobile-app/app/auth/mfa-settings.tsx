import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, ShieldCheck, Smartphone } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { useMfa } from "@/lib/hooks/useMfa";
import { supabase } from "@/lib/supabase";

export default function MfaSettingsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, profile, refreshProfile, challengeMfaSms, verifyMfaSms } = useAuth();
  const { listTotpFactors, unenrollFactor, clearBackupCodes } = useMfa(user?.id);

  const [loading, setLoading] = useState(false);
  const [checkingFactors, setCheckingFactors] = useState(true);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [smsSent, setSmsSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [smsLoading, setSmsLoading] = useState(false);
  const smsAvailable = process.env.EXPO_PUBLIC_ENABLE_SMS_MFA === "true";

  useEffect(() => {
    let mounted = true;
    const loadFactors = async () => {
      setCheckingFactors(true);
      try {
        const factors = await listTotpFactors();
        const verified = factors.find((factor) => factor.status === "verified");
        if (mounted) setTotpFactorId(verified?.id ?? null);
      } catch (error) {
        if (mounted) setErrorMessage(error instanceof Error ? error.message : "MFA indisponible.");
      } finally {
        if (mounted) setCheckingFactors(false);
      }
    };
    void loadFactors();
    return () => {
      mounted = false;
    };
  }, [listTotpFactors]);

  const updateProfileMfa = async (enabled: boolean, method: "totp" | "sms" | null) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ mfa_enabled: enabled, mfa_method: method })
      .eq("id", user.id);
    if (error) throw error;
    await refreshProfile();
  };

  const handleDisableTotp = async () => {
    if (!totpFactorId || !user?.id) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      await unenrollFactor(totpFactorId);
      await clearBackupCodes();
      await updateProfileMfa(false, null);
      setTotpFactorId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("cannot_disable_mfa"));
    } finally {
      setLoading(false);
    }
  };

  const handleSmsEnroll = async () => {
    if (!profile?.phone || smsLoading) return;
    setSmsLoading(true);
    setErrorMessage(null);
    try {
      await challengeMfaSms(profile.phone);
      setSmsSent(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("sms_send_failed"));
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSmsVerify = async () => {
    if (!profile?.phone || smsLoading || smsCode.trim().length !== 6) return;
    setSmsLoading(true);
    setErrorMessage(null);
    try {
      await verifyMfaSms(profile.phone, smsCode);
      await updateProfileMfa(true, "sms");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("invalid_sms_code"));
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSmsDisable = async () => {
    setSmsLoading(true);
    setErrorMessage(null);
    try {
      await updateProfileMfa(false, null);
      setSmsSent(false);
      setSmsCode("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("cannot_disable_sms"));
    } finally {
      setSmsLoading(false);
    }
  };

  const smsEnabled = smsAvailable && profile?.mfaMethod === "sms";
  const totpEnabled = Boolean(totpFactorId);
  const showSmsCard = !totpEnabled && !checkingFactors;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>{t("security")}</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShieldCheck size={18} color={Colors.primary} />
            <Text style={styles.cardTitle}>{t("authenticator")}</Text>
            {checkingFactors ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
          </View>
          <Text style={styles.cardBody}>
            {checkingFactors
              ? t("checking_mfa")
              : totpEnabled
                ? t("mfa_on_desc")
                : t("mfa_off_desc")}
          </Text>
          {totpEnabled ? (
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={handleDisableTotp}
              disabled={loading || checkingFactors}
            >
              <Text style={styles.dangerText}>{t("disable")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push({ pathname: "/auth/mfa-setup" })}
              disabled={loading || checkingFactors}
            >
              <Text style={styles.primaryText}>{t("configure")}</Text>
            </TouchableOpacity>
          )}
        </View>

        {showSmsCard ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Smartphone size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>{t("sms_backup_code")}</Text>
            </View>
            {smsAvailable ? (
              <>
                <Text style={styles.cardBody}>
                  {smsEnabled
                    ? "Activé : un SMS peut être demandé si aucun TOTP n'est configuré."
                    : "Activez un SMS de secours si vous ne configurez pas de TOTP."}
                </Text>
                {!profile?.phone ? (
                  <Text style={styles.cardHint}>{t("phone_missing_profile")}</Text>
                ) : null}
                {smsEnabled ? (
                  <TouchableOpacity style={styles.dangerBtn} onPress={handleSmsDisable} disabled={smsLoading}>
                    {smsLoading ? (
                      <ActivityIndicator size="small" color={Colors.danger} />
                    ) : (
                      <Text style={styles.dangerText}>{t("disable")}</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={handleSmsEnroll}
                      disabled={smsLoading || !profile?.phone}
                    >
                      {smsLoading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.primaryText}>{t("enable_sms")}</Text>
                      )}
                    </TouchableOpacity>
                    {smsSent ? (
                      <View style={styles.smsVerifyRow}>
                        <TextInput
                          value={smsCode}
                          onChangeText={(text) => setSmsCode(text.replace(/\D/g, "").slice(0, 6))}
                          keyboardType="number-pad"
                          placeholder={t("six_digit_code")}
                          placeholderTextColor={Colors.textSubtle}
                          style={styles.smsInput}
                        />
                        <TouchableOpacity
                          style={styles.secondaryBtn}
                          onPress={handleSmsVerify}
                          disabled={smsLoading || smsCode.length !== 6}
                        >
                          <Text style={styles.secondaryText}>{t("validate")}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <Text style={styles.cardHint}>
                Le SMS nécessite un fournisseur payant (Twilio). Utilisez plutôt l’application
                d’authentification (TOTP).
              </Text>
            )}
          </View>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceWarm },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 14, color: Colors.textPrimary, fontWeight: "600" },
  cardBody: { fontSize: 12, color: Colors.textMuted, marginBottom: 10 },
  cardHint: { fontSize: 11, color: Colors.textSubtle, marginBottom: 8 },
  primaryBtn: {
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "white", fontSize: 13, fontWeight: "600", fontFamily: "DMSans_500Medium" },
  dangerBtn: {
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FDE8E8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FAD1D1",
  },
  dangerText: { color: Colors.danger, fontSize: 13, fontWeight: "600" },
  smsVerifyRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  smsInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.textPrimary,
    backgroundColor: Colors.input,
  },
  secondaryBtn: {
    width: 100,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: Colors.primary, fontSize: 13, fontWeight: "600" },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
