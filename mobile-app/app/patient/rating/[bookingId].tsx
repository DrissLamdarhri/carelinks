import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThumbsUp } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { db } from "@/lib/db/dal";
import { buildDemoBooking, buildDemoProfile, DEMO_PRO_1_ID, isDemoBookingId, normalizeRouteParam } from "@/lib/demo-booking";
import { RatingForm } from "@/components/RatingForm";
import type { Booking, Profile } from "@/lib/db/types";

export default function RatingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeRouteParam(params.bookingId);
  const isDemoBooking = isDemoBookingId(bookingId);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [professional, setProfessional] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    const loadBooking = async () => {
      if (!bookingId) {
        setLoading(false);
        setErrorMessage("Réservation introuvable.");
        return;
      }

      if (isDemoBooking) {
        const nextBooking = buildDemoBooking(bookingId);
        const nextProfessional = buildDemoProfile(DEMO_PRO_1_ID);
        setBooking(nextBooking);
        setProfessionalId(DEMO_PRO_1_ID);
        setProfessional(nextProfessional);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage(null);
      try {
        const booking = await db.bookings.get(bookingId);
        if (!active) return;
        setBooking(booking);
        setProfessionalId(booking.professional_id ?? null);
        if (booking.professional_id) {
          const pro = await db.profiles.get(booking.professional_id).catch(() => null);
          if (active) setProfessional(pro);
        }
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
        <TouchableOpacity
          style={styles.successBtn}
          onPress={() => router.replace(bookingId ? `/patient/payment/${bookingId}` : "/patient")}
        >
          <Text style={styles.successBtnText}>Procéder au paiement</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : null}

        {!loading && professionalId && bookingId && booking ? (
          <RatingForm
            bookingId={bookingId}
            professionalId={professionalId}
            professionalName={professional?.full_name ?? "Professionnel"}
            professionalAvatar={professional?.avatar_url ?? null}
            subtitle={booking.specialty.replaceAll("_", " ")}
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
      </View>

      {!submitted ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => router.replace(bookingId ? `/patient/payment/${bookingId}` : "/patient")}
          >
            <Text style={styles.skipBtnText}>Passer</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "white" },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20, justifyContent: "center" },
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
