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
import { useI18n } from "@/lib/i18n";
import { db } from "@/lib/db/dal";
import { supabase } from "@/lib/supabase";

const cancellationReasons = [
  "reason_personal", "reason_booking_error", "reason_too_long", "reason_no_show", "reason_quality", "reason_other",
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
  const { t } = useI18n();
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
      Alert.alert(t("cancel_confirmed"), t("booking_cancelled_msg"));
      await onCancelled();
      onClose();
    } catch (error) {
      Alert.alert(t("error"), error instanceof Error ? error.message : t("cannot_cancel"));
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
        Alert.alert(t("account_suspended"), t("suspended_msg"));
      } else {
        Alert.alert(
          t("booking_cancelled"),
          `${t("penalty_applied").replace("{n}", String(res.penalty_mad))}\n${t("warning_count").replace("{n}", String(res.warnings))}`,
        );
      }
    } catch (error) {
      Alert.alert(t("error"), error instanceof Error ? error.message : t("cancel_impossible"));
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
              <Text style={styles.title}>{t("cancel_request_title")}</Text>
              <Text style={styles.subtitle}>{t("pro_already_moved")}</Text>

              <View style={styles.enRouteCard}>
                <View style={styles.enRouteIcon}><Navigation size={18} color={NAVY} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.enRouteName}>{proName?.trim() || t("your_professional")} · {t("en_route_short")}</Text>
                  <Text style={styles.enRouteSub}>{t("pro_moved_note")}</Text>
                </View>
              </View>

              <View style={styles.penaltyBox}>
                <ShieldAlert size={16} color="#B45309" />
                <Text style={styles.penaltyText}>{t("penalty_warning")}</Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={submitting}>
                  <Text style={styles.secondaryBtnText}>{t("keep")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.7 }]} onPress={handlePenaltyCancel} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.primaryBtnText}>{t("cancel_penalty_5")}</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t("cancel_reservation")}</Text>
              <Text style={styles.subtitle}>{t("choose_cancel_reason")}</Text>

              <ScrollView style={styles.reasonList} contentContainerStyle={{ gap: 8 }}>
                {cancellationReasons.map((item) => {
                  const selected = item === reason;
                  return (
                    <TouchableOpacity key={item} style={[styles.reasonRow, selected && styles.reasonRowActive]} onPress={() => setReason(item)}>
                      {selected ? <CheckCircle2 size={18} color={Colors.primary} /> : <Circle size={18} color={Colors.textMuted} />}
                      <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>{t(item)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={[styles.warningBox, hasCancellationFee ? styles.warningBoxCritical : styles.warningBoxSafe]}>
                <AlertTriangle size={16} color={hasCancellationFee ? "#B45309" : Colors.success} />
                <Text style={styles.warningText}>
                  {hasCancellationFee ? t("less_2h_note") : t("free_cancel_note")}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={submitting}>
                  <Text style={styles.secondaryBtnText}>{t("close")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.7 }]} onPress={handleFreeCancel} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.primaryBtnText}>{t("confirm_cancellation")}</Text>}
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
