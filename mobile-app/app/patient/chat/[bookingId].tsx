import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { LiveChat } from "@/components/LiveChat";

export default function BookingChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  const { user, role } = useAuth();

  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadRecipient = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      try {
        const booking = await db.bookings.get(bookingId);
        if (!active) return;
        const counterpart =
          role === "pro" ? booking.patient_id : booking.professional_id ?? booking.patient_id;
        setRecipientId(counterpart);
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
  }, [bookingId, role, user?.id]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Chat de réservation</Text>
          <Text style={styles.subtitle}>Booking #{bookingId.slice(0, 8)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : recipientId ? (
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
    gap: 10,
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
  title: { fontSize: 16, color: Colors.textPrimary, fontWeight: "600" },
  subtitle: { fontSize: 11, color: Colors.textMuted },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40, flex: 1 },
  errorText: { color: Colors.danger, fontSize: 12, textAlign: "center" },
});

