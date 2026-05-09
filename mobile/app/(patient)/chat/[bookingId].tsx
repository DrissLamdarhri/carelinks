/**
 * Live Chat screen — real-time messaging on a booking.
 * Mirrors ChatScreen.tsx (web) — uses useBookingMessages hook.
 */

import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";

import { useAuth } from "../../../../shared/auth-context";
import { useBookingMessages } from "../../../../shared/db/realtime";
import { db } from "../../../../shared/db/dal";
import type { Message } from "../../../../shared/db/types";

export default function ChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { messages, loading } = useBookingMessages(bookingId ?? null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || !user || !bookingId) return;
    setText("");
    setSending(true);
    try {
      await db.messages.send({
        booking_id: bookingId,
        sender_id: user.id,
        body,
      });
    } catch (err: any) {
      setText(body); // restore on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View
        className={`mb-3 max-w-[80%] ${isMe ? "self-end" : "self-start"}`}
      >
        <View
          className={`px-4 py-3 rounded-2xl ${
            isMe
              ? "bg-primary rounded-br-sm"
              : "bg-white rounded-bl-sm shadow-sm"
          }`}
        >
          <Text
            className={isMe ? "text-surface" : "text-gray-800"}
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            {item.body}
          </Text>
        </View>
        <Text
          className={`text-xs text-muted mt-1 ${isMe ? "text-right" : "text-left"}`}
          style={{ fontFamily: "DMSans_400Regular" }}
        >
          {new Date(item.created_at).toLocaleTimeString("fr-MA", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      {/* Header */}
      <View className="bg-primary px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <ArrowLeft color="#EDE5CC" size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            className="text-surface text-lg"
            style={{ fontFamily: "DMSerifDisplay_400Regular" }}
          >
            Messagerie
          </Text>
          <Text
            className="text-accent text-xs"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            Réservation #{bookingId?.slice(-6)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-2 h-2 rounded-full bg-green-400" />
          <Text
            className="text-surface/70 text-xs"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            En ligne
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#0D0870" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-12">
                <Text
                  className="text-muted text-center"
                  style={{ fontFamily: "DMSans_400Regular" }}
                >
                  Aucun message pour l'instant.{"\n"}
                  Commencez la conversation !
                </Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View className="flex-row items-end px-4 pb-4 pt-2 bg-white border-t border-gray-100 gap-3">
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-gray-800 max-h-24"
            placeholder="Votre message…"
            placeholderTextColor="#888780"
            value={text}
            onChangeText={setText}
            multiline
            style={{ fontFamily: "DMSans_400Regular" }}
          />
          <TouchableOpacity
            className={`w-11 h-11 rounded-full items-center justify-center ${
              text.trim() ? "bg-primary" : "bg-gray-200"
            }`}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#EDE5CC" size="small" />
            ) : (
              <Send
                color={text.trim() ? "#EDE5CC" : "#888780"}
                size={18}
                strokeWidth={1.5}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
