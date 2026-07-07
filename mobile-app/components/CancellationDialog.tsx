import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AlertTriangle, CheckCircle2, Circle, Navigation, ShieldAlert } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { db } from "@/lib/db/dal";
import { supabase } from "@/lib/supabase";

const cancellationReasons = [
  "Imprévu personnel",
  "Erreur de réservation",
  "Délai trop long",
  "Le pro n'est pas venu",
  "Problème de qualité",
  "Autre",
];

const NAVY = "#0D0870";

type CancellationDialogProps = {
  visible: boolean;
  bookingId: string;
  scheduledAt: string | null;
  status?: string;
  proName?: string | null;
  onClose: () => void;
  onCancelled: () => void | Promise<void>;
};

export function CancellationDialog({
  visible,
  bookingId,
  scheduledAt,
  status,
  proName,
  onClose,
  onCancelled,
}: CancellationDialogProps) {
  const [reason, setReason] = useState(cancellationReasons[0]);
  const [submitting, setSubmitting] = useState(false);

  // Pro already en route → late cancellation with penalty.
  const enRoute = status === "matched" || status === "in_progress";

  const hasCancellationFee = useMemo(() => {
    if (!scheduledAt) return false;
    return new Date(scheduledAt).getTime() - Date.now() <= 2 * 60 * 60 * 1000;
  }, [scheduledAt]);

  const handleFreeCancel = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled", cancel_reason: reason, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (error) throw error;
      Alert.alert("Annulation confirmée", "Votre réservation a été annulée.");
      await onCancelled();
      onClose();
    } catch (error) {
      Alert.alert("Erreur", error instanceof Error ? error.message : "Impossible d'annuler la réservation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePenaltyCancel = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await db.bookings.cancelWithPenalty(bookingId);
      await onCancelled();
      onClose();
      if (res.suspended) {
        Alert.alert("Compte suspendu", "Vous avez atteint 2 avertissements. Votre compte est temporairement suspendu — contactez le support.");
      } else {
        Alert.alert("Réservation annulée", `Une pénalité de ${res.penalty_mad} MAD a été appliquée.\nAvertissement ${res.warnings}/2.`);
      }
    } catch (error) {
      Alert.alert("Erreur", error instanceof Error ? error.message : "Annulation impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          {enRoute ? (
            <>
              <Text style={styles.title}>Annuler la demande</Text>
              <Text style={styles.subtitle}>Le professionnel s'est déjà déplacé</Text>

              <View style={styles.enRouteCard}>
                <View style={styles.enRouteIcon}><Navigation size={18} color={NAVY} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.enRouteName}>{proName?.trim() || "Votre professionnel"} est en route</Text>
                  <Text style={styles.enRouteSub}>Il s'est déjà déplacé pour cette demande.</Text>
                </View>
              </View>

              <View style={styles.penaltyBox}>
                <ShieldAlert size={16} color="#B45309" />
                <Text style={styles.penaltyText}>
                  Annuler maintenant entraîne une <Text style={styles.bold}>pénalité de 5 MAD</Text> (versée au professionnel en dédommagement) et un <Text style={styles.bold}>avertissement</Text>. Après 2 avertissements, votre compte est suspendu.
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={submitting}>
                  <Text style={styles.secondaryBtnText}>Garder</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.7 }]} onPress={handlePenaltyCancel} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.primaryBtnText}>Annuler (−5 MAD)</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Annuler la réservation</Text>
              <Text style={styles.subtitle}>Choisissez une raison d'annulation</Text>

              <ScrollView style={styles.reasonList} contentContainerStyle={{ gap: 8 }}>
                {cancellationReasons.map((item) => {
                  const selected = item === reason;
                  return (
                    <TouchableOpacity key={item} style={[styles.reasonRow, selected && styles.reasonRowActive]} onPress={() => setReason(item)}>
                      {selected ? <CheckCircle2 size={18} color={Colors.primary} /> : <Circle size={18} color={Colors.textMuted} />}
                      <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={[styles.warningBox, hasCancellationFee ? styles.warningBoxCritical : styles.warningBoxSafe]}>
                <AlertTriangle size={16} color={hasCancellationFee ? "#B45309" : Colors.success} />
                <Text style={styles.warningText}>
                  {hasCancellationFee
                    ? "Annulation à moins de 2h : des frais peuvent s'appliquer."
                    : "Annulation gratuite : aucun professionnel n'est encore en route."}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={submitting}>
                  <Text style={styles.secondaryBtnText}>Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.7 }]} onPress={handleFreeCancel} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.primaryBtnText}>Confirmer l'annulation</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  card: { width: "100%", maxWidth: 460, backgroundColor: "white", borderRadius: 18, padding: 16 },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  subtitle: { color: Colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 14 },

  enRouteCard: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: Colors.surfaceWarm, borderRadius: 14, padding: 12, marginBottom: 12 },
  enRouteIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  enRouteName: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: "800" },
  enRouteSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  penaltyBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#FEF3C7", borderColor: "#FDE68A", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  penaltyText: { flex: 1, color: "#7A4E0A", fontSize: 12.5, lineHeight: 18 },
  bold: { fontWeight: "800" },

  reasonList: { maxHeight: 220, marginBottom: 10 },
  reasonRow: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#EAEAEA", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  reasonRowActive: { borderColor: Colors.primary, backgroundColor: Colors.surfaceWarm },
  reasonText: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  reasonTextActive: { color: Colors.primary, fontWeight: "600" },
  warningBox: { borderRadius: 12, borderWidth: 1, padding: 10, flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 12 },
  warningBoxCritical: { borderColor: "#FDE68A", backgroundColor: "#FEF3C7" },
  warningBoxSafe: { borderColor: "#BBF7D0", backgroundColor: "#ECFDF3" },
  warningText: { color: Colors.textPrimary, fontSize: 12, lineHeight: 17, flex: 1 },

  actions: { flexDirection: "row", gap: 8 },
  secondaryBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#E5E5E5", alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  primaryBtn: { flex: 1.4, height: 48, borderRadius: 12, backgroundColor: Colors.danger, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "white", fontSize: 13.5, fontWeight: "800" },
});
