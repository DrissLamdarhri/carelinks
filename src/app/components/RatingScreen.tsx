import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Star, ThumbsUp, Loader2 } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { motion } from "motion/react";
import { rateBooking, completeBooking } from "../../lib/api";
import { toast } from "sonner";

const tags = ["Ponctuel", "Professionnel", "Soigneux", "Aimable", "Propre", "Compétent"];

export function RatingScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { bookingId?: string; booking?: any } | null;
  const bookingId = state?.bookingId;
  const booking = state?.booking;

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Veuillez attribuer une note");
      return;
    }
    setLoading(true);
    try {
      if (bookingId) {
        await rateBooking(bookingId, rating, [selectedTags.join(", "), comment].filter(Boolean).join(" — "));
      }
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi de l'avis");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white px-8"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-[#EDE5CC] flex items-center justify-center mb-6"
        >
          <ThumbsUp size={40} className="text-[#0D0870]" />
        </motion.div>
        <h2 className="text-[22px] text-[#1A1A1A] mb-2 text-center" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
          Merci pour votre avis !
        </h2>
        <p className="text-[14px] text-[#888780] text-center mb-8">
          Votre évaluation aide à améliorer la qualité des soins sur CareLink
        </p>
        {/* Stars recap */}
        <div className="flex items-center gap-1 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={28} className={s <= rating ? "text-amber-400" : "text-[#E0E0E0]"} fill={s <= rating ? "#FBBF24" : "none"} />
          ))}
        </div>
        <button onClick={() => navigate("/app")}
          className="w-full py-4 bg-[#0D0870] text-white rounded-2xl text-[15px]"
          style={{ fontWeight: 600 }}>
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex-1 overflow-y-auto px-5 pt-14 pb-4">
        {/* Pro avatar */}
        <div className="flex flex-col items-center mb-8">
          {booking?.proAvatar ? (
            <ImageWithFallback
              src={booking.proAvatar}
              alt={booking.proName || "Pro"}
              className="w-20 h-20 rounded-full object-cover mb-4 border-4 border-[#EDE5CC]"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#EDE5CC] flex items-center justify-center mb-4 border-4 border-white"
              style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
              <span className="text-[#0D0870] text-2xl font-bold">
                {booking?.proName?.split(" ").map((n: string) => n[0]).join("") || "?"}
              </span>
            </div>
          )}
          <h2 className="text-[20px] text-[#1A1A1A] mb-1 text-center" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
            Comment était votre soin ?
          </h2>
          <p className="text-[13px] text-[#888780] text-center">
            avec <span className="font-medium text-[#1A1A1A]">{booking?.proName || "votre professionnel"}</span>
            {booking?.careType ? ` · ${booking.careType}` : ""}
          </p>
        </div>

        {/* Star rating */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <motion.button
              key={s}
              whileTap={{ scale: 0.85 }}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHoveredRating(s)}
              onMouseLeave={() => setHoveredRating(0)}
            >
              <Star
                size={44}
                className={s <= (hoveredRating || rating) ? "text-amber-400" : "text-[#E0E0E0]"}
                fill={s <= (hoveredRating || rating) ? "#FBBF24" : "none"}
                strokeWidth={1.5}
              />
            </motion.button>
          ))}
        </div>

        {/* Tags */}
        <div className="mb-5">
          <p className="text-[13px] text-[#888780] mb-3 text-center" style={{ fontWeight: 500 }}>
            Qu'avez-vous apprécié ?
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {tags.map((tag) => (
              <motion.button
                key={tag}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleTag(tag)}
                className={`px-4 py-2 rounded-full text-[13px] transition-all ${
                  selectedTags.includes(tag)
                    ? "bg-[#0D0870] text-white"
                    : "bg-[#F3F3F5] text-[#1A1A1A]"
                }`}
                style={{ fontWeight: selectedTags.includes(tag) ? 600 : 400 }}
              >
                {tag}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="mb-4">
          <p className="text-[12px] text-[#888780] mb-2" style={{ fontWeight: 500 }}>Commentaire (optionnel)</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Partagez votre expérience avec d'autres patients…"
            className="w-full bg-[#F3F3F5] rounded-2xl px-4 py-3 text-[13px] text-[#1A1A1A] outline-none resize-none"
            rows={3}
          />
        </div>
      </div>

      {/* Submit */}
      <div className="px-5 pb-8 pt-2 bg-white border-t border-[#F5F5F5]">
        <motion.button
          whileTap={rating > 0 ? { scale: 0.97 } : {}}
          onClick={handleSubmit}
          disabled={rating === 0 || loading}
          className={`w-full py-4 rounded-2xl text-[15px] flex items-center justify-center gap-2 transition-all ${
            rating > 0 ? "bg-[#0D0870] text-white" : "bg-[#E0E0E0] text-[#888780]"
          }`}
          style={{ fontWeight: 600 }}
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <>Envoyer mon avis</>}
        </motion.button>
        <button onClick={() => navigate("/app")}
          className="w-full mt-2 py-3 text-[13px] text-[#888780]">
          Passer
        </button>
      </div>
    </div>
  );
}
