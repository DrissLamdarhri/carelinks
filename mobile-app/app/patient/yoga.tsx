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

import { ArrowLeft, Calendar, Clock3, Flower2, Heart, Star, Users } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { notifyAdminNewBooking } from "@/lib/admin/booking-notifications";
import { useYogaSessions } from "@/lib/yoga-sessions";

const filters = ["Tous", "Débutant", "Intermédiaire", "Avancé"] as const;

export default function YogaCatalogScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { sessions: yogaSessions, loading, error } = useYogaSessions();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("Tous");
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  // Only use database sessions - don't fall back to mock data
  // (Mock data has invalid IDs for enrollment)
  const sessions = yogaSessions.length > 0 
    ? yogaSessions.map((s) => ({
        id: s.id, // Keep UUID from database
        name: s.title,
        level: s.level || "Tous niveaux",
        instructor: s.instructor,
        duration: `${s.durationMin} min`,
        price: s.priceMad,
        date: new Date(s.startsAt).toLocaleDateString("fr-FR", { 
          day: "2-digit", 
          month: "short", 
          hour: "2-digit", 
          minute: "2-digit" 
        }),
        startsAtISO: s.startsAt,
        spots: s.capacity - s.enrolledCount,
        rating: 4.8,
        img: s.imageUrl || null,
      }))
    : []; // Empty array, not fallback

  const filteredSessions = useMemo(() => {
    if (activeFilter === "Tous") return sessions;
    // A "Tous niveaux" class suits every level, so it must stay visible under
    // each filter — otherwise picking "Débutant" hides classes open to them.
    return sessions.filter(
      (session) => session.level === activeFilter || session.level === "Tous niveaux",
    );
  }, [activeFilter, sessions]);

  const handleReserveYoga = async (session: typeof sessions[0]) => {
    if (!user?.id) {
      Alert.alert("Erreur", t("please_login_book"));
      return;
    }

    if (session.spots <= 0) {
      Alert.alert(t("session_full"), t("session_full_msg"));
      return;
    }

    setLoadingSessionId(session.id);
    try {
      // Check if already enrolled
      const { data: existing } = await supabase
        .from("yoga_enrollments")
        .select("*")
        .eq("session_id", session.id)
        .eq("patient_id", user.id)
        .single();

      if (existing) {
        Alert.alert(t("already_enrolled"), t("already_enrolled_msg"));
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
        throw new Error(`Erreur lors de l'inscription: ${enrollmentError.message}`);
      }

      // 2. Create booking for admin tracking
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert([
          {
            patient_id: user.id,
            professional_id: null, // No professional for yoga
            specialty: "yoga_instructor",
            status: "matched",
            urgency: "normal",
            scheduled_at: session.startsAtISO || new Date().toISOString(),
            address: t("yoga_class"),
            notes: `Réservation yoga: ${session.name} - Instructeur: ${session.instructor}`,
            budget_min_mad: session.price,
            budget_max_mad: session.price,
            final_price_mad: session.price,
          },
        ])
        .select()
        .single();

      if (bookingError) {
        // Even if booking fails, enrollment succeeded
        console.warn("Booking creation failed but enrollment succeeded:", bookingError);
      }

      // Link the enrollment to the booking that carries its payment. Without
      // this the admin's "Terminer & payer" cannot find the escrow to release,
      // and the money would stay frozen (migration 0031).
      if (booking?.id && enrollment?.id) {
        const { error: linkError } = await supabase
          .from("yoga_enrollments")
          .update({ booking_id: booking.id })
          .eq("id", enrollment.id);
        if (linkError) console.warn("Could not link enrollment to booking:", linkError.message);
      }

      if (booking) {
        // Notifier l'admin automatiquement
        await notifyAdminNewBooking(booking);
      }

      setLoadingSessionId(null);

      // Escrow, like every other service: hold the class price up-front on the
      // booking we just created. The payment screen routes yoga back to bookings
      // on success (no live tracking for a class).
      if (booking?.id) {
        router.replace(`/patient/payment/${encodeURIComponent(booking.id)}`);
      } else {
        // Enrollment saved but the booking row failed — no price to hold, so
        // just confirm and send them to their bookings.
        Alert.alert(t("enrollment_confirmed"), t("enrollment_confirmed_msg"), [
          { text: t("see_my_bookings"), onPress: () => router.push("/patient/bookings") },
        ]);
      }
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

      <View style={styles.list}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{t("loading_sessions")}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{t("sessions_load_error")}</Text>
            <Text style={[styles.errorText, { marginTop: 8, fontSize: 12 }]}>{t("check_connection_retry")}</Text>
          </View>
        ) : filteredSessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>🧘 {t("no_sessions_available")}</Text>
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 8, color: Colors.textMuted }]}>
              {t("sessions_come_back")}
            </Text>
          </View>
        ) : (
          // Classes stay a vertical column — the only left/right scrolling on
          // this screen is the level filter row above (débutant → intermédiaire…).
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
          {filteredSessions.map((session) => (
            <View key={session.id} style={styles.card}>
            <View style={styles.cardImageWrap}>
              {session.img ? (
                <Image source={{ uri: session.img }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, styles.cardImageFallback]}>
                  <Flower2 size={34} color="#5BB8D4" strokeWidth={1.5} />
                </View>
              )}
              <View style={styles.imageOverlay} />
              <Text style={styles.levelBadge}>{session.level}</Text>
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
                <View style={[styles.instructorAvatar, styles.instructorAvatarFallback]}>
                  <Text style={styles.instructorInitials}>
                    {(session.instructor || "?").split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase()}
                  </Text>
                </View>
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
                    {session.spots > 0 ? `${session.spots} ${t("spots_left")}` : t("full")}
                  </Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.price}>
                  {session.price} <Text style={styles.priceUnit}>MAD / séance</Text>
                </Text>
                <TouchableOpacity 
                  style={[styles.bookBtn, (loadingSessionId === session.id || session.spots <= 0) && styles.bookBtnDisabled]}
                  onPress={() => handleReserveYoga(session)}
                  disabled={loadingSessionId === session.id || session.spots <= 0}
                >
                  {loadingSessionId === session.id ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.bookBtnText}>{session.spots <= 0 ? t("full") : t("reserve")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
          ))}
          </ScrollView>
        )}
      </View>
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
  listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36, gap: 14 },
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#0D0870",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardImageWrap: { height: 146, position: "relative" },
  cardImageFallback: { backgroundColor: "#D8F0F4", alignItems: "center", justifyContent: "center" },
  instructorAvatarFallback: { backgroundColor: "#E7E4FA", alignItems: "center", justifyContent: "center" },
  instructorInitials: { color: "#0D0870", fontSize: 10, fontWeight: "800" },
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
