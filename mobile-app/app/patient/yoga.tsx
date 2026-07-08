import { useMemo, useState, useEffect } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Calendar, Clock3, Heart, Star, Users } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { notifyAdminNewBooking } from "@/lib/admin/booking-notifications";
import { useYogaSessions, useSessionEnrollments } from "@/lib/yoga-realtime";

const filters = ["Tous", "Débutant", "Intermédiaire", "Avancé"] as const;

<<<<<<< HEAD
=======
// Fallback sessions for when database is unavailable
const fallbackSessions = [
  {
    id: "s1",
    name: "Hatha Flow Matinal",
    level: "level_beginner",
    instructor: "Sara Bennani",
    instructorImg:
      "https://images.unsplash.com/photo-1612944095914-33fd0a85fcfc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    duration: "60 min",
    price: 80,
    date: "18 Avr. — 09h00",
    spots: 4,
    rating: 4.8,
    img: "https://images.unsplash.com/photo-1760774714285-61ff516f86c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    id: "s2",
    name: "Vinyasa Dynamique",
    level: "level_intermediate",
    instructor: "Omar Tazi",
    instructorImg:
      "https://images.unsplash.com/photo-1758691463393-a2aa9900af8a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    duration: "75 min",
    price: 100,
    date: "19 Avr. — 10h30",
    spots: 2,
    rating: 4.9,
    img: "https://images.unsplash.com/photo-1667890785988-8da12fd0989b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    id: "s3",
    name: "Yin Yoga Profond",
    level: "level_all",
    instructor: "Nadia Filali",
    instructorImg:
      "https://images.unsplash.com/photo-1670191247079-f9713ae06dcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    duration: "90 min",
    price: 90,
    date: "20 Avr. — 18h00",
    spots: 6,
    rating: 4.7,
    img: "https://images.unsplash.com/photo-1559185590-fcf099ac62c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
];

>>>>>>> 5b10d8c506d682db78e7a0dff991e92e61bc9769
export default function YogaCatalogScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { sessions: yogaSessions, loading, error } = useYogaSessions();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("Tous");
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});

  // Load enrollment counts for all sessions
  useEffect(() => {
    if (!yogaSessions || yogaSessions.length === 0) return;

    const loadEnrollments = async () => {
      const counts: Record<string, number> = {};
      for (const session of yogaSessions) {
        const { count, error } = await supabase
          .from("yoga_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("session_id", session.id);
        
        if (!error) {
          counts[session.id] = count ?? 0;
        }
      }
      setEnrollmentCounts(counts);
    };

    loadEnrollments();

    // Subscribe to enrollment changes
    const channels = yogaSessions.map((session) => {
      return supabase
        .channel(`yoga_enrollments:${session.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "yoga_enrollments",
            filter: `session_id=eq.${session.id}`,
          },
          () => {
            loadEnrollments();
          }
        )
        .subscribe();
    });

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [yogaSessions]);

  // Transform sessions to display format
  const sessions = yogaSessions.map((s) => {
    const enrolled = enrollmentCounts[s.id] || 0;
    const remaining = Math.max(0, s.capacity - enrolled);

    return {
      id: s.id,
      name: s.title,
      level: s.level || "Tous niveaux",
      instructor: s.instructor_name || "Instructeur",
      instructorImg: "https://images.unsplash.com/photo-1612944095914-33fd0a85fcfc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      duration: `${s.duration_min || 60} min`,
      price: s.price_mad,
      date: new Date(s.starts_at).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      spots: remaining,
      rating: 4.8,
      img: s.image_url || "https://images.unsplash.com/photo-1760774714285-61ff516f86c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      enrolled,
      capacity: s.capacity,
      startsAt: s.starts_at,
    };
  });

  const filteredSessions = useMemo(() => {
    if (activeFilter === "Tous") return sessions;
    return sessions.filter((session) => session.level === activeFilter);
  }, [activeFilter, sessions]);

  const handleReserveYoga = async (session: typeof sessions[0]) => {
    if (!user?.id) {
      Alert.alert("Erreur", t("please_login_book"));
      return;
    }

    setLoadingSessionId(session.id);
    try {
      // Check if capacity is full
      if (session.enrolled >= session.capacity) {
        Alert.alert("Séance complète", "Toutes les places sont prises pour cette séance");
        setLoadingSessionId(null);
        return;
      }

      // Check if already enrolled (safer: use limit(1))
      const { data: existingArr, error: existingErr } = await supabase
        .from("yoga_enrollments")
        .select("session_id")
        .eq("session_id", session.id)
        .eq("patient_id", user.id)
        .limit(1);

<<<<<<< HEAD
      if (existingErr) {
        console.warn("Warning checking existing enrollment:", existingErr);
      }
      if (existingArr && existingArr.length > 0) {
        Alert.alert("Déjà inscrit", "Vous êtes déjà inscrit à cette séance de yoga");
        // refresh counts for this session
        try {
          const { count } = await supabase
            .from("yoga_enrollments")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id);
          setEnrollmentCounts((prev) => ({ ...prev, [session.id]: count ?? 0 }));
        } catch (e) {
          console.warn("Could not refresh enrollment count", e);
        }
=======
      if (existing) {
        Alert.alert(t("already_enrolled"), t("already_enrolled_msg"));
>>>>>>> 5b10d8c506d682db78e7a0dff991e92e61bc9769
        setLoadingSessionId(null);
        return;
      }

      // 1. Create yoga enrollment (tracks the yoga session enrollment)
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("yoga_enrollments")
        .insert([
          {
            session_id: session.id,
            patient_id: user.id,
          },
        ])
        .select()
        .single();

      if (enrollmentError) {
        // Handle duplicate key (race condition) gracefully
        const msg = enrollmentError.message || "";
        const code = (enrollmentError.code || "").toString();
        if (code === "23505" || msg.toLowerCase().includes("duplicate key")) {
          Alert.alert("Déjà inscrit", "Vous êtes déjà inscrit à cette séance de yoga");
          try {
            const { count } = await supabase
              .from("yoga_enrollments")
              .select("*", { count: "exact", head: true })
              .eq("session_id", session.id);
            setEnrollmentCounts((prev) => ({ ...prev, [session.id]: count ?? 0 }));
          } catch (e) {
            console.warn("Could not refresh enrollment count", e);
          }

          setLoadingSessionId(null);
          return;
        }
        throw new Error(`Erreur lors de l'inscription: ${enrollmentError.message}`);
      }

      // refresh enrollment count after successful insert
      try {
        const { count } = await supabase
          .from("yoga_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("session_id", session.id);
        setEnrollmentCounts((prev) => ({ ...prev, [session.id]: count ?? 0 }));
      } catch (e) {
        console.warn("Could not refresh enrollment count", e);
      }

      // 2. Create booking for admin tracking (optional, for bookings history)
      const bookingData = {
        patient_id: user.id,
        professional_id: null,
        specialty: "yoga_instructor",
        status: "matched",
        urgency: "normal" as const,
        scheduled_at: (() => {
          try {
            const t = session.startsAt ? new Date(session.startsAt) : null;
            if (t && !Number.isNaN(t.getTime())) return t.toISOString();
            return new Date().toISOString();
          } catch (e) {
            return new Date().toISOString();
          }
        })(),
        address: "Séance de yoga",
        notes: `Séance: ${session.name}`,
        budget_min_mad: session.price,
        budget_max_mad: session.price,
        final_price_mad: session.price,
      };

      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
<<<<<<< HEAD
        .insert([bookingData])
=======
        .insert([
          {
            patient_id: user.id,
            professional_id: null, // No professional for yoga
            specialty: "yoga_instructor",
            status: "matched",
            urgency: "normal",
            scheduled_at: session.date || new Date().toISOString(),
            address: t("yoga_class"),
            notes: `Réservation yoga: ${session.name} - Instructeur: ${session.instructor}`,
            budget_min_mad: session.price,
            budget_max_mad: session.price,
            final_price_mad: session.price,
          },
        ])
>>>>>>> 5b10d8c506d682db78e7a0dff991e92e61bc9769
        .select()
        .single();

      if (bookingError) {
        // Log but don't fail - enrollment is what matters
        console.warn("Warning: booking creation failed:", bookingError);
      }

      if (booking) {
        await notifyAdminNewBooking(booking);
      }

      Alert.alert(
        "✅ Inscription confirmée!",
        `Vous êtes inscrit à "${session.name}".\n\nVous pouvez voir cette séance dans vos réservations.`,
        [
          {
<<<<<<< HEAD
            text: "Voir mes réservations",
            onPress: () => {
              setLoadingSessionId(null);
              router.push("/patient/bookings");
            },
=======
            text: t("see_my_bookings"),
            onPress: () => router.push("/patient/bookings"),
>>>>>>> 5b10d8c506d682db78e7a0dff991e92e61bc9769
          },
          {
            text: "Fermer",
            onPress: () => setLoadingSessionId(null),
          },
        ]
      );
    } catch (err) {
      console.error("[YogaCatalog] Erreur lors de la réservation:", err);
      Alert.alert("Erreur", "Impossible de créer la réservation. Essayez de nouveau.");
      setLoadingSessionId(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("yoga_sessions")}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {filters.map((filter) => {
            const active = filter === activeFilter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{t("loading_sessions")}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>❌ Erreur lors du chargement des séances</Text>
            <Text style={[styles.errorText, { marginTop: 8, fontSize: 12 }]}>{t("check_connection_retry")}</Text>
          </View>
        ) : filteredSessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>📋 Aucune séance disponible</Text>
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 8, color: Colors.textMuted }]}>
              Revenez bientôt pour voir les nouvelles séances de yoga!
            </Text>
          </View>
        ) : (
          filteredSessions.map((session) => (
            <View key={session.id} style={styles.card}>
            <View style={styles.cardImageWrap}>
              <Image source={{ uri: session.img }} style={styles.cardImage} />
              <View style={styles.imageOverlay} />
              <Text style={styles.levelBadge}>{t(session.level)}</Text>
              <TouchableOpacity
                onPress={() =>
                  setLikes((prev) => ({ ...prev, [session.id]: !prev[session.id] }))
                }
                style={styles.likeBtn}
              >
                <Heart
                  size={15}
                  color={likes[session.id] ? Colors.danger : Colors.textMuted}
                  fill={likes[session.id] ? Colors.danger : "transparent"}
                />
              </TouchableOpacity>
              <View style={styles.ratingOverlay}>
                <Star size={12} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.ratingOverlayText}>{session.rating}</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.sessionName}>{session.name}</Text>
              <View style={styles.instructorRow}>
                <Image source={{ uri: session.instructorImg }} style={styles.instructorAvatar} />
                <Text style={styles.instructorName}>{session.instructor}</Text>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Clock3 size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{session.duration}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Calendar size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{session.date}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Users size={12} color={Colors.accent} />
                  <Text style={[styles.metaText, { color: Colors.accent }]}>
                    {session.spots} places
                  </Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.price}>
                  {session.price} <Text style={styles.priceUnit}>MAD / séance</Text>
                </Text>
                <TouchableOpacity 
                  style={[styles.bookBtn, loadingSessionId === session.id && styles.bookBtnDisabled]}
                  onPress={() => handleReserveYoga(session)}
                  disabled={loadingSessionId === session.id}
                >
                  {loadingSessionId === session.id ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.bookBtnText}>{t("reserve")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: {
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: "600" },
  filtersRow: { gap: 8 },
  filterChip: {
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterText: { color: Colors.textMuted, fontSize: 13, fontWeight: "500" },
  filterTextActive: { color: "white" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, gap: 12 },
  card: { backgroundColor: "white", borderRadius: 16, overflow: "hidden" },
  cardImageWrap: { height: 146, position: "relative" },
  cardImage: { width: "100%", height: "100%" },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  levelBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: "500",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  likeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingOverlay: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingOverlayText: { color: "white", fontSize: 12, fontWeight: "600" },
  cardBody: { padding: 14 },
  sessionName: { color: Colors.textPrimary, fontSize: 16, fontWeight: "600", marginBottom: 6 },
  instructorRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  instructorAvatar: { width: 20, height: 20, borderRadius: 10 },
  instructorName: { color: Colors.textMuted, fontSize: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 11 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { color: Colors.primary, fontSize: 18, fontWeight: "700" },
  priceUnit: { color: Colors.textMuted, fontSize: 11, fontWeight: "400" },
  bookBtn: {
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  bookBtnText: { color: "white", fontSize: 13, fontWeight: "600" },
  bookBtnDisabled: { opacity: 0.6 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textMuted,
    fontSize: 14,
  },
  errorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
  },
  errorText: {
    color: "#991B1B",
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
});
