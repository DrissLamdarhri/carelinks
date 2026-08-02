/**
 * Shown right after a successful yoga payment — the full recap (instructor,
 * center address + itinerary, date/time, amount paid) instead of dropping
 * the patient straight back onto the bookings list with no confirmation.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2 } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { getBookingDetails } from "@/lib/db/yoga";
import { YogaBookingDetails } from "@/components/YogaBookingDetails";
import type { YogaBookingDetails as YogaBookingDetailsT } from "@/types/yoga";

export default function YogaConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;

  const [details, setDetails] = useState<YogaBookingDetailsT | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!bookingId) { setLoading(false); return; }
    void getBookingDetails(bookingId)
      .then((d) => { if (!cancelled) setDetails(d); })
      .catch(() => { if (!cancelled) setDetails(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId]);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <CheckCircle2 size={32} color="#16A34A" />
          </View>
          <Text style={s.heroTitle}>Réservation confirmée</Text>
          <Text style={s.heroSub}>Votre place pour ce cours de yoga est réservée.</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
        ) : details ? (
          <YogaBookingDetails details={details} />
        ) : (
          <Text style={s.errorTxt}>Impossible de charger le récapitulatif.</Text>
        )}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace("/patient/bookings")}>
          <Text style={s.primaryBtnTxt}>Voir mes réservations</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { padding: 20, paddingBottom: 12 },
  hero: { alignItems: "center", marginBottom: 22, marginTop: 12 },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#DCFCE7",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  heroTitle: { fontSize: 20, fontWeight: "800", color: Colors.textPrimary },
  heroSub: { fontSize: 13, color: Colors.textMuted, marginTop: 4, textAlign: "center" },
  errorTxt: { color: Colors.textMuted, textAlign: "center", marginTop: 30 },
  footer: { padding: 20, backgroundColor: Colors.surfaceWarm },
  primaryBtn: { height: 54, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  primaryBtnTxt: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
