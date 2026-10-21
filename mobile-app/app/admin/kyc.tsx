import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleUserRound,
  Clock,
  Info,
  ScanText,
  X,
  XCircle,
} from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import { Colors } from "@/lib/colors";
import { useI18n, trFor } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db/dal";
import { showAppAlert } from "@/lib/app-alert";
import type { ProDocument, Professional, Profile } from "@/lib/db/types";
import {
  crossCheckKyc,
  docKind,
  ocrState,
  type CheckItem,
  type CrossCheckResult,
  type KycOcrRow,
  type OcrStatus,
} from "@/lib/kycCrossCheck";

type QueueItem = {
  professional: Professional;
  profile: Profile | null;
  documents: ProDocument[];
};

const OCR_STATE_STYLE: Record<OcrStatus, { key: string; bg: string; color: string }> = {
  pending: { key: "kyc_ocr_pending", bg: "#F3F3F5", color: "#888780" },
  processing: { key: "kyc_ocr_processing", bg: "#EEF2FF", color: "#3B42C5" },
  done: { key: "kyc_ocr_done", bg: "#DCFCE7", color: "#16A34A" },
  error: { key: "kyc_ocr_error", bg: "#FDE8E8", color: "#E24B4A" },
};

const OCR_FIELDS: Record<"cin" | "diploma", [field: string, labelKey: string][]> = {
  cin: [
    ["nom", "kyc_f_last_name"],
    ["prenom", "kyc_f_first_name"],
    ["nom_complet", "kyc_f_full_name"],
    ["nom_arabe", "kyc_f_last_name_ar"],
    ["prenom_arabe", "kyc_f_first_name_ar"],
    ["numero_cin", "kyc_f_cin_number"],
    ["date_naissance", "kyc_f_birth_date"],
    ["lieu_naissance", "kyc_f_birth_place"],
    ["date_expiration", "kyc_f_expiry"],
  ],
  diploma: [
    ["nom_titulaire", "kyc_f_holder"],
    ["nom_titulaire_arabe", "kyc_f_holder_ar"],
    ["intitule", "kyc_f_title"],
    ["etablissement", "kyc_f_school"],
    ["annee", "kyc_f_year"],
    ["numero_cin", "kyc_f_cin_number"],
  ],
};

const CHECK_LABEL_KEYS: Record<CheckItem["key"], string> = {
  cin_read: "kyc_chk_cin_read",
  diploma_read: "kyc_chk_diploma_read",
  name_profile_cin: "kyc_chk_name_profile_cin",
  name_profile_diploma: "kyc_chk_name_profile_diploma",
  name_cin_diploma: "kyc_chk_name_cin_diploma",
  cin_expiry: "kyc_chk_cin_expiry",
  cin_number_diploma: "kyc_chk_cin_number",
  diploma_specialty: "kyc_chk_specialty",
  alerts: "kyc_chk_alerts",
};

const CHECK_NOTE_KEYS: Record<NonNullable<CheckItem["note"]>, string> = {
  missing: "kyc_note_missing",
  not_analyzed: "kyc_ocr_pending",
  processing: "kyc_ocr_processing",
  error: "kyc_ocr_error",
  illegible: "kyc_illegible",
  wrong_document: "kyc_note_wrong_document",
  expired: "kyc_note_expired",
  not_found_on_document: "kyc_illegible",
  name_not_found: "kyc_note_name_not_found",
  name_partial: "kyc_note_name_partial",
  name_not_isolated: "kyc_note_name_not_isolated",
  not_on_diploma: "kyc_note_not_on_diploma",
  ocr_slip: "kyc_note_ocr_slip",
};

const VERDICT_STYLE: Record<CrossCheckResult["verdict"], { key: string; bg: string; border: string; color: string }> = {
  ok: { key: "kyc_verdict_ok", bg: "#F0FDF4", border: "#BBF7D0", color: "#16A34A" },
  warn: { key: "kyc_verdict_warn", bg: "#FFFBEB", border: "#FDE68A", color: "#B45309" },
  fail: { key: "kyc_verdict_fail", bg: "#FEF2F2", border: "#FECACA", color: "#E24B4A" },
  pending: { key: "kyc_verdict_pending", bg: "#F8F8FC", border: "#ECECF3", color: "#3B42C5" },
};

const latestStamp = (r?: KycOcrRow) =>
  r ? Math.max(Date.parse(r.requested_at), r.ocr_at ? Date.parse(r.ocr_at) : 0) : -1;

export default function KycModerationQueueScreen() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  // pro_document_ocr rows by document id, kept live by Realtime (+ polling)
  // The OCR itself runs in the WEB admin's browser (Tesseract.js, migration
  // 0057) — it can't run in React Native. This screen shows the results.
  const [ocrRows, setOcrRows] = useState<Record<string, KycOcrRow>>({});

  // Rows arrive from the load, Realtime and polling in any order — keep the
  // most recent version of each.
  const mergeOcr = useCallback((rows: KycOcrRow[]) => {
    setOcrRows((prev) => {
      const next = { ...prev };
      for (const r of rows) if (latestStamp(r) >= latestStamp(next[r.document_id])) next[r.document_id] = r;
      return next;
    });
  }, []);

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

      // OCR results — best-effort, the queue works without them
      const rows = await db.kycOcr.listForPros(proIds).catch((e) => {
        console.warn("Could not load OCR results:", e);
        return [] as KycOcrRow[];
      });
      mergeOcr(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("cannot_load_kyc_queue");
      showAppAlert(t("error"), message);
    } finally {
      setLoading(false);
    }
  }, [mergeOcr]);

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
        // OCR progress (pending → processing → done | error); RLS on
        // pro_document_ocr means only admins receive these.
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pro_document_ocr" },
          (payload) => {
            const row = payload.new as KycOcrRow | undefined;
            if (row?.document_id) mergeOcr([row]);
          }
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    }, [loadQueue, mergeOcr])
  );

  // Polling fallback (3 s) while the web admin is analysing a document —
  // covers a project where Realtime isn't enabled for pro_document_ocr.
  const proIdsKey = items.map((i) => i.professional.id).join(",");
  const waitingForOcr = items.some((item) =>
    item.documents.some((d) => docKind(d.doc_type) && ocrState(ocrRows[d.id]) === "processing")
  );
  useEffect(() => {
    if (!waitingForOcr || !proIdsKey) return;
    const id = setInterval(() => {
      db.kycOcr.listForPros(proIdsKey.split(",")).then(mergeOcr).catch((e) =>
        console.warn("OCR polling failed:", e)
      );
    }, 3000);
    return () => clearInterval(id);
  }, [waitingForOcr, proIdsKey, mergeOcr]);


  const checkDetail = (c: CheckItem): string | null => {
    const parts: string[] = [];
    if (c.note) parts.push(t(CHECK_NOTE_KEYS[c.note]));
    else if (c.status === "unreadable") parts.push(t("kyc_illegible"));
    if (c.key === "cin_expiry" && c.read) {
      parts.push(c.status === "ok" ? t("kyc_valid_until").replace("%s", c.read) : c.read);
    }
    else if (c.read && c.expected && c.status !== "ok" && c.key !== "diploma_specialty") {
      parts.push(t("kyc_read_vs_expected").replace("%r", c.read).replace("%e", c.expected));
    } else if (c.read) parts.push(`« ${c.read} »`);
    else if (c.expected && c.key.startsWith("name_")) parts.push(`« ${c.expected} »`); // searched in the raw text
    if (c.detail) parts.push(c.detail);
    return parts.length ? parts.join(" — ") : null;
  };

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

      // Notify the pro (in-app + email + WhatsApp) — server-side, best-effort.
      // If the function is unreachable, or it reports that its in-app channel
      // failed, insert the notification directly so an approved pro is never
      // left uninformed. Never let a notification failure fail the approval.
      try {
        const { data, error: fnError } = await supabase.functions.invoke("notify-pro-status", {
          body: { proId: professionalId, decision },
        });
        const inApp = data?.result?.notification;
        if (fnError || (typeof inApp === "string" && inApp.startsWith("error"))) {
          throw fnError ?? new Error(String(inApp));
        }
      } catch (e) {
        console.warn("notify-pro-status failed — falling back to direct notification:", e);
        // This notification is read by the PRO, not by the admin sitting here,
        // so it has to be written in the pro's language — `t()` would use the
        // admin's. Falls back to the app default if they never picked one.
        const { data: proProfile } = await supabase
          .from("profiles")
          .select("language")
          .eq("id", professionalId)
          .maybeSingle();
        const proLang = proProfile?.language ?? null;
        await supabase.from("notifications").insert({
          user_id: professionalId,
          kind: "system",
          title: decision === "approved"
            ? `${trFor(proLang, "admin_account_approved")} \u2705`
            : trFor(proLang, "kyc_rejected_title"),
          body: trFor(
            proLang,
            decision === "approved" ? "admin_kyc_approved_body" : "admin_kyc_rejected_body",
          ),
          payload: { decision },
        });
      }

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

      showAppAlert(
        t("update_title"),
        decision === "approved"
          ? t("doc_approved_msg")
          : t("doc_rejected_msg")
      );
    } catch (error) {
      // Rollback to previous state on error
      setItems(previousItems);
      const message = error instanceof Error ? error.message : t("action_failed");
      showAppAlert(t("error"), message);
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
      if (!data?.signedUrl) throw new Error(t("admin_url_unavailable"));
      await Linking.openURL(data.signedUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("preview_failed");
      showAppAlert(t("error"), message);
    }
  };

  const hasPending = useMemo(() => items.length > 0, [items.length]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("kyc_queue")}</Text>
      <Text style={styles.subtitle}>{t("validate_pro_docs")}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !hasPending ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t("no_pending_verification")}</Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.professional.id} style={styles.proCard}>
            <View style={styles.proHead}>
              <CircleUserRound size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.proName}>{item.profile?.full_name ?? t("professional")}</Text>
                <Text style={styles.proMeta}>
                  {item.professional.specialty} · {item.profile?.city ?? t("city_undefined")}
                </Text>
              </View>
            </View>

            {item.documents.some((d) => docKind(d.doc_type)) ? (
              <CrossCheckCard
                result={crossCheckKyc({
                  fullName: item.profile?.full_name,
                  specialty: item.professional.specialty,
                  documents: item.documents,
                  ocrByDoc: ocrRows,
                })}
                t={t}
                detailOf={checkDetail}
              />
            ) : null}

            {item.documents.length === 0 ? (
              <Text style={styles.emptyDocText}>{t("no_doc_uploaded")}</Text>
            ) : (
              item.documents.map((doc) => (
                <View key={doc.id} style={styles.docRow}>
                  <View style={styles.docTop}>
                  <TouchableOpacity onPress={() => openDocument(doc.storage_path)} style={styles.docLink}>
                    <Text style={styles.docLabel}>{doc.doc_type}</Text>
                    <Text style={styles.docPath}>{t("preview")}</Text>
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
                  {docKind(doc.doc_type) ? (
                    <OcrBlock row={ocrRows[doc.id]} t={t} />
                  ) : null}
                </View>
              ))
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

type T = (key: string) => string;

function OcrBlock({ row, t }: { row?: KycOcrRow; t: T }) {
  const state: OcrStatus = ocrState(row);
  const s = OCR_STATE_STYLE[state];
  const data = state === "done" ? row?.ocr_data ?? null : null;
  const values = data as Record<string, unknown> | null;
  const fields = data ? OCR_FIELDS[data.kind].filter(([f]) => values?.[f]) : [];
  return (
    <View style={styles.ocrBlock}>
      <View style={styles.ocrHead}>
        <View style={[styles.pill, { backgroundColor: s.bg }]}>
          {state === "processing" ? (
            <ActivityIndicator size="small" color={s.color} style={{ transform: [{ scale: 0.6 }] }} />
          ) : (
            <ScanText size={12} color={s.color} />
          )}
          <Text style={[styles.pillText, { color: s.color }]}>{t(s.key)}</Text>
        </View>
        {data && !data.lisible ? <Text style={styles.illegible}>{t("kyc_ocr_illegible_doc")}</Text> : null}
      </View>
      {state === "error" && row?.ocr_error ? <Text style={styles.ocrError}>{row.ocr_error}</Text> : null}
      {state === "pending" || state === "error" ? <Text style={styles.webHint}>{t("kyc_ocr_web_only")}</Text> : null}
      {fields.map(([f, labelKey]) => (
        <Text key={f} style={styles.field}>
          <Text style={styles.fieldLabel}>{t(labelKey)} : </Text>
          {String(values?.[f])}
        </Text>
      ))}
      {data?.alertes.map((a, i) => (
        <View key={i} style={styles.alertRow}>
          <AlertTriangle size={12} color="#B45309" />
          <Text style={styles.alertText}>{a}</Text>
        </View>
      ))}
    </View>
  );
}

function CrossCheckCard({ result, t, detailOf }: {
  result: CrossCheckResult;
  t: T;
  detailOf: (c: CheckItem) => string | null;
}) {
  const v = VERDICT_STYLE[result.verdict];
  const Icon = result.verdict === "ok" ? CheckCircle2
    : result.verdict === "fail" ? XCircle
    : result.verdict === "pending" ? Clock : AlertTriangle;
  return (
    <View style={[styles.crossCard, { backgroundColor: v.bg, borderColor: v.border }]}>
      <View style={styles.crossHead}>
        <Icon size={16} color={v.color} />
        <Text style={[styles.crossTitle, { color: v.color }]}>
          {t("kyc_cross_check")} : {t(v.key)}
        </Text>
      </View>
      <Text style={styles.crossHint}>{t("kyc_disclaimer")}</Text>
      {result.checks.map((c) => {
        const detail = detailOf(c);
        const StatusIcon = c.status === "ok" ? Check
          : c.status === "fail" ? X
          : c.status === "pending" ? Clock
          : c.status === "unreadable" ? AlertCircle
          : c.status === "info" ? Info : AlertTriangle;
        const color = c.status === "ok" ? "#16A34A"
          : c.status === "fail" ? "#E24B4A"
          : c.status === "pending" ? "#3B42C5"
          : c.status === "unreadable" || c.status === "info" ? "#888780" : "#B45309";
        return (
          <View key={c.key} style={styles.checkRow}>
            <StatusIcon size={13} color={color} style={{ marginTop: 2 }} />
            <Text style={styles.checkText}>
              <Text style={styles.checkLabel}>{t(CHECK_LABEL_KEYS[c.key])}</Text>
              {detail ? <Text style={styles.checkDetail}> — {detail}</Text> : null}
            </Text>
          </View>
        );
      })}
    </View>
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
  },
  docTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ocrBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 4,
  },
  ocrHead: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  illegible: {
    color: "#B45309",
    fontSize: 11,
    fontWeight: "600",
  },
  webHint: {
    color: Colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
  },
  ocrError: {
    color: "#E24B4A",
    fontSize: 12,
  },
  field: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    writingDirection: "auto",
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontWeight: "400",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  alertText: {
    flex: 1,
    color: "#B45309",
    fontSize: 12,
  },
  crossCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    gap: 4,
  },
  crossHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  crossTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  crossHint: {
    color: "#555555",
    fontSize: 11,
    marginBottom: 4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  checkText: {
    flex: 1,
    fontSize: 12,
  },
  checkLabel: {
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  checkDetail: {
    color: Colors.textMuted,
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
