import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowLeft, FileText, Shield } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { showToast } from "@/lib/toast";

const POLICY_VERSION = "2026-05-30";

const POLICY_TEXT = [
  "CareLink protège vos données personnelles et médicales conformément à la réglementation.",
  "Vos informations sont partagées uniquement avec les professionnels nécessaires à votre prise en charge.",
  "Vous pouvez modifier vos consentements à tout moment depuis cette page.",
];

export default function PatientPolicyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [shareData, setShareData] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [acceptedVersion, setAcceptedVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      setErrorMessage(null);
      try {
        const profile = await db.profiles.get(user.id);
        if (!active) return;
        setShareData(profile.consent_share_data ?? true);
        setReminders(profile.consent_reminders ?? true);
        setAnalytics(profile.consent_analytics ?? true);
        setAcceptedAt(profile.policy_accepted_at ?? null);
        setAcceptedVersion(profile.policy_version ?? null);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "Politique indisponible.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const now = new Date().toISOString();
      const updated = await db.profiles.update(user.id, {
        policy_version: POLICY_VERSION,
        policy_accepted_at: now,
        consent_share_data: shareData,
        consent_reminders: reminders,
        consent_analytics: analytics,
      });
      setAcceptedAt(updated.policy_accepted_at ?? now);
      setAcceptedVersion(updated.policy_version ?? POLICY_VERSION);
      showToast("Préférences enregistrées.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  };

  const acceptedLabel = acceptedAt
    ? `Acceptée le ${new Date(acceptedAt).toLocaleDateString("fr-MA")}`
    : "Non acceptée";
  const versionLabel = acceptedVersion ? `Version ${acceptedVersion}` : `Version ${POLICY_VERSION}`;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Politique patient</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : null}

      {!loading ? (
        <>
          <View style={styles.card}>
            <View style={styles.policyHeader}>
              <FileText size={18} color={Colors.primary} />
              <View>
                <Text style={styles.policyTitle}>Politique de confidentialité</Text>
                <Text style={styles.policyMeta}>{versionLabel}</Text>
                <Text style={styles.policyMeta}>{acceptedLabel}</Text>
              </View>
            </View>
            {POLICY_TEXT.map((line) => (
              <Text key={line} style={styles.policyText}>
                {line}
              </Text>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Consentements</Text>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Shield size={16} color={Colors.primary} />
                <View>
                  <Text style={styles.label}>Partage des données médicales</Text>
                  <Text style={styles.helper}>Autoriser les professionnels à accéder à votre dossier.</Text>
                </View>
              </View>
              <Switch
                value={shareData}
                onValueChange={setShareData}
                trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Shield size={16} color={Colors.primary} />
                <View>
                  <Text style={styles.label}>Rappels et notifications</Text>
                  <Text style={styles.helper}>Recevoir des rappels de rendez-vous et soins.</Text>
                </View>
              </View>
              <Switch
                value={reminders}
                onValueChange={setReminders}
                trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Shield size={16} color={Colors.primary} />
                <View>
                  <Text style={styles.label}>Analyse anonyme</Text>
                  <Text style={styles.helper}>Aider à améliorer CareLink sans données identifiantes.</Text>
                </View>
              </View>
              <Switch
                value={analytics}
                onValueChange={setAnalytics}
                trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving || loading}>
        {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveText}>Accepter & enregistrer</Text>}
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
  policyHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  policyTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  policyMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  policyText: { color: Colors.textPrimary, fontSize: 12, lineHeight: 18, marginTop: 6 },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F4",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  label: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  helper: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
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
