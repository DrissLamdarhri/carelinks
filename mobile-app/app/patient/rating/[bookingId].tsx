import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Star, ThumbsUp } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { db } from "@/lib/db/dal";
import { DEMO_PRO_1_ID, isDemoBookingId, normalizeRouteParam } from "@/lib/demo-booking";
import { RatingForm } from "@/components/RatingForm";

export default function RatingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeRouteParam(params.bookingId);
  const isDemoBooking = isDemoBookingId(bookingId);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rating = 5;
  const [submitted, setSubmitted] = useState(false);

  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  useEffect(() => {
    let active = true;
    const loadBooking = async () => {
      if (!bookingId) {
        setLoading(false);
        setErrorMessage("Réservation introuvable.");
        return;
      }

      if (isDemoBooking) {
        setProfessionalId(DEMO_PRO_1_ID);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage(null);
      try {
        const booking = await db.bookings.get(bookingId);
        if (!active) return;
        setProfessionalId(booking.professional_id ?? null);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "Impossible de charger la réservation.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadBooking();
    return () => {
      active = false;
    };
  }, [bookingId, isDemoBooking]);

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
          <Text style={styles.subtitle}>Réservation #{(bookingId ?? "—").slice(0, 8)}</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : null}

        {!loading && professionalId && bookingId ? (
          <RatingForm
            bookingId={bookingId}
            professionalId={professionalId}
            onSubmitted={() => setSubmitted(true)}
          />
        ) : null}

        {!loading && !professionalId ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              {errorMessage ?? "Professionnel introuvable pour cette réservation."}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
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
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 32 },
  errorCard: {
    borderRadius: 14,
    backgroundColor: "#FFF4F4",
    borderWidth: 1,
    borderColor: "#FAD3D3",
    padding: 12,
  },
  errorText: { color: Colors.danger, fontSize: 13 },
  footer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  skipBtn: { height: 42, alignItems: "center", justifyContent: "center", marginTop: 4 },
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
