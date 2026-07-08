import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Phone } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { db } from "@/lib/db/dal";
import { normalizeRouteParam } from "@/lib/demo-booking";
import { LiveChat } from "@/components/LiveChat";
import type { Profile } from "@/lib/db/types";

const NAVY = "#0D0870";

export default function ProChatScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeRouteParam(params.bookingId);

  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!bookingId) { setLoading(false); setErrorMessage(t("reservation_not_found")); return; }
      try {
        const booking = await db.bookings.get(bookingId);
        if (!active) return;
        const patientId = booking.patient_id;
        setRecipientId(patientId);
        const profile = await db.profiles.get(patientId).catch(() => null);
        if (active) setRecipient(profile);
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : t("conversation_unavailable"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [bookingId]);

  const name = recipient?.full_name ?? "Patient";
  const initials = name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 100}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerProfile}>
          {recipient?.avatar_url ? (
            <Image source={{ uri: recipient.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}><Text style={styles.avatarFallbackText}>{initials}</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{name}</Text>
            <Text style={styles.subtitle}>{t("patient")}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => { if (recipient?.phone) void Linking.openURL(`tel:${recipient.phone}`); }}>
          <Phone size={16} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={NAVY} /></View>
      ) : recipientId && bookingId ? (
        <LiveChat bookingId={bookingId} recipientId={recipientId} recipientName={name} recipientAvatar={recipient?.avatar_url ?? null} />
      ) : (
        <View style={styles.center}><Text style={styles.errorText}>{errorMessage ?? t("recipient_not_found")}</Text></View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  headerProfile: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E7E4FA", alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: NAVY, fontSize: 13, fontWeight: "800" },
  title: { fontSize: 15.5, color: Colors.textPrimary, fontWeight: "800" },
  subtitle: { fontSize: 11.5, color: "#25D366", fontWeight: "600" },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40, flex: 1 },
  errorText: { color: Colors.danger, fontSize: 12, textAlign: "center" },
});
