import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Star } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";

type ReviewsListProps = {
  professionalId: string;
};

type RatingRow = {
  id: string;
  patient_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
};

type ReviewItem = RatingRow & {
  patient_name: string;
};

export function ReviewsList({ professionalId }: ReviewsListProps) {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const { data: ratings, error: ratingsError } = await supabase
          .from("ratings")
          .select("id, patient_id, stars, comment, created_at")
          .eq("professional_id", professionalId)
          .order("created_at", { ascending: false });

        if (ratingsError) throw ratingsError;
        const rows = (ratings ?? []) as RatingRow[];

        const patientIds = Array.from(new Set(rows.map((item) => item.patient_id)));
        const namesById = new Map<string, string>();

        if (patientIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", patientIds);
          if (profilesError) throw profilesError;

          for (const row of profiles ?? []) {
            namesById.set(row.id as string, (row.full_name as string) || "Patient");
          }
        }

        if (!active) return;

        setReviews(
          rows.map((item) => ({
            ...item,
            patient_name: namesById.get(item.patient_id) ?? "Patient",
          }))
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Impossible de charger les avis.";
        Alert.alert("Erreur", message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [professionalId]);

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, item) => sum + item.stars, 0) / reviews.length;
  }, [reviews]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>Avis patients</Text>
        <View style={styles.averageWrap}>
          <Star size={14} color="#FBBF24" fill="#FBBF24" />
          <Text style={styles.averageText}>
            {reviews.length > 0 ? average.toFixed(1) : "—"} ({reviews.length})
          </Text>
        </View>
      </View>

      {reviews.length === 0 ? (
        <Text style={styles.emptyText}>Aucun avis pour le moment.</Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ gap: 10 }}>
          {reviews.map((review) => (
            <View key={review.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.patientName}>{review.patient_name}</Text>
                <Text style={styles.dateText}>
                  {new Date(review.created_at).toLocaleDateString("fr-MA")}
                </Text>
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((idx) => (
                  <Star
                    key={`${review.id}-${idx}`}
                    size={14}
                    color={idx <= review.stars ? "#FBBF24" : "#D1D5DB"}
                    fill={idx <= review.stars ? "#FBBF24" : "transparent"}
                  />
                ))}
              </View>
              <Text style={styles.commentText}>
                {review.comment?.trim() || "Aucun commentaire."}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  center: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  averageWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  averageText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  list: {
    maxHeight: 260,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ECECEC",
    padding: 10,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  patientName: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  dateText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  starsRow: {
    flexDirection: "row",
    gap: 3,
    marginBottom: 6,
  },
  commentText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
});

