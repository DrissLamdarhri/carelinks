import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Star } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { toastError, toastSuccess } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { isDemoBookingId } from "@/lib/demo-booking";

type RatingFormProps = {
  bookingId: string;
  professionalId: string;
  professionalName: string;
  professionalAvatar?: string | null;
  subtitle?: string;
  onSubmitted: () => void;
};

const tags = ["Ponctuel", "Professionnel", "Soigneux", "Aimable", "Propre", "Compétent"];
const tips = [10, 20, 50];

export function RatingForm({
  bookingId,
  professionalId,
  professionalName,
  professionalAvatar,
  subtitle,
  onSubmitted,
}: RatingFormProps) {
  const { user } = useAuth();
  const isDemoBooking = isDemoBookingId(bookingId);
  const [stars, setStars] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => stars >= 1 && (isDemoBooking || !!user?.id),
    [isDemoBooking, stars, user?.id]
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (isDemoBooking) {
        toastSuccess("Merci pour votre avis ✓");
        onSubmitted();
        return;
      }

      if (!user?.id) {
        throw new Error("Utilisateur non connecté.");
      }

      const { error } = await supabase.from("ratings").insert({
        booking_id: bookingId,
        patient_id: user.id,
        professional_id: professionalId,
        stars,
        comment:
          [selectedTags.join(", "), selectedTip ? `${selectedTip} MAD` : null, comment.trim() || null]
            .filter(Boolean)
            .join(" — ") || null,
      });
      if (error) throw error;

      toastSuccess("Merci pour votre avis ✓");
      onSubmitted();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'envoyer votre avis.";
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        {professionalAvatar ? (
          <Image source={{ uri: professionalAvatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>
              {professionalName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2) || "?"}
            </Text>
          </View>
        )}
        <Text style={styles.title}>Comment était votre soin ?</Text>
        <Text style={styles.subtitle}>Évaluez {professionalName}</Text>
        {subtitle ? <Text style={styles.smallSubtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((idx) => (
          <TouchableOpacity key={idx} onPress={() => setStars(idx)}>
            <Star
              size={34}
              color={idx <= stars ? "#FBBF24" : "#D1D5DB"}
              fill={idx <= stars ? "#FBBF24" : "transparent"}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Qu'avez-vous apprécié ?</Text>
        <View style={styles.tagWrap}>
          {tags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.tag, selectedTags.includes(tag) && styles.tagActive]}
              onPress={() => toggleTag(tag)}
            >
              <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ajouter un pourboire ?</Text>
        <View style={styles.tipWrap}>
          {tips.map((tip) => (
            <TouchableOpacity
              key={tip}
              style={[styles.tip, selectedTip === tip && styles.tipActive]}
              onPress={() => setSelectedTip((prev) => (prev === tip ? null : tip))}
            >
              <Text style={[styles.tipText, selectedTip === tip && styles.tipTextActive]}>{tip} MAD</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Commentaire (optionnel)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Laisser un commentaire (optionnel)…"
          placeholderTextColor={Colors.textSubtle}
          style={styles.input}
          multiline
          numberOfLines={4}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
        disabled={!canSubmit || submitting}
        onPress={handleSubmit}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.submitText}>Envoyer mon avis</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarFallbackText: { color: Colors.primary, fontSize: 18, fontWeight: "700" },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontFamily: "DMSerifDisplay_400Regular",
    textAlign: "center",
  },
  subtitle: { color: Colors.textMuted, fontSize: 13, marginTop: 4, textAlign: "center" },
  smallSubtitle: { color: Colors.textSubtle, fontSize: 12, marginTop: 2, textAlign: "center" },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 18,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  tagActive: {
    backgroundColor: Colors.primary,
  },
  tagText: {
    color: Colors.textPrimary,
    fontSize: 13,
  },
  tagTextActive: {
    color: "white",
    fontWeight: "600",
  },
  tipWrap: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  tip: {
    minWidth: 62,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  tipActive: {
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tipText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  tipTextActive: {
    color: Colors.primary,
  },
  input: {
    minHeight: 88,
    borderRadius: 14,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    paddingTop: 12,
    color: Colors.textPrimary,
    textAlignVertical: "top",
  },
  submitBtn: {
    marginTop: 6,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
});
