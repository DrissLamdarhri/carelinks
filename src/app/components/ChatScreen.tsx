import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  ArrowLeft,
  Video,
  Phone,
  Paperclip,
  Send,
  Image,
  Mic,
  Loader2,
} from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useBookingMessages } from "../../lib/db/realtime";
import { db } from "../../lib/db";
import { useAuth } from "../../lib/auth-context";

// ── Demo/fallback messages for when no bookingId is passed ───────────────────
const demoMessages = [
  { id: "d1", sender_id: "pro", body: "Bonjour, comment puis-je vous aider ?", created_at: new Date(Date.now() - 180000).toISOString() },
  { id: "d2", sender_id: "me", body: "Bonjour, je voudrais confirmer mon RDV", created_at: new Date(Date.now() - 120000).toISOString() },
  { id: "d3", sender_id: "pro", body: "Je confirme votre rendez-vous de 45 minutes. À bientôt !", created_at: new Date(Date.now() - 60000).toISOString() },
  { id: "d4", sender_id: "me", body: "Parfait, merci beaucoup ! 🙏", created_at: new Date(Date.now() - 30000).toISOString() },
];

function formatTime(isoDate: string) {
  try {
    return new Date(isoDate).toLocaleTimeString("fr", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ChatScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const state = location.state as {
    bookingId?: string;
    proName?: string;
    proAvatar?: string;
    proPhone?: string;
  } | null;

  const bookingId = state?.bookingId ?? null;
  const proName = state?.proName ?? "Dr. Dalila Mansouri";
  const proAvatar =
    state?.proAvatar ??
    "https://images.unsplash.com/photo-1621255612554-440c5e7b21b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmZW1hbGUlMjBwc3ljaG9sb2dpc3QlMjB0aGVyYXBpc3QlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzYwMDc2MjJ8MA&ixlib=rb-4.1.0&q=80&w=400";
  const proPhone = state?.proPhone ?? null;

  // Real-time messages from Supabase (only when bookingId is available)
  const {
    messages: realtimeMessages,
    setMessages,
    loading,
  } = useBookingMessages(bookingId);

  // Use realtime messages or demo fallback
  const displayMessages =
    bookingId && (loading || realtimeMessages.length > 0)
      ? realtimeMessages
      : bookingId
      ? []
      : demoMessages;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [displayMessages]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setShowAttach(false);

    if (!bookingId || !user?.id) {
      // Demo mode — just append locally
      setMessages((prev: any) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          sender_id: "me",
          body: text,
          booking_id: "",
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }

    setSending(true);
    try {
      // Optimistic insert
      const optimistic = {
        id: `optimistic-${Date.now()}`,
        booking_id: bookingId,
        sender_id: user.id,
        body: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev: any) => [...prev, optimistic]);

      // Persist to Supabase
      await db.messages.send({
        booking_id: bookingId,
        sender_id: user.id,
        body: text,
      });
    } catch (err: any) {
      console.error("Send message error:", err);
      toast.error("Erreur lors de l'envoi du message");
      // Remove optimistic message on error
      setMessages((prev: any) =>
        prev.filter((m: any) => !m.id.startsWith("optimistic-"))
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F5F5]">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3 border-b border-[#F0F0F0]">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-[#F3F3F5] flex items-center justify-center flex-shrink-0"
        >
          <ArrowLeft size={18} className="text-[#1A1A1A]" />
        </button>
        <ImageWithFallback
          src={proAvatar}
          alt={proName}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-[15px] text-[#1A1A1A] truncate"
            style={{ fontWeight: 600 }}
          >
            {proName}
          </p>
          <span className="flex items-center gap-1 text-[11px] text-[#0D0870]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0D0870]" />
            {bookingId ? "En ligne · Temps réel" : "En ligne"}
          </span>
        </div>
        {proPhone && (
          <a
            href={`tel:${proPhone}`}
            className="w-9 h-9 rounded-full bg-[#F3F3F5] flex items-center justify-center"
          >
            <Phone size={16} className="text-[#1A1A1A]" />
          </a>
        )}
        {!proPhone && (
          <button className="w-9 h-9 rounded-full bg-[#F3F3F5] flex items-center justify-center">
            <Phone size={16} className="text-[#1A1A1A]" />
          </button>
        )}
        <button className="w-9 h-9 rounded-full bg-[#EDE5CC] flex items-center justify-center">
          <Video size={16} className="text-[#0D0870]" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5"
      >
        {/* Date header */}
        <div className="flex justify-center mb-2">
          <span className="bg-white text-[#888780] text-[11px] px-3 py-1 rounded-full">
            Aujourd'hui
          </span>
        </div>

        {/* Loading state */}
        {loading && bookingId && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="text-[#0D0870] animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && bookingId && displayMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#EDE5CC] flex items-center justify-center mb-3">
              <Send size={22} className="text-[#0D0870]" />
            </div>
            <p className="text-[14px] text-[#888780]">
              Commencez la conversation
            </p>
          </div>
        )}

        {displayMessages.map((m: any, i: number) => {
          const isMe =
            m.sender_id === user?.id || m.sender_id === "me";
          return (
            <motion.div
              key={m.id ?? i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] px-4 py-2.5 ${
                  isMe
                    ? "bg-[#0D0870] text-white rounded-2xl rounded-br-md"
                    : "bg-white text-[#1A1A1A] rounded-2xl rounded-bl-md"
                }`}
                style={!isMe ? { boxShadow: "0 1px 4px rgba(0,0,0,0.04)" } : {}}
              >
                <p className="text-[14px] leading-relaxed">{m.body}</p>
                <p
                  className={`text-[10px] mt-1 text-right ${
                    isMe ? "text-white/50" : "text-[#B0B0B0]"
                  }`}
                >
                  {formatTime(m.created_at)}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Attachment menu */}
      {showAttach && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 pb-2 flex gap-3"
        >
          {[
            { icon: Image, label: "Photo", color: "#3B82F6" },
            { icon: Paperclip, label: "Fichier", color: "#8B5CF6" },
            { icon: Mic, label: "Audio", color: "#6BB8C8" },
          ].map((a) => (
            <button
              key={a.label}
              className="flex flex-col items-center gap-1 bg-white rounded-xl px-4 py-3"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <a.icon size={20} style={{ color: a.color }} />
              <span className="text-[10px] text-[#888780]">{a.label}</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Input */}
      <div className="px-4 pb-6 pt-2 bg-white border-t border-[#F0F0F0] flex items-center gap-2">
        <button
          onClick={() => setShowAttach(!showAttach)}
          className="w-10 h-10 rounded-full bg-[#F3F3F5] flex items-center justify-center flex-shrink-0"
        >
          <Paperclip size={18} className="text-[#888780]" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Votre message..."
          className="flex-1 h-[44px] rounded-full bg-[#F3F3F5] px-4 text-[14px] outline-none focus:ring-2 focus:ring-[#0D0870]/20"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={send}
          disabled={sending || !input.trim()}
          className="w-10 h-10 bg-[#0D0870] rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50"
        >
          {sending ? (
            <Loader2 size={16} className="text-white animate-spin" />
          ) : (
            <Send size={16} className="text-white ml-0.5" />
          )}
        </motion.button>
      </div>
    </div>
  );
}
