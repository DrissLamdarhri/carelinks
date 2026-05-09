/**
 * LiveBookingsFeed — pro-side real-time list of open bookings.
 * Reads from useOpenBookingsBySpecialty + lets pro submit a bid via DAL.
 */
import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, MapPin, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth-context";
import { useOpenBookingsBySpecialty, db } from "../../lib/db";
import type { ProSpecialty } from "../../lib/db";

export function LiveBookingsFeed({ specialty }: { specialty: ProSpecialty }) {
  const { user } = useAuth();
  const { data: bookings, loading } = useOpenBookingsBySpecialty(specialty);
  const [bidFor, setBidFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitBid = async (bookingId: string) => {
    if (!user) return toast.error("Connectez-vous");
    const n = parseInt(amount, 10);
    if (!n || n < 50) return toast.error("Montant minimum 50 MAD");
    setSubmitting(true);
    try {
      await db.bids.create({ booking_id: bookingId, professional_id: user.id, amount_mad: n });
      toast.success("Offre envoyée");
      setBidFor(null);
      setAmount("");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-[#0D0870]" />
      </div>
    );

  if (!bookings?.length)
    return <p className="text-center text-[13px] text-[#888780] py-8">Aucune demande ouverte</p>;

  return (
    <div className="flex flex-col gap-3">
      {bookings.map((b) => (
        <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-4 border border-[#EDE5CC]">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <p className="text-[14px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>{b.title || "Demande de soin"}</p>
              {b.notes && <p className="text-[12px] text-[#888780] mt-0.5 line-clamp-2">{b.notes}</p>}
            </div>
            {b.urgency !== "normal" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E24B4A] text-white" style={{ fontWeight: 600 }}>
                {b.urgency === "emergency" ? "URGENT" : "Prioritaire"}
              </span>
            )}
          </div>
          <div className="flex gap-3 text-[11px] text-[#888780] mb-3">
            {b.address_label && <span className="flex items-center gap-1"><MapPin size={11} />{b.address_label}</span>}
            {b.scheduled_at && <span className="flex items-center gap-1"><Clock size={11} />{new Date(b.scheduled_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>}
            <span style={{ fontWeight: 600, color: "#0D0870" }}>{b.budget_min_mad}-{b.budget_max_mad} MAD</span>
          </div>

          {bidFor === b.id ? (
            <div className="flex gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number"
                placeholder="Votre offre (MAD)" autoFocus
                className="flex-1 h-[40px] bg-[#F3F3F5] rounded-xl px-3 text-[13px] outline-none" />
              <button onClick={() => submitBid(b.id)} disabled={submitting}
                className="px-4 h-[40px] bg-[#0D0870] text-white rounded-xl text-[13px] flex items-center gap-1.5"
                style={{ fontWeight: 600 }}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} />Envoyer</>}
              </button>
              <button onClick={() => setBidFor(null)} className="text-[12px] text-[#888780] px-2">Annuler</button>
            </div>
          ) : (
            <button onClick={() => setBidFor(b.id)}
              className="w-full h-[40px] bg-[#5BB8D4] text-white rounded-xl text-[13px]"
              style={{ fontWeight: 600 }}>
              Faire une offre
            </button>
          )}
        </motion.div>
      ))}
    </div>
  );
}
