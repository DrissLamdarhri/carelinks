import { useState } from "react";
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
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { db } from "@/lib/db/dal";

// i18n keys for the reasons (resolved with t()).
const cancellationReasons = [
  "reason_personal", "reason_booking_error", "reason_too_long", "reason_no_show", "reason_quality", "reason_other",
];

const FEE = 5; // flat service fee (must match c_fee in 0022_escrow_cancellation_rules.sql)

type CancellationDialogProps = {
  visible: boolean;
  bookingId: string;
  scheduledAt: string | null;
  status?: string;
  proName?: string | null;
  price?: number;
  onClose: () => void;
  onCancelled: () => void | Promise<void>;
};

/**
 * Patient-initiated cancellation. The actual money settlement is done server-side
 * by public.cancel_booking(); this dialog just previews which rule applies (derived
 * from the booking status) and the resulting refund, then calls the RPC.
 *   status 'open'                     → RULE #1  full refund, no fees
 *   status 'matched'                  → RULE #2  commission + fee retained
 *   status 'en_route' | 'in_progress' → RULE #3  nurse gets trip compensation
 * (RULE #4 — nurse-initiated — lives in the pro tracking screen.)
 */
export function CancellationDialog({
  visible,
  bookingId,
  status,
  price = 0,
  onClose,
  onCancelled,
}: CancellationDialogProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState(cancellationReasons[0]);
  const [submitting, setSubmitting] = useState(false);

  const cancelCase = status === "open" ? 1 : status === "matched" ? 2 : 3;
  const commission = Math.max(1, Math.round(price * 0.15));
  const refund = cancelCase === 1 ? price + FEE : price - commission;
  const retained = commission + FEE; // RULE #2 — platform keeps
  const comp = commission + FEE; // RULE #3 — paid to the nurse

  const handleCancel = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await db.bookings.cancelBooking(bookingId, reason);
      Alert.alert(t("cancel_confirmed"), t("booking_cancelled_msg"));
      await onCancelled();
      onClose();
    } catch (error) {
      Alert.alert(t("error"), error instanceof Error ? error.message : t("cannot_cancel"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
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

          {/* Case-aware money preview */}
          <View style={[styles.warningBox, cancelCase === 1 ? styles.warningBoxSafe : styles.warningBoxCritical]}>
            <AlertTriangle size={16} color={cancelCase === 1 ? Colors.success : "#B45309"} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningText}>
                {cancelCase === 1 ? t("cancel_full_refund") : cancelCase === 2 ? t("cancel_fee_retained") : t("cancel_pro_en_route_comp")}
              </Text>
              {price > 0 ? (
                <Text style={styles.amountLine}>
                  {t("refund_label")}: {refund} MAD
                  {cancelCase === 2 ? `  ·  ${t("fees_retained_label")}: ${retained} MAD` : ""}
                  {cancelCase === 3 ? `  ·  ${t("pro_comp_label")}: ${comp} MAD` : ""}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.secondaryBtnText}>{t("close")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.7 }]} onPress={handleCancel} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.primaryBtnText}>{t("confirm_cancellation")}</Text>}
            </TouchableOpacity>
          </View>
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

  reasonList: { maxHeight: 220, marginBottom: 10 },
  reasonRow: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#EAEAEA", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  reasonRowActive: { borderColor: Colors.primary, backgroundColor: Colors.surfaceWarm },
  reasonText: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  reasonTextActive: { color: Colors.primary, fontWeight: "600" },

  warningBox: { borderRadius: 12, borderWidth: 1, padding: 10, flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 12 },
  warningBoxCritical: { borderColor: "#FDE68A", backgroundColor: "#FEF3C7" },
  warningBoxSafe: { borderColor: "#BBF7D0", backgroundColor: "#ECFDF3" },
  warningText: { color: Colors.textPrimary, fontSize: 12, lineHeight: 17 },
  amountLine: { color: Colors.textPrimary, fontSize: 12.5, fontWeight: "800", marginTop: 4 },

  actions: { flexDirection: "row", gap: 8 },
  secondaryBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#E5E5E5", alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  primaryBtn: { flex: 1.4, height: 48, borderRadius: 12, backgroundColor: Colors.danger, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "white", fontSize: 13.5, fontWeight: "800" },
});
