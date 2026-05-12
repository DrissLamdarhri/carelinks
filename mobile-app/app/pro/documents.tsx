import { useEffect, useState } from "react";
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
import { ArrowLeft, BadgeCheck, FileText, Upload } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import type { ProDocument } from "@/lib/db/types";

const docTypes = [
  { key: "diploma", label: "Diplôme" },
  { key: "license", label: "Licence" },
  { key: "id", label: "CIN / ID" },
];

export default function ProDocumentsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [docType, setDocType] = useState("diploma");
  const [storagePath, setStoragePath] = useState("");
  const [documents, setDocuments] = useState<ProDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadDocuments = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      try {
        await db.pros.upsert({ id: user.id, specialty: "nurse" });
        const rows = await db.proDocuments.listForPro(user.id);
        setDocuments(rows);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Chargement des documents impossible.");
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [user?.id]);

  const handleCreateDocument = async () => {
    if (!user?.id || !storagePath.trim().length || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await db.pros.upsert({ id: user.id, specialty: "nurse" });
      const next = await db.proDocuments.create({
        professional_id: user.id,
        doc_type: docType,
        storage_path: storagePath.trim(),
      });
      setDocuments((prev) => [next, ...prev]);
      setStoragePath("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Ajout du document impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Documents & certifications</Text>
          <Text style={styles.subtitle}>KYC et vérification professionnelle</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Ajouter un document</Text>
        <View style={styles.chipsRow}>
          {docTypes.map((item) => {
            const active = item.key === docType;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setDocType(item.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          value={storagePath}
          onChangeText={setStoragePath}
          style={styles.input}
          placeholder="storage/pro-docs/your-file.pdf"
          placeholderTextColor={Colors.textSubtle}
        />
        <TouchableOpacity
          disabled={!storagePath.trim().length || submitting}
          onPress={handleCreateDocument}
          style={[styles.uploadBtn, (!storagePath.trim().length || submitting) && styles.uploadBtnDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Upload size={16} color="white" />
              <Text style={styles.uploadText}>Enregistrer le document</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.listTitle}>Mes documents</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : null}

      {!loading &&
        documents.map((doc) => (
          <View key={doc.id} style={styles.docCard}>
            <View style={styles.docIconWrap}>
              <FileText size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docType}>{doc.doc_type}</Text>
              <Text style={styles.docPath}>{doc.storage_path}</Text>
            </View>
            <View style={styles.statusWrap}>
              <BadgeCheck size={14} color={doc.is_verified ? Colors.success : Colors.warning} />
              <Text style={[styles.statusText, { color: doc.is_verified ? Colors.success : Colors.warning }]}>
                {doc.is_verified ? "Vérifié" : "En attente"}
              </Text>
            </View>
          </View>
        ))}

      {!loading && documents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucun document pour le moment.</Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular" },
  subtitle: { color: Colors.textMuted, fontSize: 12 },
  formCard: { backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border },
  formTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  chipsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "white",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.surfaceWarm },
  chipText: { color: Colors.textMuted, fontSize: 12 },
  chipTextActive: { color: Colors.primary, fontWeight: "600" },
  input: {
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  uploadBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadText: { color: "white", fontWeight: "600", fontSize: 13 },
  listTitle: { marginTop: 14, marginBottom: 8, fontSize: 14, color: Colors.textPrimary, fontWeight: "700" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  docCard: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  docIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  docType: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  docPath: { color: Colors.textMuted, fontSize: 11 },
  statusWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusText: { fontSize: 11, fontWeight: "600" },
  emptyCard: { backgroundColor: "white", borderRadius: 14, padding: 14, alignItems: "center" },
  emptyText: { color: Colors.textMuted, fontSize: 12 },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
