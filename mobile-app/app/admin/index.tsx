import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Shield, Mail, Lock, Eye, EyeOff, Activity } from "lucide-react-native";
import { Colors } from "@/lib/colors";

const ADMIN_CREDENTIALS = {
  email: "admin@carelink.ma",
  password: "CareLinkAdmin2024!",
};

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.trim().length > 0;

  const handleLogin = () => {
    if (email.trim() === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      setErrorMessage(null);
      router.replace("/admin/dashboard");
      return;
    }
    setErrorMessage("Identifiants incorrects.");
  };

  return (
    <LinearGradient colors={[Colors.primary, "#0a065a", "#071650"]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandBlock}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Activity size={22} color="white" />
            </View>
            <View>
              <Text style={styles.brandTitle}>CareLink</Text>
              <Text style={styles.brandSub}>Admin Dashboard</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Connexion Admin</Text>
          <Text style={styles.subtitle}>Accès réservé aux administrateurs CareLink</Text>

          <View style={styles.demoBox}>
            <Shield size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.demoTitle}>Identifiants de démonstration</Text>
              <Text style={styles.demoText}>{ADMIN_CREDENTIALS.email}</Text>
              <Text style={styles.demoText}>{ADMIN_CREDENTIALS.password}</Text>
            </View>
          </View>

          <Text style={styles.label}>Adresse email</Text>
          <View style={styles.inputWrap}>
            <Mail size={18} color={Colors.textMuted} />
            <TextInput
              placeholder="admin@carelink.ma"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholderTextColor="#B0B0B0"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.passwordHeader}>
            <Text style={styles.label}>Mot de passe</Text>
            <Text style={styles.forgot}>Mot de passe oublié ?</Text>
          </View>
          <View style={styles.inputWrap}>
            <Lock size={18} color={Colors.textMuted} />
            <TextInput
              placeholder="••••••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={styles.input}
              placeholderTextColor="#B0B0B0"
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
              {showPassword ? (
                <EyeOff size={18} color={Colors.textMuted} />
              ) : (
                <Eye size={18} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={!canSubmit}
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          >
            <Shield size={18} color="white" />
            <Text style={styles.submitText}>Accéder au tableau de bord</Text>
          </TouchableOpacity>

          <View style={styles.securityRow}>
            <Shield size={14} color="#B0B0B0" />
            <Text style={styles.securityText}>Connexion sécurisée · Accès protégé</Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, padding: 20 },
  brandBlock: { marginTop: 16, marginBottom: 16 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  brandTitle: {
    color: "white",
    fontSize: 24,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  brandSub: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
  },
  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: "700" },
  subtitle: { color: Colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 14 },
  demoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(13,8,112,0.1)",
    padding: 12,
    marginBottom: 14,
  },
  demoTitle: { color: Colors.primary, fontSize: 12, fontWeight: "600", marginBottom: 4 },
  demoText: { color: "rgba(13,8,112,0.72)", fontSize: 12, fontFamily: "Courier" },
  label: { fontSize: 12, color: Colors.textPrimary, fontWeight: "500", marginBottom: 8 },
  passwordHeader: { marginTop: 12, marginBottom: 8, flexDirection: "row", justifyContent: "space-between" },
  forgot: { color: Colors.primary, fontSize: 12, fontWeight: "500" },
  inputWrap: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F3F3F5",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  errorText: { marginTop: 10, color: Colors.danger, fontSize: 12 },
  submitBtn: {
    marginTop: 16,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitBtnDisabled: { backgroundColor: "#D0D0D0" },
  submitText: { color: "white", fontSize: 15, fontWeight: "600" },
  securityRow: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  securityText: { color: "#B0B0B0", fontSize: 12 },
});
