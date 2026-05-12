import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Star, ThumbsUp } from "lucide-react-native";
import { Colors } from "@/lib/colors";

const tags = ["Ponctuel", "Professionnel", "Soigneux", "Aimable", "Propre", "Compétent"];

export default function RatingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId: string }>();
  const bookingId = params.bookingId;

  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const canSubmit = rating > 0;
  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  if (submitted) {
    return (
      <View style={styles.successRoot}>
        <View style={styles.successIconWrap}>
          <ThumbsUp size={38} color={Colors.primary} />
        </View>
        <Text style={styles.successTitle}>Merci pour votre avis !</Text>
        <Text style={styles.successSubtitle}>
          Votre évaluation aide à améliorer la qualité des soins sur CareLink.
        </Text>
        <View style={styles.successStars}>
          {stars.map((item) => (
            <Star
              key={item}
              size={30}
              color={item <= rating ? "#FBBF24" : "#E0E0E0"}
              fill={item <= rating ? "#FBBF24" : "transparent"}
            />
          ))}
        </View>
        <TouchableOpacity style={styles.successBtn} onPress={() => router.replace("/patient")}>
          <Text style={styles.successBtnText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 18 }}>
        <View style={styles.topBlock}>
          <Text style={styles.title}>Comment était votre soin ?</Text>
          <Text style={styles.subtitle}>Réservation #{bookingId.slice(0, 8)}</Text>
        </View>

        <View style={styles.starsRow}>
          {stars.map((item) => (
            <TouchableOpacity key={item} onPress={() => setRating(item)}>
              <Star
                size={42}
                color={item <= rating ? "#FBBF24" : "#E0E0E0"}
                fill={item <= rating ? "#FBBF24" : "transparent"}
                strokeWidth={1.5}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.blockTitle}>Qu'avez-vous apprécié ?</Text>
        <View style={styles.tagsWrap}>
          {tags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => toggleTag(tag)}
                style={[styles.tag, active && styles.tagActive]}
              >
                <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.blockTitle}>Commentaire (optionnel)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Partagez votre expérience avec d'autres patients…"
          placeholderTextColor={Colors.textSubtle}
          style={styles.commentInput}
          multiline
          numberOfLines={4}
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          disabled={!canSubmit}
          onPress={() => setSubmitted(true)}
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        >
          <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
            Envoyer mon avis
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace("/patient")}>
          <Text style={styles.skipBtnText}>Passer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  topBlock: { alignItems: "center", marginBottom: 24 },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: { color: Colors.textMuted, fontSize: 13 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 24 },
  blockTitle: { color: Colors.textMuted, fontSize: 13, marginBottom: 10, fontWeight: "500" },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tag: {
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  tagActive: { backgroundColor: Colors.primary },
  tagText: { color: Colors.textPrimary, fontSize: 13 },
  tagTextActive: { color: "white", fontWeight: "600" },
  commentInput: {
    minHeight: 96,
    borderRadius: 14,
    backgroundColor: Colors.input,
    paddingHorizontal: 14,
    paddingTop: 12,
    color: Colors.textPrimary,
    textAlignVertical: "top",
  },
  footer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  submitBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { backgroundColor: "#E0E0E0" },
  submitBtnText: { color: "white", fontSize: 15, fontWeight: "600" },
  submitBtnTextDisabled: { color: Colors.textMuted },
  skipBtn: { height: 42, alignItems: "center", justifyContent: "center" },
  skipBtnText: { color: Colors.textMuted, fontSize: 13 },
  successRoot: {
    flex: 1,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  successIconWrap: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  successTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontFamily: "DMSerifDisplay_400Regular",
    marginBottom: 6,
    textAlign: "center",
  },
  successSubtitle: { color: Colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: 20 },
  successStars: { flexDirection: "row", gap: 8, marginBottom: 24 },
  successBtn: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  successBtnText: { color: "white", fontSize: 15, fontWeight: "600" },
});
