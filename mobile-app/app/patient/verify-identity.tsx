/**
 * Patient identity (CIN) verification — required once, before the first booking.
 *
 * Why here and not at signup: forcing an ID upload on the registration form
 * kills conversion. A patient explores freely; the CIN is asked for the first
 * time they actually book — the moment it starts to matter, because a
 * professional is about to enter their home.
 *
 * Privacy: the photo goes to the PRIVATE `patient-ids` bucket (migration 0030).
 * Professionals never see the number or the image — only a "verified" badge.
 */
import { useCallback, useMemo, useState } from "react";
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
  ArrowLeft,
  BadgeCheck,
  Camera,
  Clock,
  FileWarning,
  ImageIcon,
  Lock,
  ShieldCheck,
} from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { useCaptureImage, usePickDocumentImage, uploadPrivateDocument } from "@/lib/hooks/useImageUpload";
import { useIdentityVerification } from "@/lib/hooks/useIdentityVerification";

const NAVY = "#0D0870";
const CIN_RE = /^[A-Za-z]{1,2}[0-9]{5,6}$/;

export default function VerifyIdentityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const { status, reason, loading, reload } = useIdentityVerification();

  const [cin, setCin] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cinValid = useMemo(() => CIN_RE.test(cin.trim()), [cin]);
  const canSubmit = cinValid && !!photoUri && !submitting;

  const submit = useCallback(async () => {
    if (!canSubmit || !user?.id || !photoUri) return;
    setSubmitting(true);
    try {
      const path = await uploadPrivateDocument("patient-ids", user.id, photoUri, `cin-${Date.now()}.jpg`);
      if (!path) return; // uploadPrivateDocument already surfaced the error

      const { error } = await supabase
        .from("patients")
        .update({
          cin_number: cin.trim().toUpperCase(),
          cin_photo_path: path,
          id_status: "pending",
          id_submitted_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;

      showToast(t("id_submitted_toast"));
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("action_failed"));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, user?.id, photoUri, cin, reload, t]);

  // ── Terminal states ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  if (status === "approved") {
    return (
      <StateScreen
        icon={<BadgeCheck size={40} color="#16A34A" strokeWidth={1.6} />}
        tint="#DCFCE7"
        title={t("id_approved_title")}
        sub={t("id_approved_sub")}
        cta={t("continue")}
        onCta={() => router.back()}
      />
    );
  }

  if (status === "pending") {
    return (
      <StateScreen
        icon={<Clock size={40} color={NAVY} strokeWidth={1.6} />}
        tint="#E7E4FA"
        title={t("id_pending_title")}
        sub={t("id_pending_sub")}
        cta={t("kyc_check_status")}
        onCta={() => void reload()}
        secondary={t("back")}
        onSecondary={() => router.back()}
      />
    );
  }

  // ── Form (unverified / rejected) ──────────────────────────────────────────
  const rejected = status === "rejected";

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("id_verification")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroIcon}>
          <ShieldCheck size={34} color={NAVY} strokeWidth={1.6} />
        </View>
        <Text style={styles.title}>{t("id_title")}</Text>
        <Text style={styles.subtitle}>{t("id_subtitle")}</Text>

        {rejected ? (
          <View style={styles.rejectBox}>
            <FileWarning size={17} color="#B45309" />
            <Text style={styles.rejectTxt}>{reason || t("id_rejected_sub")}</Text>
          </View>
        ) : null}

        {/* CIN number */}
        <Text style={styles.label}>{t("cin_number")}</Text>
        <TextInput
          value={cin}
          onChangeText={(v) => setCin(v.toUpperCase())}
          placeholder="AB123456"
          placeholderTextColor={Colors.textSubtle}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          style={[styles.input, cin.length > 0 && !cinValid && styles.inputError]}
        />
        {cin.length > 0 && !cinValid ? (
          <Text style={styles.errorHint}>{t("cin_format_hint")}</Text>
        ) : (
          <Text style={styles.hint}>{t("cin_format_hint")}</Text>
        )}

        {/* CIN photo */}
        <Text style={[styles.label, { marginTop: 22 }]}>{t("cin_photo")}</Text>
        {photoUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
            <TouchableOpacity style={styles.changeBtn} onPress={() => setPhotoUri(null)} activeOpacity={0.85}>
              <Text style={styles.changeTxt}>{t("change_photo")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pickRow}>
            <TouchableOpacity
              style={styles.pickBtn}
              activeOpacity={0.85}
              onPress={async () => {
                const a = await useCaptureImage();
                if (a?.uri) setPhotoUri(a.uri);
              }}
            >
              <Camera size={20} color={NAVY} />
              <Text style={styles.pickTxt}>{t("take_photo")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pickBtn}
              activeOpacity={0.85}
              onPress={async () => {
                const a = await usePickDocumentImage();
                if (a?.uri) setPhotoUri(a.uri);
              }}
            >
              <ImageIcon size={20} color={NAVY} />
              <Text style={styles.pickTxt}>{t("from_gallery")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Privacy reassurance — this is sensitive data, say so plainly. */}
        <View style={styles.privacyBox}>
          <Lock size={15} color={Colors.textMuted} />
          <Text style={styles.privacyTxt}>{t("id_privacy_note")}</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
          activeOpacity={0.9}
          disabled={!canSubmit}
          onPress={() => void submit()}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitTxt}>{t("submit_for_verification")}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Shared full-screen state (approved / pending) ───────────────────────────
function StateScreen({
  icon, tint, title, sub, cta, onCta, secondary, onSecondary,
}: {
  icon: React.ReactNode; tint: string; title: string; sub: string;
  cta: string; onCta: () => void; secondary?: string; onSecondary?: () => void;
}) {
  return (
    <View style={[styles.root, styles.center, { paddingHorizontal: 26 }]}>
      <View style={[styles.heroIcon, { backgroundColor: tint, marginBottom: 20 }]}>{icon}</View>
      <Text style={[styles.title, { textAlign: "center" }]}>{title}</Text>
      <Text style={[styles.subtitle, { textAlign: "center" }]}>{sub}</Text>
      <TouchableOpacity style={[styles.submitBtn, { marginTop: 28 }]} activeOpacity={0.9} onPress={onCta}>
        <Text style={styles.submitTxt}>{cta}</Text>
      </TouchableOpacity>
      {secondary && onSecondary ? (
        <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={onSecondary}>
          <Text style={styles.secondaryTxt}>{secondary}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15.5, fontWeight: "800", color: Colors.textPrimary },
  content: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 44 },
  heroIcon: {
    width: 78, height: 78, borderRadius: 39, backgroundColor: "#E7E4FA",
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16,
  },
  title: { fontSize: 22, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular", textAlign: "center" },
  subtitle: { fontSize: 13.5, color: Colors.textMuted, textAlign: "center", marginTop: 8, lineHeight: 20, paddingHorizontal: 4 },
  rejectBox: {
    flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: "#FEF3C7",
    borderRadius: 14, padding: 14, marginTop: 20,
  },
  rejectTxt: { flex: 1, color: "#92400E", fontSize: 13, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.textPrimary, marginTop: 24, marginBottom: 8 },
  input: {
    backgroundColor: "white", borderRadius: 14, height: 52, paddingHorizontal: 16,
    fontSize: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: "#EDEBF5", letterSpacing: 1,
  },
  inputError: { borderColor: "#DC2626" },
  hint: { fontSize: 11.5, color: Colors.textSubtle, marginTop: 6 },
  errorHint: { fontSize: 11.5, color: "#DC2626", marginTop: 6 },
  pickRow: { flexDirection: "row", gap: 12 },
  pickBtn: {
    flex: 1, height: 104, borderRadius: 16, backgroundColor: "white",
    borderWidth: 1.5, borderColor: "#E7E4FA", borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  pickTxt: { fontSize: 12.5, fontWeight: "700", color: NAVY },
  previewWrap: { borderRadius: 16, overflow: "hidden", backgroundColor: "white" },
  preview: { width: "100%", height: 190 },
  changeBtn: { paddingVertical: 12, alignItems: "center", backgroundColor: "white" },
  changeTxt: { color: NAVY, fontWeight: "700", fontSize: 13 },
  privacyBox: {
    flexDirection: "row", gap: 9, alignItems: "flex-start",
    backgroundColor: "#F4F3F8", borderRadius: 14, padding: 14, marginTop: 22,
  },
  privacyTxt: { flex: 1, color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  submitBtn: {
    backgroundColor: NAVY, borderRadius: 15, height: 54,
    alignItems: "center", justifyContent: "center", marginTop: 26, width: "100%",
  },
  submitDisabled: { opacity: 0.45 },
  submitTxt: { color: "white", fontSize: 15.5, fontWeight: "700" },
  secondaryBtn: { marginTop: 14, padding: 10 },
  secondaryTxt: { color: Colors.textMuted, fontSize: 14, fontWeight: "600" },
});
