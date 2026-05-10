import { useMemo, useState } from "react";
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
  User,
  Mail,
  MapPin,
  Lock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { MOROCCAN_CITIES } from "@/lib/mock-data";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default function RegistrationScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Fès");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);

  const passwordLevel = useMemo(() => {
    if (password.length >= 10) return 4;
    if (password.length >= 8) return 3;
    if (password.length >= 6) return 2;
    if (password.length > 0) return 1;
    return 0;
  }, [password]);

  const valid =
    firstName &&
    lastName &&
    phone &&
    email &&
    city &&
    password.length >= 6 &&
    password === confirm &&
    agreed;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.push("/auth/patient-login")} style={styles.backBtn}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <LocaleSwitcher />
      </View>

      <Text style={styles.title}>Créer un compte</Text>
      <Text style={styles.subtitle}>
        Inscrivez-vous pour commencer à utiliser CareLink
      </Text>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Prénom</Text>
          <View style={styles.inputWrap}>
            <User size={16} color={Colors.textMuted} />
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Driss"
              placeholderTextColor={Colors.textSubtle}
              style={styles.input}
            />
          </View>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Nom</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Alaoui"
            placeholderTextColor={Colors.textSubtle}
            style={styles.simpleInput}
          />
        </View>
      </View>

      <Text style={styles.label}>Téléphone</Text>
      <View style={styles.phoneWrap}>
        <Text style={styles.country}>+212</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="6 12 34 56 78"
          keyboardType="phone-pad"
          style={styles.phoneInput}
          placeholderTextColor={Colors.textSubtle}
        />
      </View>

      <Text style={styles.label}>Email</Text>
      <View style={styles.inputWrap}>
        <Mail size={16} color={Colors.textMuted} />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="driss@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholderTextColor={Colors.textSubtle}
        />
      </View>

      <Text style={styles.label}>Ville</Text>
      <View style={styles.inputWrap}>
        <MapPin size={16} color={Colors.textMuted} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {MOROCCAN_CITIES.map((c) => {
              const active = city === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCity(c)}
                  style={[
                    styles.cityChip,
                    active && {
                      backgroundColor: Colors.primary,
                      borderColor: Colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cityText,
                      active && { color: "white", fontWeight: "600" },
                    ]}
                  >
                    {c}
                  </Text>
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
          placeholder="Min. 6 caractères"
          secureTextEntry
          style={styles.input}
          placeholderTextColor={Colors.textSubtle}
        />
      </View>

      {password.length > 0 && (
        <View style={styles.strengthRow}>
          {[1, 2, 3, 4].map((l) => (
            <View
              key={l}
              style={[
                styles.strengthBar,
                {
                  backgroundColor:
                    passwordLevel >= l
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
      )}

      <Text style={styles.label}>Confirmer le mot de passe</Text>
      <View style={styles.inputWrap}>
        <Lock size={16} color={Colors.textMuted} />
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="••••••••"
          secureTextEntry
          style={styles.input}
          placeholderTextColor={Colors.textSubtle}
        />
        {confirm.length > 0 && confirm === password ? (
          <CheckCircle2 size={18} color={Colors.primary} />
        ) : null}
      </View>

      {confirm.length > 0 && confirm !== password ? (
        <Text style={styles.mismatch}>Les mots de passe ne correspondent pas</Text>
      ) : null}

      <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed((v) => !v)}>
        <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
          {agreed ? <CheckCircle2 size={12} color="white" /> : null}
        </View>
        <Text style={styles.termsText}>
          J'accepte les <Text style={styles.link}>conditions d'utilisation</Text>{" "}
          et la <Text style={styles.link}>politique de confidentialité</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        disabled={!valid}
        onPress={() => router.push("/patient")}
        style={[styles.submit, !valid && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>Créer mon compte</Text>
        <ChevronRight size={18} color="white" />
      </TouchableOpacity>
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
  cityChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "white",
  },
  cityText: { fontSize: 12, color: Colors.textMuted },
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
});
