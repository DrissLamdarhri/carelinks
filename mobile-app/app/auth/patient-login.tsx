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
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
} from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default function PatientLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const valid = email.trim().length > 0 && password.trim().length > 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.push("/auth")} style={styles.backBtn}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <LocaleSwitcher />
      </View>

      <Text style={styles.title}>Bon retour !</Text>
      <Text style={styles.subtitle}>
        Connectez-vous pour accéder à vos soins
      </Text>

      <View style={styles.tabWrap}>
        <View style={[styles.tabBtn, styles.tabActive]}>
          <Text style={styles.tabActiveText}>Connexion</Text>
        </View>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => router.push("/auth/registration")}
        >
          <Text style={styles.tabText}>Inscription</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.googleBtn}>
        <Text style={styles.googleText}>Continuer avec Google</Text>
      </TouchableOpacity>

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
        onPress={() => router.push("/patient")}
        style={[styles.submit, !valid && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>Se connecter</Text>
        <ChevronRight size={18} color="white" />
      </TouchableOpacity>

      <View style={styles.hintCard}>
        <Text style={styles.hintText}>
          Première visite ? Créez un compte depuis l’onglet
          <Text style={{ fontWeight: "700" }}> Inscription</Text>.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.input,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 30,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 6,
  },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 18 },
  tabWrap: {
    flexDirection: "row",
    backgroundColor: Colors.input,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: { flex: 1, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  tabActive: { backgroundColor: Colors.white },
  tabText: { fontSize: 14, color: Colors.textMuted, fontWeight: "500" },
  tabActiveText: { fontSize: 14, color: Colors.textPrimary, fontWeight: "600" },
  googleBtn: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  googleText: { fontSize: 14, color: Colors.textPrimary, fontWeight: "600" },
  sepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 14,
  },
  sepLine: { flex: 1, height: 1, backgroundColor: Colors.border },
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
  forgot: {
    textAlign: "right",
    marginBottom: 18,
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "500",
  },
  submit: {
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  submitDisabled: { backgroundColor: "#D9D9D9" },
  submitText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "DMSans_500Medium",
  },
  hintCard: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 12,
    padding: 12,
  },
  hintText: { fontSize: 11, color: Colors.primary },
});
