import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Send } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  buildDemoMessages,
  buildDemoProfile,
  DEMO_PATIENT_ID,
  DEMO_PRO_1_ID,
  isDemoBookingId,
} from "@/lib/demo-booking";

type LiveChatProps = {
  bookingId: string;
  recipientId: string | null;
};

type MessageRow = {
  id: string;
  booking_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type ChatMessage = MessageRow & {
  sender_name: string;
};

export function LiveChat({ bookingId, recipientId: _recipientId }: LiveChatProps) {
  const { user } = useAuth();
  const isDemoBooking = isDemoBookingId(bookingId);
  const demoRecipientId = _recipientId ?? DEMO_PRO_1_ID;
  const demoPatientId = user?.id ?? DEMO_PATIENT_ID;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const namesRef = useRef<Map<string, string>>(new Map());
  const scrollRef = useRef<ScrollView | null>(null);

  const hydrateSenderName = useCallback(async (senderId: string) => {
    if (namesRef.current.has(senderId)) return namesRef.current.get(senderId)!;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", senderId)
      .maybeSingle();
    if (error) throw error;
    const fullName = (data?.full_name as string) || "Utilisateur";
    namesRef.current.set(senderId, fullName);
    return fullName;
  }, []);

  const loadMessages = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      if (isDemoBooking) {
        const demoPro = buildDemoProfile(demoRecipientId);
        const rows = buildDemoMessages(bookingId);
        setMessages(
          rows.map((row) => ({
            ...row,
            sender_name:
              row.sender_id === demoRecipientId
                ? demoPro.full_name
                : row.sender_id === demoPatientId || row.sender_id === DEMO_PATIENT_ID
                  ? "Vous"
                  : "Utilisateur",
          }))
        );
        return;
      }

      const { data, error } = await supabase
        .from("messages")
        .select("id, booking_id, sender_id, body, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as MessageRow[];
      const senderIds = Array.from(new Set(rows.map((row) => row.sender_id)));

      if (senderIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", senderIds);
        if (profileError) throw profileError;
        for (const row of profiles ?? []) {
          namesRef.current.set(row.id as string, (row.full_name as string) || "Utilisateur");
        }
      }

      setMessages(
        rows.map((row) => ({
          ...row,
          sender_name: namesRef.current.get(row.sender_id) ?? "Utilisateur",
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat indisponible.";
      Alert.alert("Erreur", message);
    } finally {
      setLoading(false);
    }
  }, [bookingId, demoPatientId, demoRecipientId, isDemoBooking]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!bookingId || isDemoBooking) return;
    const channel = supabase
      .channel(`messages:live:${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `booking_id=eq.${bookingId}`,
        },
        async (payload) => {
          const next = payload.new as MessageRow;
          let senderName = namesRef.current.get(next.sender_id);
          if (!senderName) {
            try {
              senderName = await hydrateSenderName(next.sender_id);
            } catch {
              senderName = "Utilisateur";
            }
          }

          setMessages((prev) => {
            if (prev.some((row) => row.id === next.id)) return prev;
            return [...prev, { ...next, sender_name: senderName ?? "Utilisateur" }];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, hydrateSenderName, isDemoBooking]);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [messages]
  );

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const body = input.trim();
    setInput("");
    try {
      if (isDemoBooking) {
        const localMessage: ChatMessage = {
          id: `demo-msg-${Date.now()}`,
          booking_id: bookingId,
          sender_id: demoPatientId,
          body,
          created_at: new Date().toISOString(),
          sender_name: "Vous",
        };
        setMessages((prev) => [...prev, localMessage]);
        return;
      }

      if (!user?.id) {
        throw new Error("Utilisateur non connecté.");
      }

      const { error } = await supabase.from("messages").insert({
        booking_id: bookingId,
        sender_id: user.id,
        body,
      });
      if (error) throw error;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'envoyer le message.";
      Alert.alert("Erreur", message);
      setInput(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : null}

        {!loading && sorted.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Aucun message pour le moment.</Text>
          </View>
        ) : null}

        {sorted.map((message) => {
          const mine = isDemoBooking
            ? message.sender_name === "Vous" ||
              message.sender_id === demoPatientId ||
              message.sender_id === DEMO_PATIENT_ID
            : message.sender_id === user?.id;
          return (
            <View key={message.id} style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.senderText, mine && styles.senderTextMine]}>{message.sender_name}</Text>
                <Text style={[styles.bodyText, mine && styles.bodyTextMine]}>{message.body}</Text>
                <Text style={[styles.timeText, mine && styles.timeTextMine]}>
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

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Votre message..."
          placeholderTextColor={Colors.textSubtle}
          selectionColor={Colors.primary}
          cursorColor={Colors.primary}
          style={styles.input}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.65 }]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Send size={16} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
  },
  rowMine: {
    justifyContent: "flex-end",
  },
  rowOther: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: "white",
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "#EDEDED",
  },
  senderText: {
    color: Colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
    fontWeight: "600",
  },
  senderTextMine: {
    color: "rgba(255,255,255,0.75)",
  },
  bodyText: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  bodyTextMine: {
    color: "white",
  },
  timeText: {
    marginTop: 4,
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: "right",
  },
  timeTextMine: {
    color: "rgba(255,255,255,0.75)",
  },
  inputRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
