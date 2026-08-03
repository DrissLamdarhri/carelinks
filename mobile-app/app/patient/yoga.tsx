import { useMemo, useState, useEffect } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";

import { ArrowLeft, Calendar, CheckCircle2, Clock3, Flower2, Heart, MapPin, Star, Users } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { useYogaCatalog, createYogaReservation, findExistingYogaReservation } from "@/lib/db/yoga";

const filters = ["Tous", "Débutant", "Intermédiaire", "Avancé"] as const;

export default function YogaCatalogScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { sessions: yogaSessions, loading, error } = useYogaCatalog();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("Tous");
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [alreadyEnrolledOpen, setAlreadyEnrolledOpen] = useState(false);

  const sessions = yogaSessions.map((s) => ({
    id: s.id,
    name: s.title,
    level: s.level || "Tous niveaux",
    instructor: s.instructorDisplayName,
    instructorId: s.instructor_id,
    duration: `${s.duration_min} min`,
    price: s.price_mad,
    date: new Date(s.starts_at).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    startsAtISO: s.starts_at,
    spots: s.spotsLeft,
    rating: 4.8,
    img: s.image_url || null,
    address: s.address || null,
    city: s.city || null,
  }));

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
      // A seat is only ever taken by a REAL, paid reservation (see
      // confirmYogaPayment) — never by tapping "Réserver". So "already
      // reserved" now means one of two things: already enrolled (paid), or
      // already sitting on an unpaid, still-open reservation for this exact
      // class — in that case, resume that checkout instead of creating a
      // second, duplicate booking.
      const existing = await findExistingYogaReservation(session.id, user.id);
      if (existing?.kind === "enrolled") {
        setLoadingSessionId(null);
        setAlreadyEnrolledOpen(true);
        return;
      }
      if (existing?.kind === "pending") {
        setLoadingSessionId(null);
        router.replace(`/patient/payment/${encodeURIComponent(existing.bookingId)}`);
        return;
      }

      // Only a booking is created here — status 'open', same starting point
      // as every other specialty. No seat is consumed and nothing is
      // "confirmed" yet; that only happens once payment actually succeeds.
      const booking = await createYogaReservation({
        patientId: user.id,
        session: {
          id: session.id,
          title: session.name,
          instructorId: session.instructorId,
          instructorName: session.instructor,
          address: session.address,
          city: session.city,
          startsAtISO: session.startsAtISO || new Date().toISOString(),
          priceMad: session.price,
        },
      });

      // Admin visibility of the new booking is handled entirely in Postgres
      // (log_booking_to_admin trigger on bookings INSERT, admin panel reads
      // it with realtime) — no separate client-side call needed.

      setLoadingSessionId(null);
      // replace, not push: this booking now exists and the patient is
      // committed to a checkout — same reasoning as every other step in the
      // accept→pay chain elsewhere in the app (waiting → offers → payment →
      // tracking all use replace), so the empty catalog screen doesn't sit
      // in the back-stack behind an in-progress payment.
      router.replace(`/patient/payment/${encodeURIComponent(booking.id)}`);
    } catch (err) {
      console.error("[YogaCatalog] Erreur lors de la réservation:", err);
      Alert.alert(t("error"), t("cannot_create_booking"));
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

              {session.address || session.city ? (
                <View style={styles.addressRow}>
                  <MapPin size={12} color={Colors.textMuted} />
                  <Text style={styles.addressText} numberOfLines={1}>
                    {[session.address, session.city].filter(Boolean).join(", ")}
                  </Text>
                </View>
              ) : null}

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
                  {session.price} <Text style={styles.priceUnit}>{t("mad_per_session")}</Text>
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

      <Modal
        transparent
        visible={alreadyEnrolledOpen}
        animationType="fade"
        onRequestClose={() => setAlreadyEnrolledOpen(false)}
      >
        <View style={styles.noticeBackdrop}>
          <View style={styles.noticeCard}>
            <View style={styles.noticeIconWrap}>
              <CheckCircle2 size={28} color="#16A34A" />
            </View>
            <Text style={styles.noticeTitle}>{t("already_enrolled")}</Text>
            <Text style={styles.noticeSub}>{t("already_enrolled_msg")}</Text>
            <TouchableOpacity
              style={styles.noticePrimaryBtn}
              onPress={() => {
                setAlreadyEnrolledOpen(false);
                router.push("/patient/bookings");
              }}
            >
              <Text style={styles.noticePrimaryTxt}>{t("see_my_bookings")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.noticeSecondaryBtn} onPress={() => setAlreadyEnrolledOpen(false)}>
              <Text style={styles.noticeSecondaryTxt}>{t("close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  noticeBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  noticeCard: {
    width: "100%", maxWidth: 360, backgroundColor: "#FFFFFF", borderRadius: 24,
    padding: 24, alignItems: "center",
  },
  noticeIconWrap: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: "#DCFCE7",
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  noticeTitle: { fontSize: 17, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  noticeSub: { fontSize: 13, color: Colors.textMuted, textAlign: "center", marginTop: 6, lineHeight: 19 },
  noticePrimaryBtn: {
    height: 50, width: "100%", borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  noticePrimaryTxt: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "700" },
  noticeSecondaryBtn: { height: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
  noticeSecondaryTxt: { color: Colors.textMuted, fontSize: 13.5, fontWeight: "600" },
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
  addressRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  addressText: { flex: 1, color: Colors.textMuted, fontSize: 11.5 },
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
