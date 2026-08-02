/**
 * Admin dispute/complaint resolution queue. Every "Signaler un problème" /
 * "Signaler un patient" filed from the patient or pro side (file_dispute RPC,
 * migration 0040) lands here — this is the first real place an admin can
 * actually see and close one out, instead of the old dormant dispute_open
 * flag nothing ever surfaced.
 */
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Clock3, ShieldAlert, X } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { db, type Dispute, type DisputeStatus } from "@/lib/db/dal";
import type { Profile } from "@/lib/db/types";

const STATUS_META: Record<DisputeStatus, { label: string; color: string; bg: string }> = {
  open: { label: "Ouvert", color: "#D97706", bg: "#FFF7E6" },
  under_review: { label: "En cours", color: "#2563EB", bg: "#DBEAFE" },
  resolved_refund: { label: "Remboursé", color: "#16A34A", bg: "#DCFCE7" },
  resolved_warning: { label: "Averti", color: "#7C3AED", bg: "#F3EEFE" },
  resolved_dismissed: { label: "Rejeté", color: "#6B7280", bg: "#F3F4F6" },
};

const CATEGORY_LABEL: Record<string, string> = {
  late_arrival: "Retard",
  no_show: "Absence",
  safety_incident: "Incident de sécurité",
  poor_conduct: "Comportement",
  quality_issue: "Qualité du service",
  price_dispute: "Litige de prix",
  property_damage: "Dommage matériel",
  harassment: "Harcèlement",
  identity_mismatch: "Identité non conforme",
  payment_issue: "Problème de paiement",
  other: "Autre",
};

export default function AdminDisputesScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"pending" | "resolved">("pending");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Dispute[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refunds, setRefunds] = useState<Record<string, string>>({});
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await db.disputes.listAll();
      setItems(all);
      const ids = Array.from(
        new Set(all.flatMap((d) => [d.reporter_id, d.against_id].filter(Boolean) as string[])),
      );
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("*").in("id", ids);
        setProfiles(new Map((data ?? []).map((p: Profile) => [p.id, p])));
      }
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de charger les litiges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const channel = supabase
        .channel("admin-disputes")
        .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => void load())
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    }, [load]),
  );

  const pending = useMemo(() => items.filter((d) => d.status === "open" || d.status === "under_review"), [items]);
  const resolved = useMemo(() => items.filter((d) => d.status.startsWith("resolved")), [items]);
  const visible = tab === "pending" ? pending : resolved;

  const openEvidence = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from("dispute-evidence").createSignedUrl(path, 600);
      if (error) throw error;
      if (data?.signedUrl) await Linking.openURL(data.signedUrl);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Aperçu impossible.");
    }
  };

  const act = async (
    d: Dispute,
    status: Extract<DisputeStatus, "under_review" | "resolved_refund" | "resolved_warning" | "resolved_dismissed">,
  ) => {
    if (actingOn) return;
    const note = (notes[d.id] ?? "").trim();
    if (status !== "under_review" && !note) {
      Alert.alert("Note requise", "Ajoutez une courte note expliquant la décision avant de résoudre ce litige.");
      return;
    }
    const refundStr = refunds[d.id];
    const refund = status === "resolved_refund" && refundStr ? Number(refundStr) : null;
    if (status === "resolved_refund" && refundStr && Number.isNaN(refund)) {
      Alert.alert("Montant invalide", "Le montant du remboursement doit être un nombre.");
      return;
    }
    setActingOn(d.id);
    try {
      await db.disputes.resolve(d.id, status, note || "Pris en charge.", refund);
      setExpanded(null);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setActingOn(null);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Litiges</Text>
      <Text style={styles.subtitle}>Signalements des patients et des professionnels.</Text>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tabBtn, tab === "pending" && styles.tabBtnActive]} onPress={() => setTab("pending")}>
          <Text style={[styles.tabTxt, tab === "pending" && styles.tabTxtActive]}>À traiter ({pending.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === "resolved" && styles.tabBtnActive]} onPress={() => setTab("resolved")}>
          <Text style={[styles.tabTxt, tab === "resolved" && styles.tabTxtActive]}>Résolus ({resolved.length})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : visible.length === 0 ? (
        <View style={styles.emptyCard}>
          <ShieldAlert size={20} color={Colors.textMuted} />
          <Text style={styles.emptyText}>{tab === "pending" ? "Aucun litige en attente." : "Aucun litige résolu pour l'instant."}</Text>
        </View>
      ) : (
        visible.map((d) => {
          const sm = STATUS_META[d.status];
          const reporter = profiles.get(d.reporter_id);
          const against = d.against_id ? profiles.get(d.against_id) : null;
          const isOpen = expanded === d.id;
          const busy = actingOn === d.id;
          return (
            <View key={d.id} style={styles.card}>
              <TouchableOpacity style={styles.cardHead} onPress={() => setExpanded(isOpen ? null : d.id)}>
                <View style={[styles.statusDot, { backgroundColor: sm.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{CATEGORY_LABEL[d.category] ?? d.category}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {d.reporter_role === "patient" ? "Patient" : "Pro"} {reporter?.full_name ?? "?"}
                    {against ? ` → ${against.full_name}` : ""}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: sm.bg }]}>
                  <Text style={[styles.statusPillTxt, { color: sm.color }]}>{sm.label}</Text>
                </View>
                {isOpen ? <ChevronUp size={16} color={Colors.textMuted} /> : <ChevronDown size={16} color={Colors.textMuted} />}
              </TouchableOpacity>

              {isOpen ? (
                <View style={styles.cardBody}>
                  <Text style={styles.description}>{d.description}</Text>

                  {d.evidence_paths.length ? (
                    <View style={styles.evidenceRow}>
                      {d.evidence_paths.map((p) => (
                        <TouchableOpacity key={p} style={styles.evidenceChip} onPress={() => openEvidence(p)}>
                          <Text style={styles.evidenceChipTxt}>Photo</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  {d.resolution_note ? (
                    <View style={styles.resolutionBox}>
                      <Text style={styles.resolutionLabel}>Résolution</Text>
                      <Text style={styles.resolutionTxt}>{d.resolution_note}</Text>
                      {d.refund_amount_mad ? (
                        <Text style={styles.resolutionTxt}>Remboursement : {d.refund_amount_mad} MAD</Text>
                      ) : null}
                    </View>
                  ) : (
                    <>
                      <TextInput
                        style={styles.noteInput}
                        placeholder="Note de résolution (visible par le déclarant)"
                        placeholderTextColor={Colors.textSubtle}
                        multiline
                        value={notes[d.id] ?? ""}
                        onChangeText={(v) => setNotes((prev) => ({ ...prev, [d.id]: v }))}
                      />
                      <TextInput
                        style={styles.refundInput}
                        placeholder="Montant du remboursement (MAD, optionnel)"
                        placeholderTextColor={Colors.textSubtle}
                        keyboardType="numeric"
                        value={refunds[d.id] ?? ""}
                        onChangeText={(v) => setRefunds((prev) => ({ ...prev, [d.id]: v }))}
                      />

                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={[styles.actBtn, styles.actBtnMuted]}
                          disabled={busy}
                          onPress={() => act(d, "under_review")}
                        >
                          <Clock3 size={14} color={Colors.textPrimary} />
                          <Text style={styles.actBtnTxt}>Prendre en charge</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={[styles.actBtn, styles.actBtnRefund]}
                          disabled={busy}
                          onPress={() => act(d, "resolved_refund")}
                        >
                          {busy ? <ActivityIndicator size="small" color="#16A34A" /> : <Check size={14} color="#16A34A" />}
                          <Text style={[styles.actBtnTxt, { color: "#16A34A" }]}>Rembourser</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actBtn, styles.actBtnWarn]}
                          disabled={busy}
                          onPress={() => act(d, "resolved_warning")}
                        >
                          <AlertTriangle size={14} color="#7C3AED" />
                          <Text style={[styles.actBtnTxt, { color: "#7C3AED" }]}>Avertir</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actBtn, styles.actBtnDismiss]}
                          disabled={busy}
                          onPress={() => act(d, "resolved_dismissed")}
                        >
                          <X size={14} color={Colors.danger} />
                          <Text style={[styles.actBtnTxt, { color: Colors.danger }]}>Rejeter</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  title: { color: Colors.textPrimary, fontSize: 22, fontFamily: "DMSerifDisplay_400Regular" },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginBottom: 14 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tabBtn: { flex: 1, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "white" },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.textMuted },
  tabTxtActive: { color: "#FFFFFF" },
  center: { paddingVertical: 30, alignItems: "center", justifyContent: "center" },
  emptyCard: { borderRadius: 14, backgroundColor: "white", padding: 24, alignItems: "center", gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: "center" },
  card: { borderRadius: 16, backgroundColor: "white", marginBottom: 10, overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  cardMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: 9, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statusPillTxt: { fontSize: 11, fontWeight: "700" },
  cardBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  description: { fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },
  evidenceRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  evidenceChip: { paddingHorizontal: 10, height: 30, borderRadius: 8, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  evidenceChipTxt: { fontSize: 11, fontWeight: "700", color: Colors.textPrimary },
  resolutionBox: { backgroundColor: Colors.input, borderRadius: 12, padding: 12, gap: 4 },
  resolutionLabel: { fontSize: 11, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase" },
  resolutionTxt: { fontSize: 13, color: Colors.textPrimary },
  noteInput: { minHeight: 60, borderRadius: 12, backgroundColor: Colors.input, padding: 10, fontSize: 13, color: Colors.textPrimary, textAlignVertical: "top" },
  refundInput: { height: 42, borderRadius: 12, backgroundColor: Colors.input, paddingHorizontal: 12, fontSize: 13, color: Colors.textPrimary },
  actionsRow: { flexDirection: "row", gap: 8 },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: 10, borderWidth: 1.5 },
  actBtnTxt: { fontSize: 12, fontWeight: "700", color: Colors.textPrimary },
  actBtnMuted: { borderColor: Colors.input, backgroundColor: Colors.input },
  actBtnRefund: { borderColor: "#DCFCE7", backgroundColor: "#F0FDF4" },
  actBtnWarn: { borderColor: "#F3EEFE", backgroundColor: "#FAF7FF" },
  actBtnDismiss: { borderColor: "#FDE8E8", backgroundColor: "#FEF3F3" },
});
