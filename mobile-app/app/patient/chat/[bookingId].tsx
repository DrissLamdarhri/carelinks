import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Phone, Video } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { db } from "@/lib/db/dal";
import { buildDemoProfile, DEMO_PRO_1_ID, isDemoBookingId, normalizeRouteParam } from "@/lib/demo-booking";
import { LiveChat } from "@/components/LiveChat";
import type { Profile } from "@/lib/db/types";

export default function BookingChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeRouteParam(params.bookingId);
  const isDemoBooking = isDemoBookingId(bookingId);

  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [recipientProfile, setRecipientProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadRecipient = async () => {
      if (!bookingId) {
        setLoading(false);
        setErrorMessage("Réservation introuvable.");
        return;
      }
      if (isDemoBooking) {
        setRecipientId(DEMO_PRO_1_ID);
        setRecipientProfile(buildDemoProfile(DEMO_PRO_1_ID));
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      try {
        const booking = await db.bookings.get(bookingId);
        if (!active) return;
        const counterpart = booking.professional_id ?? booking.patient_id;
        setRecipientId(counterpart);
        const profile = await db.profiles.get(counterpart).catch(() => null);
        if (active) setRecipientProfile(profile);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "Conversation indisponible.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadRecipient();
    return () => {
      active = false;
    };
  }, [bookingId, isDemoBooking]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 20}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerProfile}>
          {recipientProfile?.avatar_url ? (
            <Image source={{ uri: recipientProfile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {(recipientProfile?.full_name ?? "Pro")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </Text>
            </View>
          )}
          <View style={styles.headerTextWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {recipientProfile?.full_name ?? "Professionnel"}
            </Text>
            <Text style={styles.subtitle}>En ligne</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              if (recipientProfile?.phone) {
                void Linking.openURL(`tel:${recipientProfile.phone}`);
              }
            }}
          >
            <Phone size={16} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, styles.videoBtn]}>
            <Video size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : recipientId && bookingId ? (
        <LiveChat bookingId={bookingId} recipientId={recipientId} />
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMessage ?? "Destinataire introuvable."}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: "white",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  headerProfile: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { color: Colors.primary, fontSize: 12, fontWeight: "700" },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 15, color: Colors.textPrimary, fontWeight: "600" },
  subtitle: { fontSize: 11, color: Colors.primary },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  videoBtn: { backgroundColor: Colors.surfaceWarm },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40, flex: 1 },
  errorText: { color: Colors.danger, fontSize: 12, textAlign: "center" },
});
