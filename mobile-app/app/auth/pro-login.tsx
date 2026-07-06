import { useState } from "react";
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
import { ArrowLeft, ChevronRight, Eye, EyeOff, Lock, Mail, Shield, Stethoscope } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { AppleAuthButton } from "@/components/AppleAuthButton";
import { showToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";

export default function ProLoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle, signInWithApple, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appleLoading, setAppleLoading] = useState(false);

  const valid = email.trim().length > 0 && password.trim().length > 0;

  const routeByRole = (nextRole: string | null) => {
    if (nextRole === "patient") {
      router.replace("/patient");
    } else if (nextRole === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/pro");
    }
  };

  const goToMfaChallenge = (nextRole: "patient" | "pro" | "admin") => {
    router.replace({ pathname: "/auth/mfa-challenge", params: { role: nextRole } });
  };

  const handleRoleMismatch = (nextRole: string | null) => {
    if (!nextRole || nextRole === "pro") return;
    const label =
      nextRole === "patient" ? "patient" : nextRole === "admin" ? "administrateur" : "utilisateur";
    showToast(`Compte ${label} détecté. Redirection vers le bon espace.`);
  };

  const handleEmailSignIn = async () => {
    if (!valid || submitting) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const result = await signInWithEmail(email.trim(), password, "pro");
      handleRoleMismatch(result.role);
      if (result.mfaRequired) {
        goToMfaChallenge(result.role ?? "pro");
        return;
      }
      routeByRole(result.role);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Identifiants incorrects.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle("pro");
      
      // Check if professional account exists and is verified
      if (result.role === "pro") {
        const { data: proData, error: proError } = await supabase
          .from("professionals")
          .select("verification_status")
          .eq("id", (await supabase.auth.getUser()).data.user?.id)
          .single();

        if (proError || !proData) {
          // Professional account not found or error - redirect to signup
          showToast("Compte professionnel non trouvé. Veuillez d'abord vous inscrire.");
          router.replace("/auth/pro-registration");
          return;
        }

        if (proData.verification_status !== "approved") {
          // Professional not verified - redirect to upload documents
          showToast("Votre compte n'est pas encore vérifié. Complétez l'inscription.");
          router.replace("/auth/pro-registration");
          return;
        }
      }

      handleRoleMismatch(result.role);
      if (result.mfaRequired) {
        goToMfaChallenge(result.role ?? "pro");
        return;
      }
      routeByRole(result.role);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Connexion Google impossible.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (appleLoading) return;
    setErrorMessage(null);
    setAppleLoading(true);
    try {
      const result = await signInWithApple("pro");
      handleRoleMismatch(result.role);
      if (result.mfaRequired) {
        goToMfaChallenge(result.role ?? "pro");
        return;
      }
      routeByRole(result.role);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Connexion Apple impossible.");
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.bubbleTop} />
        <View style={styles.bubbleBottom} />

        <TouchableOpacity onPress={() => router.push("/auth")} style={styles.backBtn}>
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>

        <View style={styles.heroRow}>
          <View style={styles.proIconWrap}>
            <Stethoscope size={24} color="white" />
          </View>
          <View>
            <Text style={styles.heroTitle}>Espace Pro</Text>
            <Text style={styles.heroSubtitle}>Infirmier · Psychologue · Kiné · Yoga</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.formLead}>Connectez-vous à votre compte professionnel</Text>

        <GoogleAuthButton loading={googleLoading} onPress={handleGoogleSignIn} />
        <View style={styles.oauthSpacer} />
        <AppleAuthButton loading={appleLoading} onPress={handleAppleSignIn} />

        <View style={styles.sepRow}>
          <View style={styles.sepLine} />
          <Text style={styles.sepText}>ou avec email</Text>
          <View style={styles.sepLine} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email professionnel</Text>
          <View style={styles.inputWrap}>
            <Mail size={18} color={Colors.textMuted} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholder="karim@carelink.ma"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={Colors.textSubtle}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.inputWrap}>
            <Lock size={18} color={Colors.textMuted} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              placeholder="••••••••"
              secureTextEntry={!showPw}
              placeholderTextColor={Colors.textSubtle}
            />
            <TouchableOpacity onPress={() => setShowPw((s) => !s)}>
              {showPw ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={async () => {
            if (!email.trim()) {
              showToast("Entrez votre email d'abord");
              return;
            }
            try {
              await sendPasswordReset(email);
              showToast("Email de réinitialisation envoyé ✓");
            } catch (e) {
              showToast(e instanceof Error ? e.message : "Envoi impossible");
            }
          }}
        >
          <Text style={styles.forgot}>Mot de passe oublié ?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!valid || submitting}
          onPress={handleEmailSignIn}
          style={[styles.submit, (!valid || submitting) && styles.submitDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text style={styles.submitText}>Se connecter</Text>
              <ChevronRight size={18} color="white" />
            </>
          )}
        </TouchableOpacity>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <View style={styles.noticeCard}>
          <Shield size={20} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Compte vérifié requis</Text>
            <Text style={styles.noticeBody}>Seuls les professionnels approuvés peuvent se connecter</Text>
          </View>
        </View>

        <View style={styles.registerWrap}>
          <Text style={styles.registerHint}>Pas encore inscrit ?</Text>
          <TouchableOpacity onPress={() => router.push("/auth/pro-registration")} style={styles.registerBtn}>
            <Text style={styles.registerText}>Créer un compte professionnel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 46,
    paddingBottom: 26,
    overflow: "hidden",
  },
  bubbleTop: {
    position: "absolute",
    top: -34,
    right: -34,
    width: 130,
    height: 130,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  bubbleBottom: {
    position: "absolute",
    left: -26,
    bottom: -20,
    width: 90,
    height: 90,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  proIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: "white",
    fontSize: 24,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  heroSubtitle: { color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  formLead: { fontSize: 15, color: Colors.textPrimary, fontWeight: "600", marginBottom: 14 },
  sepRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  sepLine: { flex: 1, height: 1, backgroundColor: "#E0E0E0" },
  sepText: { fontSize: 11, color: Colors.textMuted },
  field: { marginBottom: 12 },
  label: { fontSize: 11, color: Colors.textMuted, marginBottom: 7, fontWeight: "500" },
  inputWrap: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  forgot: { textAlign: "right", marginBottom: 14, color: Colors.primary, fontSize: 13, fontWeight: "500" },
  submit: {
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitDisabled: { backgroundColor: "#D9D9D9" },
  submitText: { color: "white", fontSize: 15, fontWeight: "600", fontFamily: "DMSans_500Medium" },
  errorText: { marginTop: 10, color: Colors.danger, fontSize: 12 },
  noticeCard: {
    marginTop: 14,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noticeTitle: { color: Colors.primary, fontSize: 13, fontWeight: "600" },
  noticeBody: { color: "rgba(13,8,112,0.74)", fontSize: 11, marginTop: 2 },
  registerWrap: { marginTop: 16, alignItems: "center", gap: 10 },
  registerHint: { color: Colors.textMuted, fontSize: 12 },
  registerBtn: {
    width: "100%",
    height: 50,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  registerText: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
  oauthSpacer: { height: 10 },
});
