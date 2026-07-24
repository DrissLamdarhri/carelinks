import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { MessageSquare, Star } from "lucide-react-native";
import { Colors, Shadows } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
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

// Soft, distinct avatar backgrounds so each reviewer reads as a person, not a row.
const AVATAR_COLORS = ["#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"];
const initialsOf = (name: string) =>
  name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
const colorFor = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((idx) => (
        <Star
          key={idx}
          size={size}
          color={idx <= Math.round(value) ? "#FBBF24" : "#E2E4E9"}
          fill={idx <= Math.round(value) ? "#FBBF24" : "#E2E4E9"}
        />
      ))}
    </View>
  );
}

export function ReviewsList({ professionalId }: ReviewsListProps) {
  const { t } = useI18n();
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
      } catch {
        // Non-blocking: an empty reviews section is fine, no need to interrupt.
        if (active) setReviews([]);
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

  // 5★ → 1★ counts for the distribution bars.
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 = 5★ … index 4 = 1★
    for (const r of reviews) {
      const b = Math.min(5, Math.max(1, Math.round(r.stars)));
      counts[5 - b] += 1;
    }
    return counts;
  }, [reviews]);

  // Compact, localized "time ago" for recent reviews; absolute date otherwise.
  const timeAgo = (iso: string) => {
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days <= 0) return t("rev_today");
    if (days === 1) return t("rev_yesterday");
    if (days < 7) return t("rev_days_ago").replace("%d", String(days));
    if (days < 30) return t("rev_weeks_ago").replace("%d", String(Math.floor(days / 7)));
    return d.toLocaleDateString("fr-MA", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{t("patient_reviews")}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <MessageSquare size={20} color={Colors.textSubtle} />
          </View>
          <Text style={styles.emptyTitle}>{t("no_reviews")}</Text>
          <Text style={styles.emptySub}>{t("be_first_review")}</Text>
        </View>
      ) : (
        <>
          {/* ── Rating summary ── */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryScore}>{average.toFixed(1)}</Text>
              <StarRow value={average} size={13} />
              <Text style={styles.summaryCount}>
                {reviews.length} {t("reviews_word")}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRight}>
              {distribution.map((count, i) => {
                const starLevel = 5 - i;
                const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                return (
                  <View key={starLevel} style={styles.distRow}>
                    <Text style={styles.distLabel}>{starLevel}</Text>
                    <Star size={9} color="#FBBF24" fill="#FBBF24" />
                    <View style={styles.distTrack}>
                      <View style={[styles.distFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Individual reviews ── */}
          <View style={{ gap: 10 }}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.avatar, { backgroundColor: colorFor(review.patient_id) }]}>
                    <Text style={styles.avatarText}>{initialsOf(review.patient_name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.patientName} numberOfLines={1}>{review.patient_name}</Text>
                    <View style={styles.metaRow}>
                      <StarRow value={review.stars} size={12} />
                      <Text style={styles.dateText}>· {timeAgo(review.created_at)}</Text>
                    </View>
                  </View>
                </View>
                {review.comment?.trim() ? (
                  <Text style={styles.commentText}>{review.comment.trim()}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", marginTop: 14, marginHorizontal: 20 },
  center: { paddingVertical: 22, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 10 },

  emptyCard: {
    backgroundColor: "white", borderRadius: 16, paddingVertical: 26, alignItems: "center", ...Shadows.sm,
  },
  emptyIcon: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.surfaceWarm,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  emptySub: { color: Colors.textMuted, fontSize: 12.5, marginTop: 3 },

  summaryCard: {
    flexDirection: "row", backgroundColor: "white", borderRadius: 18, padding: 16,
    marginBottom: 12, alignItems: "center", ...Shadows.sm,
  },
  summaryLeft: { alignItems: "center", paddingRight: 16, gap: 4 },
  summaryScore: { color: Colors.textPrimary, fontSize: 34, fontWeight: "900", lineHeight: 38 },
  summaryCount: { color: Colors.textMuted, fontSize: 11.5 },
  summaryDivider: { width: 1, alignSelf: "stretch", backgroundColor: "#EFEFF2" },
  summaryRight: { flex: 1, paddingLeft: 16, gap: 5 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  distLabel: { color: Colors.textMuted, fontSize: 10.5, width: 8, textAlign: "right" },
  distTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#F0F0F3", overflow: "hidden" },
  distFill: { height: 6, borderRadius: 3, backgroundColor: "#FBBF24" },

  card: { backgroundColor: "white", borderRadius: 16, padding: 14, ...Shadows.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontSize: 14, fontWeight: "800" },
  patientName: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  starsRow: { flexDirection: "row", gap: 2 },
  dateText: { color: Colors.textMuted, fontSize: 11 },
  commentText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19, marginTop: 10 },
});
