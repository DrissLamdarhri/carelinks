/**
 * RatingForm — patient submits a 1-5 star rating + optional comment after a
 * completed booking. Inserts via db.ratings.create; ratings recalc trigger
 * refreshes professionals.rating_avg / rating_count automatically.
 */
import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth-context";
import { db } from "../../lib/db";

export function RatingForm({
  bookingId, professionalId, onSubmitted,
}: { bookingId: string; professionalId: string; onSubmitted?: () => void }) {
  const { user } = useAuth();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user || !stars) return;
    setLoading(true);
    try {
      await db.ratings.create({
        booking_id: bookingId, patient_id: user.id, professional_id: professionalId,
        stars, comment: comment.trim() || null,
      });
      toast.success("Merci pour votre avis !");
      onSubmitted?.();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-4 p-5 bg-white rounded-2xl" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <p className="text-[15px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>Évaluer votre prestation</p>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}>
            <Star size={36} fill={n <= (hover || stars) ? "#F5B544" : "transparent"} stroke={n <= (hover || stars) ? "#F5B544" : "#D0D0D0"} />
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
        placeholder="Partagez votre expérience (optionnel)…"
        className="w-full bg-[#F3F3F5] rounded-xl p-3 text-[13px] outline-none resize-none" />
      <button onClick={submit} disabled={!stars || loading}
        className={`w-full h-[48px] rounded-2xl text-[14px] flex items-center justify-center gap-2 ${stars ? "bg-[#0D0870] text-white" : "bg-[#E0E0E0] text-[#888780]"}`}
        style={{ fontWeight: 600 }}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : "Envoyer l'avis"}
      </button>
    </div>
  );
}
