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
import { ArrowLeft, ChevronRight, Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

export default function PatientLoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const valid = email.trim().length > 0 && password.trim().length > 0;

  const handleEmailSignIn = async () => {
    if (!valid || submitting) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const role = await signInWithEmail(email.trim(), password, "patient");
      if (role === "pro") {
        router.replace("/pro");
      } else if (role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/patient");
      }
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
      await signInWithGoogle("patient");
      router.replace("/patient");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Connexion Google impossible.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/auth")} style={styles.backBtn}>
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Bon retour !</Text>
          <Text style={styles.subtitle}>Connectez-vous pour accéder à vos soins</Text>
        </View>

        <View style={styles.tabWrap}>
          <View style={[styles.tabBtn, styles.tabActive]}>
            <Text style={styles.tabActiveText}>Connexion</Text>
          </View>
          <TouchableOpacity style={styles.tabBtn} onPress={() => router.push("/auth/registration")}>
            <Text style={styles.tabText}>Inscription</Text>
          </TouchableOpacity>
        </View>

        <GoogleAuthButton loading={googleLoading} onPress={handleGoogleSignIn} />

        <View style={styles.sepRow}>
          <View style={styles.sepLine} />
          <Text style={styles.sepText}>ou avec email</Text>
          <View style={styles.sepLine} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <Mail size={18} color={Colors.textMuted} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholder="votre@email.com"
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

        <TouchableOpacity>
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

        <View style={styles.hintCard}>
          <Text style={styles.hintText}>💡 Première visite ? Créez un compte via l'onglet “Inscription”.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 28 },
  header: { marginBottom: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.input,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    color: Colors.textPrimary,
    marginBottom: 4,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  subtitle: { fontSize: 14, color: Colors.textMuted },
  tabWrap: {
    flexDirection: "row",
    backgroundColor: Colors.input,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: { flex: 1, height: 40, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  tabActive: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: { fontSize: 14, color: Colors.textMuted },
  tabActiveText: { fontSize: 14, color: Colors.textPrimary, fontWeight: "600" },
  sepRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  sepLine: { flex: 1, height: 1, backgroundColor: "#E0E0E0" },
  sepText: { fontSize: 11, color: Colors.textMuted },
  field: { marginBottom: 12 },
  label: { fontSize: 11, color: Colors.textMuted, marginBottom: 7, fontWeight: "500" },
  inputWrap: {
    height: 50,
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
    marginTop: 2,
  },
  submitDisabled: { backgroundColor: "#D9D9D9" },
  submitText: { color: "white", fontSize: 15, fontWeight: "600", fontFamily: "DMSans_500Medium" },
  errorText: { marginTop: 10, color: Colors.danger, fontSize: 12 },
  hintCard: { marginTop: 12, backgroundColor: Colors.surfaceWarm, borderRadius: 12, padding: 12 },
  hintText: { fontSize: 11, color: Colors.primary, fontWeight: "500" },
});
