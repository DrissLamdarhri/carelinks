/**
 * LiveBidsFeed — patient-side real-time bids on a booking.
 * Patient can accept; on accept, server-side trigger flips status to 'matched'
 * and notifies the winning pro. Other bids are auto-rejected here.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Star, Check } from "lucide-react";
import { toast } from "sonner";
import { useBookingBids, db } from "../../lib/db";

export function LiveBidsFeed({ bookingId, onAccepted }: { bookingId: string; onAccepted?: (bidId: string) => void }) {
  const { data: bids, loading } = useBookingBids(bookingId);
  const [accepting, setAccepting] = useState<string | null>(null);

  const accept = async (bid: any) => {
    setAccepting(bid.id);
    try {
      await db.bids.accept(bid);
      // Flip booking to matched and assign pro
      await db.bookings.acceptBid(bookingId, bid.professional_id, bid.amount_mad);
      toast.success("Offre acceptée");
      onAccepted?.(bid.id);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setAccepting(null);
    }
  };

  if (loading)
    return <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-[#0D0870]" /></div>;

  const pending = bids?.filter((b) => b.status === "pending") ?? [];
  if (!pending.length)
    return <p className="text-center text-[13px] text-[#888780] py-6">En attente d'offres…</p>;

  return (
    <div className="flex flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {pending.map((b) => (
          <motion.div key={b.id} layout
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }}
            className="bg-white rounded-2xl p-3.5 border border-[#EDE5CC] flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#5BB8D4]/20 flex items-center justify-center text-[#0D0870]" style={{ fontWeight: 700 }}>
              {b.professional_id.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#1A1A1A] truncate" style={{ fontWeight: 600 }}>Pro {b.professional_id.slice(0, 6)}</p>
              <div className="flex items-center gap-2 text-[11px] text-[#888780]">
                <span className="flex items-center gap-0.5"><Star size={10} fill="#F5B544" stroke="#F5B544" />4.8</span>
                {b.eta_minutes && <span>· {b.eta_minutes} min</span>}
              </div>
            </div>
            <div className="text-right mr-2">
              <p className="text-[15px] text-[#0D0870]" style={{ fontWeight: 700 }}>{b.amount_mad}</p>
              <p className="text-[10px] text-[#888780]">MAD</p>
            </div>
            <button onClick={() => accept(b)} disabled={accepting === b.id}
              className="w-9 h-9 rounded-full bg-[#0D0870] text-white flex items-center justify-center">
              {accepting === b.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} />}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
