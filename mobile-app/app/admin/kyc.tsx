import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Check, CircleUserRound, X } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import { Colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import type { ProDocument, Professional, Profile } from "@/lib/db/types";

type QueueItem = {
  professional: Professional;
  profile: Profile | null;
  documents: ProDocument[];
};

export default function KycModerationQueueScreen() {
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const { data: pros, error: prosError } = await supabase
        .from("professionals")
        .select("*")
        .eq("verification_status", "pending")
        .order("created_at", { ascending: true });
      if (prosError) throw prosError;

      const proRows = (pros ?? []) as Professional[];
      if (!proRows.length) {
        setItems([]);
        return;
      }

      const proIds = proRows.map((pro) => pro.id);
      const [docsRes, profilesRes] = await Promise.all([
        supabase
          .from("pro_documents")
          .select("*")
          .in("professional_id", proIds)
          .order("uploaded_at", { ascending: false }),
        supabase.from("profiles").select("*").in("id", proIds),
      ]);
      if (docsRes.error) throw docsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const docs = (docsRes.data ?? []) as ProDocument[];
      const profiles = (profilesRes.data ?? []) as Profile[];
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const docsByPro = new Map<string, ProDocument[]>();

      for (const doc of docs) {
        const bucket = docsByPro.get(doc.professional_id) ?? [];
        bucket.push(doc);
        docsByPro.set(doc.professional_id, bucket);
      }

      const queue: QueueItem[] = proRows.map((professional) => ({
        professional,
        profile: profileMap.get(professional.id) ?? null,
        documents: docsByPro.get(professional.id) ?? [],
      }));
      setItems(queue);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de charger la file KYC.";
      Alert.alert("Erreur", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadQueue();
      const channel = supabase
        .channel(`professionals:kyc`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "professionals",
            filter: `verification_status=eq.pending`,
          },
          () => {
            void loadQueue();
          }
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    }, [loadQueue])
  );

  const updateDecision = async (
    professionalId: string,
    documentId: string,
    decision: "approved" | "rejected"
  ) => {
    if (actingOn) return;
    setActingOn(documentId);
    
    // Save previous state for rollback
    const previousItems = items;
    
    try {
      // Update document verification
      const { error: docError } = await supabase
        .from("pro_documents")
        .update({ is_verified: decision === "approved" })
        .eq("id", documentId);
      if (docError) throw docError;

      // Update professional status
      const { error: proError } = await supabase
        .from("professionals")
        .update({ verification_status: decision })
        .eq("id", professionalId);
      if (proError) throw proError;

      // Log audit (non-critical)
      try {
        const { error: auditError } = await supabase.rpc("log_audit", {
          p_action: decision === "approved" ? "kyc_approve" : "kyc_reject",
          p_table: "professionals",
          p_target: professionalId,
          p_details: { document_id: documentId, decision },
        });
        if (auditError) console.error("log_audit failed:", auditError);
      } catch (e) {
        console.error("log_audit RPC error:", e);
      }

      // Update local state immediately: remove the item from queue
      // since it's no longer "pending"
      setItems(prev => 
        prev.filter(item => item.professional.id !== professionalId)
      );

      Alert.alert(
        "Mise à jour",
        decision === "approved"
          ? "Document approuvé et professionnel validé."
          : "Document rejeté et professionnel refusé."
      );
    } catch (error) {
      // Rollback to previous state on error
      setItems(previousItems);
      const message = error instanceof Error ? error.message : "Action impossible.";
      Alert.alert("Erreur", message);
    } finally {
      setActingOn(null);
    }
  };

  const openDocument = async (storagePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("pro-documents")
        .createSignedUrl(storagePath, 60 * 10);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("URL indisponible.");
      await Linking.openURL(data.signedUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prévisualisation impossible.";
      Alert.alert("Erreur", message);
    }
  };

  const hasPending = useMemo(() => items.length > 0, [items.length]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>File KYC</Text>
      <Text style={styles.subtitle}>Validation des documents des professionnels</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !hasPending ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucune vérification en attente.</Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.professional.id} style={styles.proCard}>
            <View style={styles.proHead}>
              <CircleUserRound size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.proName}>{item.profile?.full_name ?? "Professionnel"}</Text>
                <Text style={styles.proMeta}>
                  {item.professional.specialty} · {item.profile?.city ?? "Ville non définie"}
                </Text>
              </View>
            </View>

            {item.documents.length === 0 ? (
              <Text style={styles.emptyDocText}>Aucun document téléversé.</Text>
            ) : (
              item.documents.map((doc) => (
                <View key={doc.id} style={styles.docRow}>
                  <TouchableOpacity onPress={() => openDocument(doc.storage_path)} style={styles.docLink}>
                    <Text style={styles.docLabel}>{doc.doc_type}</Text>
                    <Text style={styles.docPath}>Prévisualiser</Text>
                  </TouchableOpacity>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.iconBtn, styles.approveBtn, actingOn === doc.id && { opacity: 0.7 }]}
                      onPress={() => updateDecision(item.professional.id, doc.id, "approved")}
                      disabled={actingOn !== null}
                    >
                      {actingOn === doc.id ? (
                        <ActivityIndicator size="small" color={Colors.success} />
                      ) : (
                        <Check size={16} color={Colors.success} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, styles.rejectBtn, actingOn === doc.id && { opacity: 0.7 }]}
                      onPress={() => updateDecision(item.professional.id, doc.id, "rejected")}
                      disabled={actingOn !== null}
                    >
                      {actingOn === doc.id ? (
                        <ActivityIndicator size="small" color={Colors.danger} />
                      ) : (
                        <X size={16} color={Colors.danger} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 12,
  },
  center: {
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    padding: 14,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  proCard: {
    borderRadius: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ECECEC",
    padding: 12,
    marginBottom: 10,
  },
  proHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  proName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  proMeta: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  emptyDocText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  docRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  docLink: {
    flex: 1,
  },
  docLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  docPath: {
    color: Colors.primary,
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  approveBtn: {
    borderColor: "#D2F4E0",
    backgroundColor: "#F2FFF7",
  },
  rejectBtn: {
    borderColor: "#F5D6D6",
    backgroundColor: "#FFF5F5",
  },
});
