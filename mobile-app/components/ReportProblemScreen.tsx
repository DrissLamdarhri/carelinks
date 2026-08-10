/**
 * "Signaler un problème" — shared by both the patient and the pro side of a
 * booking (mobile-app/app/patient/report/[bookingId].tsx and
 * mobile-app/app/pro/report/[bookingId].tsx are thin wrappers around this).
 * Files a real row in `disputes` via the file_dispute() RPC — nothing here
 * is a mailto/support-ticket stand-in, it lands in the admin resolution
 * queue (see mobile-app/app/admin/disputes.tsx).
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  CreditCard,
  Fingerprint,
  Frown,
  Hammer,
  HelpCircle,
  Paperclip,
  ShieldAlert,
  ThumbsDown,
  UserX,
  X,
} from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db, type DisputeCategory } from "@/lib/db/dal";
import { usePickImage, uploadPrivateDocument } from "@/lib/hooks/useImageUpload";
import { showToast } from "@/lib/toast";

const NAVY = Colors.primary;
const MAX_PHOTOS = 3;

const CATEGORY_ICON: Record<DisputeCategory, typeof Clock> = {
  late_arrival: Clock,
  no_show: UserX,
  safety_incident: ShieldAlert,
  poor_conduct: ThumbsDown,
  quality_issue: Frown,
  price_dispute: CreditCard,
  property_damage: Hammer,
  harassment: AlertTriangle,
  identity_mismatch: Fingerprint,
  payment_issue: CreditCard,
  other: HelpCircle,
};

const PATIENT_CATEGORIES: DisputeCategory[] = [
  "late_arrival",
  "no_show",
  "safety_incident",
  "poor_conduct",
  "quality_issue",
  "price_dispute",
  "property_damage",
  "harassment",
  "identity_mismatch",
  "payment_issue",
  "other",
];

const PRO_CATEGORIES: DisputeCategory[] = [
  "no_show",
  "safety_incident",
  "poor_conduct",
  "harassment",
  "property_damage",
  "payment_issue",
  "other",
];

export function ReportProblemScreen({ role, bookingId }: { role: "patient" | "pro"; bookingId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const categories = role === "patient" ? PATIENT_CATEGORIES : PRO_CATEGORIES;

  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<{ uri: string; mimeType?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setCategory(null);
    setDescription("");
    setPhotos([]);
    setDone(false);
  }, [bookingId]);

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const asset = await usePickImage();
    if (!asset) return;
    setPhotos((prev) => [...prev, { uri: asset.uri, mimeType: asset.mimeType }]);
  };

  const removePhoto = (uri: string) => setPhotos((prev) => prev.filter((p) => p.uri !== uri));

  const valid = !!category && description.trim().length >= 10;

  const submit = async () => {
    if (!valid || submitting || !user) return;
    setSubmitting(true);
    try {
      const evidencePaths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const path = await uploadPrivateDocument(
          "dispute-evidence",
          user.id,
          photos[i].uri,
          `${bookingId}-${Date.now()}-${i}.jpg`,
          photos[i].mimeType ?? "image/jpeg",
        );
        if (path) evidencePaths.push(path);
      }
      await db.disputes.file(bookingId, category as DisputeCategory, description.trim(), evidencePaths);
      setDone(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("action_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <View style={s.doneRoot}>
        <View style={s.doneIcon}>
          <ShieldAlert size={30} color={NAVY} />
        </View>
        <Text style={s.doneTitle}>{t("report_sent_title")}</Text>
        <Text style={s.doneSub}>{t("report_sent_msg")}</Text>
        <TouchableOpacity style={s.doneBtn} onPress={() => router.back()}>
          <Text style={s.doneBtnTxt}>{t("back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel={t("back")}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {role === "patient" ? t("report_problem_title") : t("report_patient_title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>{t("report_category_label")}</Text>
        <View style={s.grid}>
          {categories.map((c) => {
            const Icon = CATEGORY_ICON[c];
            const active = category === c;
            return (
              <TouchableOpacity
                key={c}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Icon size={16} color={active ? "#FFFFFF" : NAVY} />
                <Text style={[s.chipTxt, active && s.chipTxtActive]}>{t(`dispute_cat_${c}`)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[s.label, { marginTop: 22 }]}>{t("report_description_label")}</Text>
        <TextInput
          style={s.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder={t("report_description_ph")}
          placeholderTextColor={Colors.textSubtle}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        <Text style={s.hint}>{t("report_min_chars")}</Text>

        <Text style={[s.label, { marginTop: 18 }]}>{t("report_evidence_label")}</Text>
        <View style={s.photoRow}>
          {photos.map((p) => (
            <View key={p.uri} style={s.photoThumbWrap}>
              <Image source={{ uri: p.uri }} style={s.photoThumb} />
              <TouchableOpacity style={s.photoRemove} onPress={() => removePhoto(p.uri)}>
                <X size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <TouchableOpacity style={s.photoAdd} onPress={addPhoto}>
              <Paperclip size={18} color={Colors.textMuted} />
              <Text style={s.photoAddTxt}>{t("add_photo")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[s.submitBtn, !valid && { opacity: 0.5 }]}
          disabled={!valid || submitting}
          onPress={submit}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.submitTxt}>{t("send_report")}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: Colors.input },
  headerTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.textPrimary, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, height: 38, borderRadius: 12,
    backgroundColor: Colors.input, borderWidth: 1.5, borderColor: "transparent",
  },
  chipActive: { backgroundColor: NAVY },
  chipTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.textPrimary },
  chipTxtActive: { color: "#FFFFFF" },
  textarea: {
    minHeight: 110, borderRadius: 16, backgroundColor: Colors.input,
    padding: 14, fontSize: 14, color: Colors.textPrimary,
  },
  hint: { fontSize: 11, color: Colors.textSubtle, marginTop: 6 },
  photoRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  photoThumbWrap: { width: 72, height: 72, borderRadius: 12, overflow: "hidden", position: "relative" },
  photoThumb: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
  },
  photoAdd: {
    width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.input,
    borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4,
  },
  photoAddTxt: { fontSize: 9, color: Colors.textMuted, fontWeight: "600" },
  submitBtn: {
    height: 54, borderRadius: 16, backgroundColor: NAVY,
    alignItems: "center", justifyContent: "center", marginTop: 28,
  },
  submitTxt: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  doneRoot: { flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  doneIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.input,
    alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  doneTitle: { fontSize: 20, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  doneSub: { fontSize: 14, color: Colors.textMuted, textAlign: "center", lineHeight: 20 },
  doneBtn: { height: 50, paddingHorizontal: 28, borderRadius: 14, backgroundColor: NAVY, alignItems: "center", justifyContent: "center", marginTop: 18 },
  doneBtnTxt: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
