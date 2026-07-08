import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import { ArrowLeft, CheckCircle2, ChevronRight, Eye, EyeOff, Lock, Mail, MapPin, User } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { MOROCCAN_CITIES } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { AppleAuthButton } from "@/components/AppleAuthButton";
import { showToast } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";

export default function PatientAuthFlowScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const { t } = useI18n();
  const screenWidth = Dimensions.get("window").width;

  // Shared OAuth state
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShowPw, setLoginShowPw] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Registration form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [city, setCity] = useState("Fès");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Current tab (0 = login, 1 = register)
  const [tab, setTab] = useState(0);

  const loginValid = loginEmail.trim().length > 0 && loginPassword.trim().length > 0;
  const fullName = `${firstName} ${lastName}`.trim();
  const passwordLevel = useMemo(() => {
    if (password.length >= 10) return 4;
    if (password.length >= 8) return 3;
    if (password.length >= 6) return 2;
    if (password.length > 0) return 1;
    return 0;
  }, [password]);

  const regValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    phone.trim().length > 0 &&
    regEmail.trim().length > 0 &&
    password.length >= 6 &&
    confirm === password &&
    agreed;

  const routeByRole = (nextRole: string | null) => {
    showToast("Connexion réussie ✓", "success");
    if (nextRole === "pro") {
      router.replace("/pro");
    } else if (nextRole === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/patient");
    }
  };

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

  const handleEmailSignIn = async () => {
    if (!loginValid || loginSubmitting) return;
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const result = await signInWithEmail(loginEmail.trim(), loginPassword, "patient");
      handleRoleMismatch(result.role);
      if (result.mfaRequired) {
        goToMfaChallenge(result.role ?? "patient");
        return;
      }
      routeByRole(result.role);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Identifiants incorrects.");
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!regValid || regSubmitting) return;
    setRegError(null);
    setRegSubmitting(true);
    try {
      await signUpWithEmail(
        regEmail.trim(),
        password,
        fullName,
        "patient",
        { phone, city }
      );
      goToMfaSetup();
    } catch (error) {
      setRegError(error instanceof Error ? error.message : "Inscription échouée.");
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (googleLoading) return;
    setLoginError(null);
    setRegError(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle("patient");
      handleRoleMismatch(result.role);
      if (result.mfaRequired) {
        goToMfaChallenge(result.role ?? "patient");
        return;
      }
      if (tab === 0) {
        routeByRole(result.role);
      } else {
        goToMfaSetup();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Authentification Google impossible.";
      if (tab === 0) setLoginError(msg);
      else setRegError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    if (appleLoading) return;
    setLoginError(null);
    setRegError(null);
    setAppleLoading(true);
    try {
      const result = await signInWithApple("patient");
      handleRoleMismatch(result.role);
      if (result.mfaRequired) {
        goToMfaChallenge(result.role ?? "patient");
        return;
      }
      if (tab === 0) {
        routeByRole(result.role);
      } else {
        goToMfaSetup();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Authentification Apple impossible.";
      if (tab === 0) setLoginError(msg);
      else setRegError(msg);
    } finally {
      setAppleLoading(false);
    }
  };

  const switchTab = (newTab: number) => {
    setTab(newTab);
    scrollRef.current?.scrollTo({ x: newTab * screenWidth, animated: true });
  };

  return (
    <View style={styles.root}>
      {/* Header avec back button */}
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => router.push("/auth")} style={styles.backBtn}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tab selector */}
      <View style={styles.tabWrapper}>
        <View style={styles.tabWrap}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 0 && styles.tabActive]}
            onPress={() => switchTab(0)}
          >
            <Text style={[styles.tabText, tab === 0 && styles.tabActiveText]}>{t("login")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 1 && styles.tabActive]}
            onPress={() => switchTab(1)}
          >
            <Text style={[styles.tabText, tab === 1 && styles.tabActiveText]}>{t("signup")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Swipeable content with fluent transition */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={screenWidth}
        snapToAlignment="center"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          setTab(page);
        }}
        scrollEnabled={false} // Disable swipe, use buttons instead for better UX
        contentContainerStyle={{ width: screenWidth * 2 }}
      >
        {/* LOGIN SCREEN */}
        <ScrollView contentContainerStyle={[styles.screenContent, { width: screenWidth }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.screenHeader}>
            <Text style={styles.screenTitle}>{t("welcome_back")}</Text>
            <Text style={styles.screenSubtitle}>{t("login_subtitle")}</Text>
          </View>

          <GoogleAuthButton loading={googleLoading} onPress={handleGoogleAuth} />
          <View style={styles.oauthSpacer} />
          <AppleAuthButton loading={appleLoading} onPress={handleAppleAuth} />

          <View style={styles.sepRow}>
            <View style={styles.sepLine} />
            <Text style={styles.sepText}>{t("or_with_email")}</Text>
            <View style={styles.sepLine} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("email")}</Text>
            <View style={styles.inputWrap}>
              <Mail size={18} color={Colors.textMuted} />
              <TextInput
                value={loginEmail}
                onChangeText={setLoginEmail}
                style={styles.input}
                placeholder="votre@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={Colors.textSubtle}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("password")}</Text>
            <View style={styles.inputWrap}>
              <Lock size={18} color={Colors.textMuted} />
              <TextInput
                value={loginPassword}
                onChangeText={setLoginPassword}
                style={styles.input}
                placeholder="••••••••"
                secureTextEntry={!loginShowPw}
                placeholderTextColor={Colors.textSubtle}
              />
              <TouchableOpacity onPress={() => setLoginShowPw((s) => !s)}>
                {loginShowPw ? (
                  <EyeOff size={18} color={Colors.textMuted} />
                ) : (
                  <Eye size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity>
            <Text style={styles.forgot}>{t("forgot_password")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={!loginValid || loginSubmitting}
            onPress={handleEmailSignIn}
            style={[styles.submit, (!loginValid || loginSubmitting) && styles.submitDisabled]}
          >
            {loginSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Text style={styles.submitText}>{t("signin_btn")}</Text>
                <ChevronRight size={18} color="white" />
              </>
            )}
          </TouchableOpacity>

          {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

          <View style={styles.hintCard}>
            <Text style={styles.hintText}>💡 Première visite ? Créez un compte via l'onglet "Inscription".</Text>
          </View>
        </ScrollView>

        {/* REGISTRATION SCREEN */}
        <ScrollView contentContainerStyle={[styles.screenContent, { width: screenWidth }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.screenHeader}>
            <Text style={styles.screenTitle}>Bienvenue !</Text>
            <Text style={styles.screenSubtitle}>Créez votre compte pour débuter votre parcours</Text>
          </View>

          <GoogleAuthButton loading={googleLoading} onPress={handleGoogleAuth} />
          <View style={styles.oauthSpacer} />
          <AppleAuthButton loading={appleLoading} onPress={handleAppleAuth} />

          <View style={styles.sepRow}>
            <View style={styles.sepLine} />
            <Text style={styles.sepText}>{t("or_with_email")}</Text>
            <View style={styles.sepLine} />
          </View>

          {/* Name fields */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>{t("first_name")}</Text>
              <View style={styles.inputWrap}>
                <User size={18} color={Colors.textMuted} />
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  style={styles.input}
                  placeholder="Jean"
                  placeholderTextColor={Colors.textSubtle}
                />
              </View>
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>{t("last_name")}</Text>
              <View style={styles.inputWrap}>
                <User size={18} color={Colors.textMuted} />
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  style={styles.input}
                  placeholder="Dupont"
                  placeholderTextColor={Colors.textSubtle}
                />
              </View>
            </View>
          </View>

          {/* Phone field */}
          <View style={styles.field}>
            <Text style={styles.label}>Téléphone</Text>
            <View style={styles.inputWrap}>
              <Mail size={18} color={Colors.textMuted} />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                style={styles.input}
                placeholder="+212 6XX XXX XXX"
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textSubtle}
              />
            </View>
          </View>

          {/* Email field */}
          <View style={styles.field}>
            <Text style={styles.label}>{t("email")}</Text>
            <View style={styles.inputWrap}>
              <Mail size={18} color={Colors.textMuted} />
              <TextInput
                value={regEmail}
                onChangeText={setRegEmail}
                style={styles.input}
                placeholder="votre@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={Colors.textSubtle}
              />
            </View>
          </View>

          {/* City field */}
          <View style={styles.field}>
            <Text style={styles.label}>{t("city")}</Text>
            <View style={styles.pickerWrap}>
              <MapPin size={18} color={Colors.textMuted} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {MOROCCAN_CITIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCity(c)}
                    style={[styles.cityTag, city === c && styles.cityTagActive]}
                  >
                    <Text style={[styles.cityTagText, city === c && styles.cityTagTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Password field */}
          <View style={styles.field}>
            <Text style={styles.label}>{t("password")}</Text>
            <View style={styles.inputWrap}>
              <Lock size={18} color={Colors.textMuted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                placeholderTextColor={Colors.textSubtle}
              />
              <TouchableOpacity onPress={() => setShowPassword((s) => !s)}>
                {showPassword ? (
                  <EyeOff size={18} color={Colors.textMuted} />
                ) : (
                  <Eye size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Password strength indicator */}
          <View style={styles.pwStrengthWrap}>
            {[1, 2, 3, 4].map((level) => (
              <View
                key={level}
                style={[
                  styles.pwStrengthBar,
                  passwordLevel >= level ? styles.pwStrengthBarActive : styles.pwStrengthBarInactive,
                ]}
              />
            ))}
          </View>

          {/* Confirm password field */}
          <View style={styles.field}>
            <Text style={styles.label}>{t("confirm_password")}</Text>
            <View style={styles.inputWrap}>
              <Lock size={18} color={Colors.textMuted} />
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                style={styles.input}
                placeholder="••••••••"
                secureTextEntry
                placeholderTextColor={Colors.textSubtle}
              />
              {confirm.length > 0 && (
                <CheckCircle2 size={18} color={confirm === password ? Colors.success : Colors.danger} />
              )}
            </View>
          </View>

          {/* Terms checkbox */}
          <View style={styles.agreeRow}>
            <TouchableOpacity onPress={() => setAgreed(!agreed)} style={styles.checkbox}>
              {agreed && <View style={styles.checkboxMark} />}
            </TouchableOpacity>
            <Text style={styles.agreeText}>
              J'accepte les{" "}
              <Text style={{ color: Colors.primary, fontWeight: "600" }}>conditions d'utilisation</Text> et la{" "}
              <Text style={{ color: Colors.primary, fontWeight: "600" }}>politique de confidentialité</Text>
            </Text>
          </View>

          <TouchableOpacity
            disabled={!regValid || regSubmitting}
            onPress={handleEmailSignUp}
            style={[styles.submit, (!regValid || regSubmitting) && styles.submitDisabled]}
          >
            {regSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Text style={styles.submitText}>{t("create_my_account")}</Text>
                <ChevronRight size={18} color="white" />
              </>
            )}
          </TouchableOpacity>

          {regError ? <Text style={styles.errorText}>{regError}</Text> : null}

          <View style={styles.hintCard}>
            <Text style={styles.hintText}>🔒 Votre compte sera sécurisé par authentification multi-facteurs.</Text>
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  headerTop: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.input,
    justifyContent: "center",
    alignItems: "center",
  },
  tabWrapper: { paddingHorizontal: 20, paddingVertical: 12 },
  tabWrap: {
    flexDirection: "row",
    backgroundColor: Colors.input,
    borderRadius: 12,
    padding: 4,
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
  screenContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 240 },
  screenHeader: { marginBottom: 16 },
  screenTitle: {
    fontSize: 28,
    color: Colors.textPrimary,
    marginBottom: 4,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  screenSubtitle: { fontSize: 14, color: Colors.textMuted },
  oauthSpacer: { height: 10 },
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
  pickerWrap: {
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cityTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    marginRight: 8,
  },
  cityTagActive: { backgroundColor: Colors.primary },
  cityTagText: { fontSize: 12, color: Colors.textMuted },
  cityTagTextActive: { color: "white", fontWeight: "600" },
  forgot: { textAlign: "right", marginBottom: 14, color: Colors.primary, fontSize: 13, fontWeight: "500" },
  pwStrengthWrap: { flexDirection: "row", gap: 4, marginBottom: 12, marginTop: -8 },
  pwStrengthBar: { flex: 1, height: 3, borderRadius: 1.5 },
  pwStrengthBarActive: { backgroundColor: Colors.primary },
  pwStrengthBarInactive: { backgroundColor: "#E0E0E0" },
  agreeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  checkboxMark: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  agreeText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
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
