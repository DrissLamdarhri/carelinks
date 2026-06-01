import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowLeft, Calendar, MapPin, Phone, User } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { showToast } from "@/lib/toast";

const genderOptions = [
  { label: "Femme", value: "female" },
  { label: "Homme", value: "male" },
  { label: "Autre", value: "other" },
];

export default function PatientProfileInfosScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<string>("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      setErrorMessage(null);
      try {
        const [profile, patient] = await Promise.all([
          db.profiles.get(user.id),
          db.patients.get(user.id),
        ]);
        if (!active) return;
        const nameParts = (profile.full_name ?? "").split(" ");
        setFirstName(nameParts[0] ?? "");
        setLastName(nameParts.slice(1).join(" "));
        setPhone(profile.phone ?? "");
        setCity(profile.city ?? "");
        setEmail(profile.email ?? user.email ?? "");
        setDob(patient?.date_of_birth ?? "");
        setGender(patient?.gender ?? "");
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "Profil indisponible.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [user?.email, user?.id]);

  const fullName = useMemo(() => `${firstName} ${lastName}`.trim(), [firstName, lastName]);
  const validDob = !dob || /^\d{4}-\d{2}-\d{2}$/.test(dob.trim());

  const handleSave = async () => {
    if (!user?.id || saving) return;
    if (!fullName) {
      setErrorMessage("Veuillez renseigner votre nom complet.");
      return;
    }
    if (!validDob) {
      setErrorMessage("Date de naissance invalide (YYYY-MM-DD).");
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      await db.profiles.update(user.id, {
        full_name: fullName,
        phone: phone.trim() || null,
        city: city.trim() || null,
      });
      await db.patients.upsert({
        id: user.id,
        date_of_birth: dob.trim() || null,
        gender: gender || null,
      });
      await refreshProfile();
      showToast("Profil mis à jour.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Informations personnelles</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : null}

      {!loading ? (
        <View style={styles.card}>
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

          <Text style={styles.label}>Nom</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Alaoui"
            placeholderTextColor={Colors.textSubtle}
            style={styles.simpleInput}
          />

          <Text style={styles.label}>Téléphone</Text>
          <View style={styles.inputWrap}>
            <Phone size={16} color={Colors.textMuted} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+212 6 12 34 56 78"
              placeholderTextColor={Colors.textSubtle}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>Ville</Text>
          <View style={styles.inputWrap}>
            <MapPin size={16} color={Colors.textMuted} />
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Meknès"
              placeholderTextColor={Colors.textSubtle}
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput value={email} editable={false} style={styles.simpleInputMuted} />

          <Text style={styles.label}>Date de naissance</Text>
          <View style={styles.inputWrap}>
            <Calendar size={16} color={Colors.textMuted} />
            <TextInput
              value={dob}
              onChangeText={setDob}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textSubtle}
              style={styles.input}
            />
          </View>
          {!validDob ? <Text style={styles.errorText}>Format attendu : YYYY-MM-DD.</Text> : null}

          <Text style={styles.label}>Genre</Text>
          <View style={styles.chipsRow}>
            {genderOptions.map((option) => {
              const active = gender === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setGender(option.value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving || loading}>
        {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveText}>Enregistrer</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular" },
  center: { paddingVertical: 40, alignItems: "center" },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 12,
  },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  simpleInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    color: Colors.textPrimary,
  },
  simpleInputMuted: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    color: Colors.textMuted,
  },
  chipsRow: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "white",
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "white" },
  saveBtn: {
    marginTop: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "white", fontSize: 14, fontWeight: "600" },
  errorText: { color: Colors.danger, fontSize: 12, marginTop: 8 },
});
