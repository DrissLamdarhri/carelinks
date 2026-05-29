import { useMemo, useState } from "react";
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
import { ArrowLeft, CheckCircle2, ChevronRight, Eye, EyeOff, Lock, Mail, MapPin, User } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { MOROCCAN_CITIES } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { AppleAuthButton } from "@/components/AppleAuthButton";
import { showToast } from "@/lib/toast";

export default function RegistrationScreen() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const goToMfaChallenge = (nextRole: "patient" | "pro" | "admin") => {
    router.replace({ pathname: "/auth/mfa-challenge", params: { role: nextRole } });
  };
  const goToMfaSetup = () => {
    router.replace({ pathname: "/auth/mfa-setup", params: { next: "/patient" } });
  };

  const handleRoleMismatch = (nextRole: string | null) => {
    if (!nextRole || nextRole === "patient") return;
    const label =
      nextRole === "pro" ? "professionnel" : nextRole === "admin" ? "administrateur" : "utilisateur";
    showToast(`Compte ${label} détecté. Redirection vers le bon espace.`);
  };

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Fès");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appleLoading, setAppleLoading] = useState(false);

  const fullName = `${firstName} ${lastName}`.trim();
  const passwordLevel = useMemo(() => {
    if (password.length >= 10) return 4;
    if (password.length >= 8) return 3;
    if (password.length >= 6) return 2;
    if (password.length > 0) return 1;
    return 0;
  }, [password]);

  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    phone.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    confirm === password &&
    agreed;

  const handleGoogleSignUp = async () => {
    if (googleLoading) return;
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle("patient");
      handleRoleMismatch(result.role);
      if (result.mfaRequired) {
        goToMfaChallenge(result.role ?? "patient");
        return;
      }
      goToMfaSetup();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Inscription Google impossible.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    if (appleLoading) return;
    setErrorMessage(null);
    setAppleLoading(true);
    try {
      const result = await signInWithApple("patient");
      handleRoleMismatch(result.role);
      if (result.mfaRequired) {
        goToMfaChallenge(result.role ?? "patient");
        return;
      }
      goToMfaSetup();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Inscription Apple impossible.");
    } finally {
      setAppleLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!valid || submitting) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signUpWithEmail(email.trim(), password, fullName, "patient", {
        phone: phone.trim(),
        city,
      });
      goToMfaSetup();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Inscription impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/auth/patient-login")} style={styles.backBtn}>
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Inscrivez-vous pour commencer à utiliser CareLink</Text>
        </View>

        <View style={styles.tabWrap}>
          <TouchableOpacity style={styles.tabBtn} onPress={() => router.push("/auth/patient-login")}>
            <Text style={styles.tabText}>Connexion</Text>
          </TouchableOpacity>
          <View style={[styles.tabBtn, styles.tabActive]}>
            <Text style={styles.tabActiveText}>Inscription</Text>
          </View>
        </View>

        <GoogleAuthButton loading={googleLoading} onPress={handleGoogleSignUp} />
        <View style={styles.oauthSpacer} />
        <AppleAuthButton loading={appleLoading} onPress={handleAppleSignUp} />

        <View style={styles.sepRow}>
          <View style={styles.sepLine} />
          <Text style={styles.sepText}>ou avec email</Text>
          <View style={styles.sepLine} />
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Prénom</Text>
            <View style={styles.inputWrap}>
              <User size={16} color={Colors.textMuted} />
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                style={styles.input}
                placeholder="Driss"
                placeholderTextColor={Colors.textSubtle}
              />
            </View>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Nom</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              style={styles.simpleInput}
              placeholder="Alaoui"
              placeholderTextColor={Colors.textSubtle}
            />
          </View>
        </View>

        <Text style={styles.label}>Téléphone</Text>
        <View style={styles.phoneWrap}>
          <Text style={styles.country}>+212</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            style={styles.phoneInput}
            placeholder="6 12 34 56 78"
            keyboardType="phone-pad"
            placeholderTextColor={Colors.textSubtle}
          />
        </View>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrap}>
          <Mail size={16} color={Colors.textMuted} />
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="driss@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={Colors.textSubtle}
          />
        </View>

        <Text style={styles.label}>Ville</Text>
        <View style={styles.inputWrap}>
          <MapPin size={16} color={Colors.textMuted} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.cityChips}>
              {MOROCCAN_CITIES.map((item) => {
                const active = item === city;
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setCity(item)}
                    style={[styles.cityChip, active && styles.cityChipActive]}
                  >
                    <Text style={[styles.cityText, active && styles.cityTextActive]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <Text style={styles.label}>Mot de passe</Text>
        <View style={styles.inputWrap}>
          <Lock size={16} color={Colors.textMuted} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="Min. 6 caractères"
            secureTextEntry={!showPassword}
            placeholderTextColor={Colors.textSubtle}
          />
          <TouchableOpacity onPress={() => setShowPassword((s) => !s)}>
            {showPassword ? <EyeOff size={16} color={Colors.textMuted} /> : <Eye size={16} color={Colors.textMuted} />}
          </TouchableOpacity>
        </View>

        {password.length > 0 ? (
          <View style={styles.strengthRow}>
            {[1, 2, 3, 4].map((value) => (
              <View
                key={value}
                style={[
                  styles.strengthBar,
                  {
                    backgroundColor:
                      passwordLevel >= value
                        ? passwordLevel >= 4
                          ? Colors.primary
                          : passwordLevel >= 2
                          ? Colors.accent
                          : Colors.danger
                        : "#E0E0E0",
                  },
                ]}
              />
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>Confirmer le mot de passe</Text>
        <View style={styles.inputWrap}>
          <Lock size={16} color={Colors.textMuted} />
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            style={styles.input}
            placeholder="••••••••"
            secureTextEntry
            placeholderTextColor={Colors.textSubtle}
          />
          {confirm.length > 0 && confirm === password ? <CheckCircle2 size={18} color={Colors.primary} /> : null}
        </View>

        {confirm.length > 0 && confirm !== password ? <Text style={styles.mismatch}>Les mots de passe ne correspondent pas</Text> : null}

        <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed((v) => !v)}>
          <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
            {agreed ? <CheckCircle2 size={12} color="white" /> : null}
          </View>
          <Text style={styles.termsText}>
            J'accepte les <Text style={styles.link}>conditions d'utilisation</Text> et la{" "}
            <Text style={styles.link}>politique de confidentialité</Text>.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!valid || submitting}
          onPress={handleEmailSignUp}
          style={[styles.submit, (!valid || submitting) && styles.submitDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text style={styles.submitText}>Créer mon compte</Text>
              <ChevronRight size={18} color="white" />
            </>
          )}
        </TouchableOpacity>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
  title: { fontSize: 28, color: Colors.textPrimary, marginBottom: 4, fontFamily: "DMSerifDisplay_400Regular" },
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
  row: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  label: { fontSize: 11, color: Colors.textMuted, marginBottom: 7, marginTop: 10, fontWeight: "500" },
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
  simpleInput: {
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  phoneWrap: {
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.input,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  country: {
    width: 62,
    textAlign: "center",
    color: Colors.textMuted,
    fontSize: 13,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingVertical: 15,
  },
  phoneInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingHorizontal: 12 },
  cityChips: { flexDirection: "row", gap: 8 },
  cityChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "white",
  },
  cityChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cityText: { fontSize: 12, color: Colors.textMuted },
  cityTextActive: { color: "white", fontWeight: "600" },
  strengthRow: { flexDirection: "row", gap: 5, marginTop: 8 },
  strengthBar: { flex: 1, height: 4, borderRadius: 999 },
  mismatch: { marginTop: 6, color: Colors.danger, fontSize: 11 },
  termsRow: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 16, alignItems: "flex-start" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D0D0D0",
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsText: { flex: 1, fontSize: 12, lineHeight: 18, color: Colors.textMuted },
  link: { color: Colors.primary, textDecorationLine: "underline" },
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
  oauthSpacer: { height: 10 },
});
