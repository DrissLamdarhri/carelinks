import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Phone, MessageCircle, Navigation, MapPin, Clock, X, Shield, Star } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { motion } from "motion/react";
import { completeBooking } from "../../lib/api";
import { toast } from "sonner";

export function LiveTracking() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { bookingId?: string; booking?: any } | null;
  const bookingId = state?.bookingId;
  const booking = state?.booking;

  const [eta, setEta] = useState(12);
  const [progress, setProgress] = useState(0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setEta((e) => Math.max(0, e - 1));
      setProgress((p) => Math.min(100, p + 8));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const arrived = eta === 0;

  const handleComplete = async () => {
    setCompleting(true);
    try {
      if (bookingId) await completeBooking(bookingId);
      navigate("/app/rating", { state: { bookingId, booking } });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
      navigate("/app/rating", { state: { bookingId, booking } });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#EDE5CC]">
      {/* Map area */}
      <div className="relative flex-1 min-h-0">
        {/* Header overlay */}
        <div className="absolute top-0 left-0 right-0 z-20 px-5 pt-12 flex items-center justify-between">
          <button onClick={() => navigate("/app")} className="w-10 h-10 bg-white rounded-full flex items-center justify-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
            <X size={20} className="text-[#1A1A1A]" />
          </button>
          <div className="bg-white rounded-full px-4 py-2 flex items-center gap-2" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
            <div className={`w-2 h-2 rounded-full ${arrived ? "bg-[#0D0870]" : "bg-[#6BB8C8] animate-pulse"}`} />
            <span className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>
              {arrived ? "Arrivé !" : `En route — ${eta} min`}
            </span>
          </div>
          <div className="w-10" />
        </div>

        {/* Map */}
        <div className="w-full h-full bg-[#E8F0E8] relative overflow-hidden">
          <div className="absolute inset-0" style={{
            background: `
              repeating-linear-gradient(0deg, rgba(200,220,200,0.3) 0px, rgba(200,220,200,0.3) 1px, transparent 1px, transparent 24px),
              repeating-linear-gradient(90deg, rgba(200,220,200,0.3) 0px, rgba(200,220,200,0.3) 1px, transparent 1px, transparent 24px),
              linear-gradient(135deg, #d4e8d4, #c5dfc5, #d4e8d4)
            `
          }} />

          {/* Roads */}
          <div className="absolute top-[45%] left-0 right-0 h-4 bg-white/40" />
          <div className="absolute top-0 bottom-0 left-[55%] w-4 bg-white/40" />
          <div className="absolute top-[25%] left-[20%] w-[40%] h-3 bg-white/30 -rotate-6" />

          {/* Route line */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 375 400">
            <path
              d="M100,300 Q150,250 200,220 Q250,190 280,150"
              stroke="#0D0870"
              strokeWidth="4"
              strokeDasharray="8,6"
              fill="none"
              opacity="0.6"
            />
          </svg>

          {/* Patient pin */}
          <div className="absolute bottom-[25%] left-[25%] flex flex-col items-center">
            <div className="bg-[#0D0870] text-white text-[9px] px-2 py-0.5 rounded-md mb-1" style={{ fontWeight: 600 }}>Vous</div>
            <div className="w-4 h-4 bg-[#0D0870] rounded-full border-2 border-white" style={{ boxShadow: "0 2px 8px rgba(15,110,86,0.4)" }} />
            <div className="w-10 h-10 bg-[#0D0870]/10 rounded-full absolute top-4 animate-ping" />
          </div>

          {/* Nurse moving pin */}
          <motion.div
            className="absolute flex flex-col items-center"
            animate={{
              top: arrived ? "75%" : `${35 + progress * 0.4}%`,
              left: arrived ? "25%" : `${72 - progress * 0.47}%`,
            }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
              {booking?.proAvatar ? (
                <ImageWithFallback src={booking.proAvatar} alt="nurse" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="text-[#0D0870] font-bold text-sm">
                  {booking?.proName?.split(" ").map((n: string) => n[0]).join("") || "?"}
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 30 }}
        animate={{ y: 0 }}
        className="bg-white rounded-t-[28px] -mt-4 relative z-10 px-5 pt-3 pb-6"
        style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.06)" }}
      >
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 bg-[#E0E0E0] rounded-full" />
        </div>

        {/* ETA progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-[#888780]">{arrived ? "Le professionnel est arrivé" : "En route vers vous"}</span>
            <span className="text-[12px] text-[#0D0870]" style={{ fontWeight: 600 }}>{arrived ? "Arrivé" : `${eta} min`}</span>
          </div>
          <div className="w-full h-2 bg-[#F3F3F5] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "#0D0870" }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Provider card */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            {booking?.proAvatar ? (
              <ImageWithFallback src={booking.proAvatar} alt={booking.proName} className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#EDE5CC] flex items-center justify-center">
                <span className="text-[#0D0870] text-lg font-bold">
                  {booking?.proName?.split(" ").map((n: string) => n[0]).join("") || "?"}
                </span>
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#0D0870] rounded-full flex items-center justify-center border-2 border-white">
              <Shield size={10} className="text-white" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[15px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>
              {booking?.proName || "Professionnel"}
            </p>
            <p className="text-[12px] text-[#888780]">
              {booking?.careType || "Soin"}{booking?.address ? ` · ${booking.address}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[20px] text-[#0D0870]" style={{ fontWeight: 700 }}>{booking?.price || "—"}</p>
            <p className="text-[11px] text-[#888780]">MAD</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {booking?.proPhone ? (
            <a href={`tel:${booking.proPhone}`}
              className="flex-1 h-12 rounded-xl border border-[#E0E0E0] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform">
              <Phone size={18} className="text-[#0D0870]" />
              <span className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>Appeler</span>
            </a>
          ) : (
            <button className="flex-1 h-12 rounded-xl border border-[#E0E0E0] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform">
              <Phone size={18} className="text-[#0D0870]" />
              <span className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>Appeler</span>
            </button>
          )}
          <button
            onClick={() => navigate("/app/chat")}
            className="flex-1 h-12 rounded-xl border border-[#E0E0E0] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <MessageCircle size={18} className="text-[#0D0870]" />
            <span className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>Message</span>
          </button>
          {arrived && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleComplete}
              disabled={completing}
              className="flex-1 h-12 rounded-xl bg-[#0D0870] flex items-center justify-center"
            >
              <span className="text-[13px] text-white" style={{ fontWeight: 600 }}>Terminer</span>
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}