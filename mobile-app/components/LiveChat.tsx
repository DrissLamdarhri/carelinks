import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
} from "react-native";
import { Check, CheckCheck, Send } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  buildDemoMessages,
  buildDemoProfile,
  DEMO_PATIENT_ID,
  DEMO_PRO_1_ID,
  isDemoBookingId,
} from "@/lib/demo-booking";

const NAVY = "#0D0870";

type LiveChatProps = {
  bookingId: string;
  recipientId: string | null;
  recipientName?: string;
  recipientAvatar?: string | null;
};

type MessageRow = {
  id: string;
  booking_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const initialsOf = (name: string) =>
  name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

function BubbleAvatar({ url, name }: { url?: string | null; name: string }) {
  if (url) return <Image source={{ uri: url }} style={styles.bubbleAvatar} />;
  return (
    <View style={[styles.bubbleAvatar, styles.bubbleAvatarFallback]}>
      <Text style={styles.bubbleAvatarTxt}>{initialsOf(name)}</Text>
    </View>
  );
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yest.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-MA", { day: "numeric", month: "long" });
};

export function LiveChat({ bookingId, recipientId: _recipientId, recipientName = "Professionnel", recipientAvatar }: LiveChatProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const isDemoBooking = isDemoBookingId(bookingId);
  const demoRecipientId = _recipientId ?? DEMO_PRO_1_ID;
  const demoPatientId = user?.id ?? DEMO_PATIENT_ID;
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", scrollToBottom);
    return () => showSub.remove();
  }, []);

  const loadMessages = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      if (isDemoBooking) {
        setMessages(buildDemoMessages(bookingId));
        return;
      }
      const { data, error } = await supabase
        .from("messages")
        .select("id, booking_id, sender_id, body, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((data ?? []) as MessageRow[]);
    } catch (error) {
      Alert.alert(t("error"), error instanceof Error ? error.message : t("chat_unavailable"));
    } finally {
      setLoading(false);
    }
  }, [bookingId, isDemoBooking]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!bookingId || isDemoBooking) return;
    const channel = supabase
      .channel(`messages:live:${bookingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const next = payload.new as MessageRow;
          setMessages((prev) => (prev.some((r) => r.id === next.id) ? prev : [...prev, next]));
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [bookingId, isDemoBooking]);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [messages]
  );

  const isMine = (m: MessageRow) =>
    isDemoBooking ? m.sender_id === demoPatientId || m.sender_id === DEMO_PATIENT_ID : m.sender_id === user?.id;

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const body = input.trim();
    setInput("");
    try {
      if (isDemoBooking) {
        setMessages((prev) => [...prev, { id: `demo-msg-${Date.now()}`, booking_id: bookingId, sender_id: demoPatientId, body, created_at: new Date().toISOString() }]);
        return;
      }
      if (!user?.id) throw new Error("Utilisateur non connecté.");
      const { error } = await supabase.from("messages").insert({ booking_id: bookingId, sender_id: user.id, body });
      if (error) throw error;
    } catch (error) {
      Alert.alert(t("error"), error instanceof Error ? error.message : t("send_msg_failed"));
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="small" color={NAVY} /></View>
        ) : sorted.length === 0 ? (
          <View style={styles.emptyWrap}>
            <BubbleAvatar url={recipientAvatar} name={recipientName} />
            <Text style={styles.emptyTitle}>{t("start_conversation")}</Text>
            <Text style={styles.emptySub}>Envoyez un message à {recipientName.split(" ")[0]}.</Text>
          </View>
        ) : null}

        {sorted.map((m, i) => {
          const mine = isMine(m);
          const showDate = i === 0 || new Date(m.created_at).toDateString() !== new Date(sorted[i - 1].created_at).toDateString();
          const lastOfGroup = i === sorted.length - 1 || sorted[i + 1].sender_id !== m.sender_id;
          const time = new Date(m.created_at).toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" });
          return (
            <View key={m.id}>
              {showDate ? (
                <View style={styles.dateWrap}><Text style={styles.dateTxt}>{dayLabel(m.created_at)}</Text></View>
              ) : null}
              <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
                {!mine ? (
                  lastOfGroup ? <BubbleAvatar url={recipientAvatar} name={recipientName} /> : <View style={styles.avatarSpacer} />
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleOther,
                    mine && lastOfGroup && styles.tailMine,
                    !mine && lastOfGroup && styles.tailOther,
                  ]}
                >
                  <Text style={[styles.body, mine && styles.bodyMine]}>{m.body}</Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.time, mine && styles.timeMine]}>{time}</Text>
                    {mine ? <CheckCheck size={13} color="rgba(255,255,255,0.7)" /> : null}
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t("write_message")}
          placeholderTextColor={Colors.textSubtle}
          selectionColor={NAVY}
          style={styles.input}
          onFocus={scrollToBottom}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          {sending ? <ActivityIndicator size="small" color="white" /> : <Send size={17} color="white" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 14, paddingVertical: 14, gap: 3 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },

  emptyWrap: { alignItems: "center", paddingVertical: 50, gap: 6 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginTop: 8 },
  emptySub: { color: Colors.textMuted, fontSize: 13 },

  dateWrap: { alignItems: "center", marginVertical: 10 },
  dateTxt: { backgroundColor: "rgba(13,8,112,0.07)", color: Colors.primary, fontSize: 11, fontWeight: "700", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },

  row: { flexDirection: "row", alignItems: "flex-end", gap: 7, marginTop: 2 },
  rowMine: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  avatarSpacer: { width: 26 },
  bubbleAvatar: { width: 26, height: 26, borderRadius: 13 },
  bubbleAvatarFallback: { backgroundColor: "#E7E4FA", alignItems: "center", justifyContent: "center" },
  bubbleAvatarTxt: { color: NAVY, fontSize: 10, fontWeight: "800" },

  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: NAVY },
  bubbleOther: { backgroundColor: "white", shadowColor: NAVY, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  tailMine: { borderBottomRightRadius: 5 },
  tailOther: { borderBottomLeftRadius: 5 },
  body: { color: Colors.textPrimary, fontSize: 14.5, lineHeight: 20 },
  bodyMine: { color: "white" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 3 },
  time: { color: Colors.textSubtle, fontSize: 10 },
  timeMine: { color: "rgba(255,255,255,0.65)" },

  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 14, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 23, backgroundColor: Colors.surfaceWarm, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, color: Colors.textPrimary, fontSize: 14.5 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
});
