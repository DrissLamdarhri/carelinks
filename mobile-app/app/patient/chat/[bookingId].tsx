import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { useBookingMessages } from "@/lib/db/realtime";

export default function BookingChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  const { user } = useAuth();

  const { messages, setMessages, loading, error } = useBookingMessages(bookingId);
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages]
  );

  const handleSend = async () => {
    if (!value.trim().length || !user?.id || sending) return;
    setErrorMessage(null);
    setSending(true);
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic = {
      id: optimisticId,
      booking_id: bookingId,
      sender_id: user.id,
      body: value.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setValue("");
    try {
      await db.messages.send({
        booking_id: bookingId,
        sender_id: user.id,
        body: optimistic.body,
      });
      setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
    } catch (error) {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
      setErrorMessage(error instanceof Error ? error.message : "Le message n'a pas pu être envoyé.");
    } finally {
      setSending(false);
    }
  };

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

      <ScrollView style={styles.messagesList} contentContainerStyle={styles.messagesContent}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : null}

        {!loading && sortedMessages.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Commencez la conversation avec votre professionnel.</Text>
          </View>
        ) : null}

        {sortedMessages.map((message) => {
          const mine = message.sender_id === user?.id;
          return (
            <View key={message.id} style={[styles.bubbleRow, mine ? styles.bubbleRight : styles.bubbleLeft]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
                <Text style={[styles.timestamp, mine && styles.timestampMine]}>
                  {new Date(message.created_at).toLocaleTimeString("fr-MA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {(error || errorMessage) && (
        <Text style={styles.errorText}>{error?.message ?? errorMessage}</Text>
      )}

      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={setValue}
          style={styles.input}
          placeholder="Votre message..."
          placeholderTextColor={Colors.textSubtle}
        />
        <TouchableOpacity
          disabled={!value.trim().length || sending}
          onPress={handleSend}
          style={[styles.sendBtn, (!value.trim().length || sending) && styles.sendBtnDisabled]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Send size={16} color="white" />
          )}
        </TouchableOpacity>
      </View>
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
  messagesList: { flex: 1 },
  messagesContent: { paddingHorizontal: 14, paddingVertical: 16, gap: 8 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: "center" },
  bubbleRow: { flexDirection: "row" },
  bubbleLeft: { justifyContent: "flex-start" },
  bubbleRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: "white", borderBottomLeftRadius: 6 },
  bubbleText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  bubbleTextMine: { color: "white" },
  timestamp: { marginTop: 4, fontSize: 10, color: Colors.textMuted, textAlign: "right" },
  timestampMine: { color: "rgba(255,255,255,0.7)" },
  errorText: { paddingHorizontal: 16, paddingBottom: 6, color: Colors.danger, fontSize: 12 },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: Colors.input,
    paddingHorizontal: 14,
    color: Colors.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  sendBtnDisabled: { opacity: 0.6 },
});
