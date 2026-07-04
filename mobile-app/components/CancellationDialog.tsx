import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { AlertTriangle, Circle, CheckCircle2 } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";

const cancellationReasons = [
  "Imprévu personnel",
  "Erreur de réservation",
  "Délai trop long",
  "Le pro n'est pas venu",
  "Problème de qualité",
  "Autre",
];

type CancellationDialogProps = {
  visible: boolean;
  bookingId: string;
  scheduledAt: string | null;
  onClose: () => void;
  onCancelled: () => void | Promise<void>;
};

export function CancellationDialog({
  visible,
  bookingId,
  scheduledAt,
  onClose,
  onCancelled,
}: CancellationDialogProps) {
  const [reason, setReason] = useState(cancellationReasons[0]);
  const [submitting, setSubmitting] = useState(false);

  const hasCancellationFee = useMemo(() => {
    if (!scheduledAt) return false;
    const scheduledTime = new Date(scheduledAt).getTime();
    const now = Date.now();
    const deltaMs = scheduledTime - now;
    return deltaMs <= 2 * 60 * 60 * 1000;
  }, [scheduledAt]);

  const handleCancelBooking = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          cancel_reason: reason,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (error) throw error;

      Alert.alert("Annulation confirmée", "Votre réservation a été annulée.");
      await onCancelled();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'annuler la réservation.";
      Alert.alert("Erreur", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Annuler la réservation</Text>
          <Text style={styles.subtitle}>Choisissez une raison d'annulation</Text>

          <ScrollView style={styles.reasonList} contentContainerStyle={{ gap: 8 }}>
            {cancellationReasons.map((item) => {
              const selected = item === reason;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.reasonRow, selected && styles.reasonRowActive]}
                  onPress={() => setReason(item)}
                >
                  {selected ? (
                    <CheckCircle2 size={18} color={Colors.primary} />
                  ) : (
                    <Circle size={18} color={Colors.textMuted} />
                  )}
                  <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View
            style={[
              styles.warningBox,
              hasCancellationFee ? styles.warningBoxCritical : styles.warningBoxSafe,
            ]}
          >
            <AlertTriangle size={16} color={hasCancellationFee ? "#B45309" : Colors.success} />
            <Text style={styles.warningText}>
              {hasCancellationFee
                ? "Annulation à moins de 2h : des frais de 50% peuvent s'appliquer."
                : "Annulation gratuite : plus de 2h avant la prestation."}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.secondaryBtnText}>Fermer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
              onPress={handleCancelBooking}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.primaryBtnText}>Confirmer l'annulation</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
  },
  reasonList: {
    maxHeight: 220,
    marginBottom: 10,
  },
  reasonRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reasonRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceWarm,
  },
  reasonText: {
    color: Colors.textPrimary,
    fontSize: 13,
    flex: 1,
  },
  reasonTextActive: {
    color: Colors.primary,
    fontWeight: "600",
  },
  warningBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  warningBoxCritical: {
    borderColor: "#FDE68A",
    backgroundColor: "#FEF3C7",
  },
  warningBoxSafe: {
    borderColor: "#BBF7D0",
    backgroundColor: "#ECFDF3",
  },
  warningText: {
    color: Colors.textPrimary,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  primaryBtn: {
    flex: 1.4,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
});

