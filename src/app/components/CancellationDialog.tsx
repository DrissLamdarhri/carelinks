/**
 * CancellationDialog — patient or pro cancels a booking with reason.
 * Cancellation fee policy: <2h before -> 50%, otherwise free.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";

const REASONS = [
  "Imprévu personnel",
  "Erreur de réservation",
  "Délai trop long",
  "Le pro n'est pas venu",
  "Problème de qualité",
  "Autre",
];

export function CancellationDialog({
  bookingId, scheduledAt, amountMad, open, onClose,
}: { bookingId: string; scheduledAt?: string | null; amountMad?: number; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const hoursTo = scheduledAt ? (new Date(scheduledAt).getTime() - Date.now()) / 3_600_000 : 24;
  const fee = hoursTo < 2 && amountMad ? Math.floor(amountMad * 0.5) : 0;

  const cancel = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      await supabase.from("bookings").update({
        status: "cancelled",
        cancel_reason: reason + (note ? ` — ${note}` : ""),
      }).eq("id", bookingId);
      toast.success("Réservation annulée");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
          <motion.div initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }}
            transition={{ type: "spring", damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[375px] bg-white rounded-t-3xl p-5 pb-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="flex justify-between items-start mb-3">
              <p className="text-[16px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>Annuler la réservation</p>
              <button onClick={onClose}><X size={18} className="text-[#888780]" /></button>
            </div>

            {fee > 0 && (
              <div className="flex gap-2 bg-[#FEF3D5] rounded-xl p-3 mb-3">
                <AlertTriangle size={16} className="text-[#F5B544] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#1A1A1A]">
                  Annulation tardive (&lt;2h). Frais d'annulation : <strong>{fee} MAD</strong>.
                </p>
              </div>
            )}

            <p className="text-[12px] text-[#888780] mb-2">Motif</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  className={`p-2.5 text-[11px] rounded-xl border-2 text-left ${reason === r ? "border-[#0D0870] bg-[#EDE5CC]/50" : "border-[#E0E0E0]"}`}
                  style={{ fontWeight: 500 }}>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="Détails (optionnel)…"
              className="w-full bg-[#F3F3F5] rounded-xl p-3 text-[13px] outline-none resize-none mb-3" />
            <button onClick={cancel} disabled={!reason || loading}
              className={`w-full h-[48px] rounded-2xl text-[14px] ${reason ? "bg-[#E24B4A] text-white" : "bg-[#E0E0E0] text-[#888780]"}`}
              style={{ fontWeight: 600 }}>
              {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Confirmer l'annulation"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
