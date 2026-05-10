import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  Stethoscope,
  Shield,
} from "lucide-react-native";
import { Colors, Gradients } from "@/lib/colors";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default function ProLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const valid = email.trim().length > 0 && password.trim().length > 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ flexGrow: 1 }}>
      <LinearGradient colors={Gradients.patientHeader} style={styles.header}>
        <View style={styles.headerControls}>
          <TouchableOpacity
            onPress={() => router.push("/auth")}
            style={styles.backBtn}
          >
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <LocaleSwitcher compact />
        </View>

        <View style={styles.titleRow}>
          <View style={styles.proIconWrap}>
            <Stethoscope size={24} color="white" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Espace Pro</Text>
            <Text style={styles.headerSubtitle}>
              Infirmier · Psychologue · Kiné · Yoga
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.form}>
        <Text style={styles.formLead}>
          Connectez-vous à votre compte professionnel
        </Text>

        <TouchableOpacity style={styles.googleBtn}>
          <Text style={styles.googleText}>Continuer avec Google</Text>
        </TouchableOpacity>

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
              secureTextEntry={!showPw}
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textSubtle}
            />
            <TouchableOpacity onPress={() => setShowPw((v) => !v)}>
              {showPw ? (
                <EyeOff size={18} color={Colors.textMuted} />
              ) : (
                <Eye size={18} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity>
          <Text style={styles.forgot}>Mot de passe oublié ?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!valid}
          onPress={() => router.push("/pro")}
          style={[styles.submit, !valid && styles.submitDisabled]}
        >
          <Text style={styles.submitText}>Se connecter</Text>
          <ChevronRight size={18} color="white" />
        </TouchableOpacity>

        <View style={styles.noticeCard}>
          <Shield size={18} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Compte vérifié requis</Text>
            <Text style={styles.noticeBody}>
              Seuls les professionnels approuvés peuvent se connecter.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/auth/registration")}
          style={styles.registerBtn}
        >
          <Text style={styles.registerText}>Créer un compte professionnel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 26 },
  headerControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  proIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    color: "white",
    fontFamily: "DMSerifDisplay_400Regular",
  },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.65)" },
  form: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30, gap: 12 },
  formLead: { fontSize: 15, color: Colors.textPrimary, fontWeight: "600", marginBottom: 4 },
  googleBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  googleText: { fontSize: 14, color: Colors.textPrimary, fontWeight: "600" },
  sepRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  sepLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  sepText: { fontSize: 11, color: Colors.textMuted },
  field: { marginTop: 2 },
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
  forgot: { textAlign: "right", fontSize: 13, color: Colors.primary, fontWeight: "500" },
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
  submitText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "DMSans_500Medium",
  },
  noticeCard: {
    marginTop: 4,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    gap: 10,
  },
  noticeTitle: { color: Colors.primary, fontSize: 13, fontWeight: "600", marginBottom: 2 },
  noticeBody: { color: "rgba(13,8,112,0.7)", fontSize: 11 },
  registerBtn: {
    height: 50,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  registerText: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
});
