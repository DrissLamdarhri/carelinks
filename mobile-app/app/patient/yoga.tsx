import { useMemo, useState } from "react";
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
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { notifyAdminNewBooking } from "@/lib/admin/booking-notifications";

const filters = ["Tous", "Débutant", "Intermédiaire", "Avancé"] as const;

const sessions = [
  {
    id: "s1",
    name: "Hatha Flow Matinal",
    level: "Débutant",
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
    level: "Intermédiaire",
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
    level: "Tous niveaux",
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

export default function YogaCatalogScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("Tous");
  const [likes, setLikes] = useState<Record<string, boolean>>({ s2: true });
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    if (activeFilter === "Tous") return sessions;
    return sessions.filter((session) => session.level === activeFilter);
  }, [activeFilter]);

  const handleReserveYoga = async (session: typeof sessions[0]) => {
    if (!user?.id) {
      Alert.alert("Erreur", "Veuillez vous connecter pour réserver");
      return;
    }

    setLoadingSessionId(session.id);
    try {
      // Créer la réservation
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert([
          {
            patient_id: user.id,
            specialty: "yoga_instructor",
            status: "matched",
            urgency: "normal",
            scheduled_at: new Date().toISOString(), // À améliorer avec la vraie date
            address: "Meknès, Maroc", // À améliorer avec l'adresse du patient
            notes: `Réservation yoga: ${session.name} - ${session.instructor}`,
            budget_min_mad: session.price,
            budget_max_mad: session.price,
            final_price_mad: session.price,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (booking) {
        // Notifier l'admin automatiquement
        await notifyAdminNewBooking(booking);

        Alert.alert(
          "✅ Réservation confirmée!",
          `${session.name} réservé chez ${session.instructor}.\n\nLa réservation a été envoyée à l'administrateur.`,
          [
            {
              text: "Voir mes réservations",
              onPress: () => router.push("/patient/bookings"),
            },
            {
              text: "Fermer",
              onPress: () => setLoadingSessionId(null),
            },
          ]
        );
      }
    } catch (err) {
      console.error("Erreur lors de la réservation:", err);
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
          <Text style={styles.headerTitle}>Séances de Yoga</Text>
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
        {filteredSessions.map((session) => (
          <View key={session.id} style={styles.card}>
            <View style={styles.cardImageWrap}>
              <Image source={{ uri: session.img }} style={styles.cardImage} />
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
                    <Text style={styles.bookBtnText}>Réserver</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
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
});
