/**
 * LiveChat — real-time 1-to-1 chat for a booking, between patient and pro.
 * Uses useBookingMessages (Realtime) + db.messages.send.
 */
import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth-context";
import { useBookingMessages, db } from "../../lib/db";

export function LiveChat({ bookingId, recipientId }: { bookingId: string; recipientId: string }) {
  const { user } = useAuth();
  const { messages, loading } = useBookingMessages(bookingId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!user || !text.trim()) return;
    const body = text.trim();
    setText("");
    setSending(true);
    try {
      await db.messages.send({
        booking_id: bookingId,
        sender_id: user.id,
        recipient_id: recipientId,
        body,
      });
    } catch (e: any) {
      toast.error("Échec de l'envoi");
      setText(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#EDE5CC]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {loading ? (
          <div className="flex justify-center pt-8"><Loader2 size={20} className="animate-spin text-[#0D0870]" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-[12px] text-[#888780] mt-8">Aucun message. Dites bonjour 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] ${mine ? "bg-[#0D0870] text-white" : "bg-white text-[#1A1A1A]"}`}>
                  {m.body}
                  <div className={`text-[9px] mt-1 ${mine ? "text-white/60" : "text-[#888780]"}`}>
                    {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-3 py-3 bg-white border-t border-[#E0E0E0] flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Écrire un message…"
          className="flex-1 h-[42px] bg-[#F3F3F5] rounded-full px-4 text-[13px] outline-none" />
        <button onClick={send} disabled={!text.trim() || sending}
          className="w-[42px] h-[42px] rounded-full bg-[#0D0870] text-white flex items-center justify-center disabled:opacity-50">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
