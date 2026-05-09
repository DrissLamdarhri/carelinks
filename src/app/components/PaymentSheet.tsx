/**
 * PaymentSheet — provider-agnostic payment UI.
 * Calls /functions/v1/payments-authorize edge function (CMI or Stripe behind).
 * For demo: authorizes locally and inserts a 'authorized' row in `payments`.
 */
import { useState } from "react";
import { motion } from "motion/react";
import { CreditCard, Wallet, Shield, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";

type Provider = "cmi" | "stripe" | "cash";

export function PaymentSheet({
  bookingId, professionalId, amountMad, onAuthorized,
}: { bookingId: string; professionalId: string; amountMad: number; onAuthorized?: () => void }) {
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider>("cmi");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const commission = Math.max(1, Math.floor((amountMad * 15) / 100));
  const proPayout = amountMad - commission;

  const authorize = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Server call (replace with real CMI/Stripe handoff in production).
      // For now, write directly via RLS as the patient.
      const { error } = await supabase.from("payments").insert({
        booking_id: bookingId,
        patient_id: user.id,
        professional_id: professionalId,
        amount_mad: amountMad,
        commission_mad: commission,
        provider,
        status: provider === "cash" ? "pending" : "authorized",
      });
      if (error) throw error;
      setDone(true);
      toast.success(provider === "cash" ? "Paiement à régler en espèces" : "Paiement autorisé");
      onAuthorized?.();
    } catch (e: any) {
      toast.error(e.message ?? "Échec du paiement");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center py-8 gap-3">
        <CheckCircle2 size={48} className="text-[#0D0870]" />
        <p className="text-[15px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>Paiement confirmé</p>
        <p className="text-[12px] text-[#888780]">Le montant sera capturé à la fin de la prestation.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <p className="text-[12px] text-[#888780]">Mode de paiement</p>
      {([
        { k: "cmi" as Provider, label: "Carte bancaire (CMI Maroc)", icon: <CreditCard size={18} /> },
        { k: "stripe" as Provider, label: "Carte internationale (Stripe)", icon: <CreditCard size={18} /> },
        { k: "cash" as Provider, label: "Espèces à la prestation", icon: <Wallet size={18} /> },
      ]).map((opt) => (
        <button key={opt.k} onClick={() => setProvider(opt.k)}
          className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all ${provider === opt.k ? "border-[#0D0870] bg-[#EDE5CC]/50" : "border-[#E0E0E0] bg-white"}`}>
          <div className="text-[#0D0870]">{opt.icon}</div>
          <span className="text-[13px] text-[#1A1A1A] flex-1 text-left" style={{ fontWeight: 500 }}>{opt.label}</span>
          {provider === opt.k && <div className="w-4 h-4 rounded-full bg-[#0D0870]" />}
        </button>
      ))}

      <div className="bg-[#EDE5CC] rounded-2xl p-3 mt-1 text-[12px]">
        <div className="flex justify-between"><span>Prestation</span><span>{amountMad} MAD</span></div>
        <div className="flex justify-between text-[#888780]"><span>Commission CareLink (15%)</span><span>-{commission} MAD</span></div>
        <div className="flex justify-between text-[#888780]"><span>Reçu par le pro</span><span>{proPayout} MAD</span></div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[#888780]">
        <Shield size={12} />Paiement sécurisé · capturé à la fin de la prestation
      </div>

      <motion.button whileTap={{ scale: 0.97 }} onClick={authorize} disabled={loading}
        className="w-full h-[50px] rounded-2xl bg-[#0D0870] text-white text-[14px] flex items-center justify-center gap-2"
        style={{ fontWeight: 600 }}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : `Autoriser ${amountMad} MAD`}
      </motion.button>
    </div>
  );
}
