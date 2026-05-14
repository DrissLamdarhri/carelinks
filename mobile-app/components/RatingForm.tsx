import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Star } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

type RatingFormProps = {
  bookingId: string;
  professionalId: string;
  onSubmitted: () => void;
};

export function RatingForm({ bookingId, professionalId, onSubmitted }: RatingFormProps) {
  const { user } = useAuth();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => stars >= 1 && !!user?.id, [stars, user?.id]);

  const handleSubmit = async () => {
    if (!user?.id || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("ratings").insert({
        booking_id: bookingId,
        patient_id: user.id,
        professional_id: professionalId,
        stars,
        comment: comment.trim() || null,
      });
      if (error) throw error;

      Alert.alert("Merci", "Votre avis a bien été envoyé.");
      onSubmitted();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'envoyer votre avis.";
      Alert.alert("Erreur", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Votre note</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((idx) => (
          <TouchableOpacity key={idx} onPress={() => setStars(idx)}>
            <Star
              size={38}
              color={idx <= stars ? "#FBBF24" : "#D1D5DB"}
              fill={idx <= stars ? "#FBBF24" : "transparent"}
            />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Commentaire (optionnel)</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Partagez votre expérience..."
        placeholderTextColor={Colors.textSubtle}
        style={styles.input}
        multiline
        numberOfLines={4}
      />

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
    gap: 10,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  input: {
    minHeight: 96,
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

