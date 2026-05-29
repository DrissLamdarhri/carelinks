import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import { Buffer } from "buffer";
import * as Clipboard from "expo-clipboard";
import { SvgXml } from "react-native-svg";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { useMfa } from "@/lib/hooks/useMfa";
import { supabase } from "@/lib/supabase";

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

export default function MfaSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile, enrollMfaTotp, verifyMfaTotp, refreshProfile } = useAuth();
  const { createBackupCodes, clearBackupCodes, listTotpFactors, unenrollFactor } = useMfa(user?.id);

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [secretCopied, setSecretCopied] = useState(false);
  const [alreadyEnabled, setAlreadyEnabled] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextRoute = useMemo<"/patient" | "/pro" | "/admin">(() => {
    if (typeof params.next === "string") {
      if (params.next === "/patient" || params.next === "/pro" || params.next === "/admin") {
        return params.next;
      }
    }
    if (profile?.role === "pro") return "/pro";
    if (profile?.role === "admin") return "/admin";
    return "/patient";
  }, [params.next, profile?.role]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (profile?.mfaEnabled) {
        setAlreadyEnabled(true);
        setLoading(false);
        return;
      }
      try {
        setErrorMessage(null);
        const factors = await listTotpFactors();
        const verified = factors.find((factor) => factor.status === "verified");
        if (verified) {
          if (user?.id) {
            const { error } = await supabase
              .from("profiles")
              .update({ mfa_enabled: true, mfa_method: "totp" })
              .eq("id", user.id);
            if (error) throw error;
            await refreshProfile();
          }
          if (!mounted) return;
          setAlreadyEnabled(true);
          setFactorId(verified.id);
          return;
        }
        const unverified = factors.filter((factor) => factor.status === "unverified");
        for (const factor of unverified) {
          await unenrollFactor(factor.id);
        }
        const result = await enrollMfaTotp();
        if (!mounted) return;
        setFactorId(result.factorId);
        setQrCode(result.qrCode);
        setSecret(result.secret);
      } catch (error) {
        if (!mounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Impossible de configurer le MFA.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void init();
    return () => {
      mounted = false;
    };
  }, [enrollMfaTotp, listTotpFactors, profile?.mfaEnabled, refreshProfile, unenrollFactor, user?.id]);

  const handleVerify = async () => {
    if (!factorId || verifying) return;
    setVerifying(true);
    setErrorMessage(null);
    try {
      await verifyMfaTotp(code, factorId);
      await clearBackupCodes();
      const codes = await createBackupCodes(8);
      setBackupCodes(codes);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Code invalide.");
    } finally {
      setVerifying(false);
    }
  };

  const handleContinue = () => {
    router.replace(nextRoute);
  };

  const handleCopySecret = async () => {
    if (!secret) return;
    await Clipboard.setStringAsync(secret);
    setSecretCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setSecretCopied(false), 2000);
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const renderQrCode = () => {
    if (!qrCode) return null;
    const trimmed = qrCode.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("data:image/svg+xml")) {
      const match = trimmed.match(/^data:image\/svg\+xml(;charset=[^;,]+)?(;base64)?,(.*)$/);
      if (match) {
        const isBase64 = Boolean(match[2]);
        const payload = match[3] ?? "";
        const xml = isBase64
          ? Buffer.from(payload, "base64").toString("utf8")
          : decodeURIComponent(payload);
        return <SvgXml xml={xml} width={160} height={160} />;
      }
    }
    if (trimmed.includes("<svg")) {
      return <SvgXml xml={trimmed} width={160} height={160} />;
    }
    if (trimmed.startsWith("data:image/")) {
      return <Image source={{ uri: trimmed }} style={styles.qrImage} resizeMode="contain" />;
    }
    return (
      <Image
        source={{ uri: `data:image/png;base64,${trimmed}` }}
        style={styles.qrImage}
        resizeMode="contain"
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  const isEnabled = Boolean(profile?.mfaEnabled || alreadyEnabled);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <ShieldCheck size={22} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Activer la double authentification</Text>
          <Text style={styles.subtitle}>
            Scannez le QR code puis saisissez le code à 6 chiffres pour confirmer.
          </Text>
        </View>

        {isEnabled ? (
          <View style={styles.enabledCard}>
            <Text style={styles.enabledTitle}>MFA déjà activé</Text>
            <Text style={styles.enabledText}>Votre compte est déjà protégé.</Text>
          </View>
        ) : (
          <>
            {qrCode ? <View style={styles.qrWrap}>{renderQrCode()}</View> : null}

            {secret ? (
              <View style={styles.secretCard}>
                <View style={styles.secretHeader}>
                  <Text style={styles.secretLabel}>Clé manuelle</Text>
                  <TouchableOpacity onPress={handleCopySecret} style={styles.copyBtn}>
                    <Text style={styles.copyText}>{secretCopied ? "Copié" : "Copier"}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.secretValue}>{secret}</Text>
              </View>
            ) : null}

            <CodeInput value={code} onChange={setCode} />

            <TouchableOpacity
              disabled={verifying || code.trim().length !== 6}
              onPress={handleVerify}
              style={[
                styles.submit,
                (verifying || code.trim().length !== 6) && styles.submitDisabled,
              ]}
            >
              {verifying ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.submitText}>Valider</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {backupCodes.length > 0 ? (
          <View style={styles.backupCard}>
            <Text style={styles.backupTitle}>Codes de secours</Text>
            <Text style={styles.backupHint}>
              Notez ces codes dans un endroit sûr. Chaque code est utilisable une seule fois.
            </Text>
            <View style={styles.backupGrid}>
              {backupCodes.map((item) => (
                <View key={item} style={styles.backupChip}>
                  <Text style={styles.backupChipText}>{item}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={handleContinue} style={styles.continueBtn}>
              <Text style={styles.continueText}>Continuer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!backupCodes.length ? (
          <TouchableOpacity onPress={handleContinue} style={styles.skipBtn}>
            <Text style={styles.skipText}>
              {isEnabled ? "Continuer" : "Configurer plus tard"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "white" },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  header: { alignItems: "center", marginBottom: 16 },
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
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: { fontSize: 12, color: Colors.textMuted, textAlign: "center" },
  qrWrap: {
    alignSelf: "center",
    width: 180,
    height: 180,
    borderRadius: 20,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  qrImage: { width: 160, height: 160 },
  secretCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceWarm,
    marginBottom: 12,
  },
  secretHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  secretLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  secretValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: "600" },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  copyText: { fontSize: 11, color: Colors.primary, fontWeight: "600" },
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
  codeCellFilled: { borderColor: Colors.primary, backgroundColor: "white" },
  codeCellText: { fontSize: 18, color: Colors.textPrimary, fontWeight: "600" },
  hiddenInput: { position: "absolute", opacity: 0 },
  submit: {
    marginTop: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { backgroundColor: "#D9D9D9" },
  submitText: { color: "white", fontSize: 15, fontWeight: "600", fontFamily: "DMSans_500Medium" },
  skipBtn: { marginTop: 16, alignItems: "center" },
  skipText: { color: Colors.textMuted, fontSize: 12, textDecorationLine: "underline" },
  backupCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceWarm,
  },
  backupTitle: { fontSize: 14, color: Colors.primary, fontWeight: "700", marginBottom: 6 },
  backupHint: { fontSize: 11, color: Colors.textMuted, marginBottom: 12 },
  backupGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  backupChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backupChipText: { fontSize: 12, color: Colors.textPrimary, fontWeight: "600" },
  continueBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: { color: "white", fontSize: 14, fontWeight: "600", fontFamily: "DMSans_500Medium" },
  enabledCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceWarm,
    marginTop: 8,
  },
  enabledTitle: { fontSize: 14, color: Colors.primary, fontWeight: "700", marginBottom: 4 },
  enabledText: { fontSize: 12, color: Colors.textMuted },
  errorText: { marginTop: 10, color: Colors.danger, fontSize: 12, textAlign: "center" },
});
