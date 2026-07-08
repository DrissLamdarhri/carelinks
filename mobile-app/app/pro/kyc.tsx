import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { ArrowLeft, CircleCheck, CircleDashed, CircleX, Upload, FileText } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import type { ProDocument, Professional } from "@/lib/db/types";
import { supabase } from "@/lib/supabase";

type DocKey = "diploma" | "license" | "id";

const documentTypes: { key: DocKey; label: string }[] = [
  { key: "diploma", label: "Diplôme" },
  { key: "license", label: "Licence professionnelle" },
  { key: "id", label: "Pièce d'identité" },
];

export default function KycUploaderScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<DocKey | null>(null);
  const [documents, setDocuments] = useState<ProDocument[]>([]);
  const [professional, setProfessional] = useState<Professional | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pro = await db.pros.get(user.id);
      if (pro) {
        setProfessional(pro);
      } else {
        const created = await db.pros.upsert({ id: user.id, specialty: "nurse" });
        setProfessional(created);
      }
      const docs = await db.proDocuments.listForPro(user.id);
      setDocuments(docs);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("cannot_load_kyc");
      Alert.alert("Erreur", message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const latestByType = useMemo(() => {
    const map = new Map<string, ProDocument>();
    for (const doc of documents) {
      if (!map.has(doc.doc_type)) map.set(doc.doc_type, doc);
    }
    return map;
  }, [documents]);

  const statusForType = (docType: string) => {
    const doc = latestByType.get(docType);
    if (!doc) return "pending";
    if (doc.is_verified) return "verified";
    if (professional?.verification_status === "rejected") return "rejected";
    return "pending";
  };

  const uploadDocument = async (docType: DocKey) => {
    if (!user?.id) return;
    if (uploadingType) return;
    setUploadingType(docType);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: "*/*",
      });

      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset) return;

      const extension = asset.name.includes(".")
        ? asset.name.split(".").pop()
        : "bin";
      const storagePath = `${user.id}/${docType}-${Date.now()}.${extension}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("pro-documents")
        .upload(storagePath, blob, {
          contentType: asset.mimeType ?? "application/octet-stream",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("pro_documents").insert({
        professional_id: user.id,
        doc_type: docType,
        storage_path: storagePath,
        is_verified: false,
      });
      if (insertError) throw insertError;

      Alert.alert(t("document_added_short"), t("doc_sent_verification"));
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("upload_failed");
      Alert.alert("Erreur", message);
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{t("kyc_verification")}</Text>
          <Text style={styles.subtitle}>{t("upload_pro_docs")}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <>
          {documentTypes.map((item) => {
            const status = statusForType(item.key);
            return (
              <View key={item.key} style={styles.docCard}>
                <View style={styles.docHead}>
                  <Text style={styles.docTitle}>{item.label}</Text>
                  <View style={styles.statusPill}>
                    {status === "verified" ? (
                      <CircleCheck size={14} color={Colors.success} />
                    ) : status === "rejected" ? (
                      <CircleX size={14} color={Colors.danger} />
                    ) : (
                      <CircleDashed size={14} color={Colors.warning} />
                    )}
                    <Text
                      style={[
                        styles.statusText,
                        status === "verified"
                          ? { color: Colors.success }
                          : status === "rejected"
                            ? { color: Colors.danger }
                            : { color: Colors.warning },
                      ]}
                    >
                      {status === "verified"
                        ? "Vérifié"
                        : status === "rejected"
                          ? "Rejeté"
                          : "En attente"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.uploadBtn, uploadingType === item.key && { opacity: 0.7 }]}
                  onPress={() => uploadDocument(item.key)}
                  disabled={uploadingType !== null}
                >
                  {uploadingType === item.key ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Upload size={15} color="white" />
                      <Text style={styles.uploadBtnText}>{t("upload")}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}

          <Text style={styles.listTitle}>{t("docs_sent")}</Text>
          {documents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t("no_docs_sent")}</Text>
            </View>
          ) : (
            documents.map((doc) => (
              <View key={doc.id} style={styles.sentCard}>
                <FileText size={16} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sentTitle}>{doc.doc_type}</Text>
                  <Text style={styles.sentPath}>{doc.storage_path}</Text>
                </View>
                <Text style={styles.sentDate}>
                  {new Date(doc.uploaded_at).toLocaleDateString("fr-MA")}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surfaceWarm,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  center: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  docCard: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    padding: 12,
    marginBottom: 8,
  },
  docHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  docTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  uploadBtn: {
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  uploadBtnText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  listTitle: {
    marginTop: 14,
    marginBottom: 8,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: "white",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  sentCard: {
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ECECEC",
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sentTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  sentPath: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  sentDate: {
    color: Colors.textSubtle,
    fontSize: 10,
  },
});
