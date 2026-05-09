import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Star, Shield, MapPin, Clock, Award, MessageCircle, Phone, Loader2 } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { motion } from "motion/react";
import { getProfessional } from "../../lib/api";

export function ProviderProfile() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [pro, setPro] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getProfessional(id)
      .then((data) => setPro(data.professional))
      .catch(() => setPro(null))
      .finally(() => setLoading(false));
  }, [id]);

  const displayName = pro ? `${pro.firstName} ${pro.lastName}` : "—";
  const rating = pro?.rating || 0;
  const reviewCount = pro?.reviewCount || 0;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <Loader2 size={28} className="text-[#0D0870] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#EDE5CC]">
      {/* Header with image */}
      <div className="relative bg-[#0D0870] pt-12 pb-20 px-5">
        {pro?.avatar && (
          <div className="absolute inset-0 overflow-hidden">
            <ImageWithFallback src={pro.avatar} alt={displayName} className="w-full h-full object-cover opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
        <button onClick={() => navigate(-1)} className="relative z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-white" />
        </button>
      </div>

      {/* Profile card */}
      <div className="px-5 -mt-16 relative z-10">
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div className="flex items-start gap-4">
            <div className="relative -mt-12">
              {pro?.avatar ? (
                <ImageWithFallback
                  src={pro.avatar}
                  alt={displayName}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-white"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl border-4 border-white bg-[#EDE5CC] flex items-center justify-center">
                  <span className="text-[#0D0870] text-2xl font-bold">
                    {pro?.firstName?.[0]}{pro?.lastName?.[0]}
                  </span>
                </div>
              )}
              {pro?.isVerified && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#0D0870] rounded-full flex items-center justify-center border-2 border-white">
                  <Shield size={12} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 pt-1">
              <p className="text-[18px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>{displayName}</p>
              <p className="text-[13px] text-[#888780] capitalize">{pro?.specialty || "Professionnel de santé"}</p>
              {pro?.city && (
                <div className="flex items-center gap-1 mt-1 text-[11px] text-[#888780]">
                  <MapPin size={11} /> {pro.city}
                </div>
              )}
              <div className="flex items-center gap-1 mt-1">
                <span className={`flex items-center gap-1 text-[11px] font-medium ${pro?.isOnline ? "text-green-600" : "text-[#B0B0B0]"}`}>
                  <span className={`w-2 h-2 rounded-full ${pro?.isOnline ? "bg-green-500" : "bg-[#D0D0D0]"}`} />
                  {pro?.isOnline ? "En ligne" : "Hors ligne"}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-around mt-5 pt-4 border-t border-[#F0F0F0]">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star size={14} className="text-amber-400" fill="#FBBF24" />
                <span className="text-[18px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>
                  {rating > 0 ? rating.toFixed(1) : "Nouveau"}
                </span>
              </div>
              <p className="text-[11px] text-[#888780]">{reviewCount > 0 ? `${reviewCount} avis` : "Pas encore d'avis"}</p>
            </div>
            <div className="w-px h-8 bg-[#F0F0F0]" />
            <div className="text-center">
              <p className="text-[18px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>
                {pro?.experience || "—"}
              </p>
              <p className="text-[11px] text-[#888780]">Expérience</p>
            </div>
            <div className="w-px h-8 bg-[#F0F0F0]" />
            <div className="text-center">
              <p className="text-[18px] text-[#0D0870]" style={{ fontWeight: 700 }}>
                {pro?.minPrice ? `${pro.minPrice}+` : "—"}
              </p>
              <p className="text-[11px] text-[#888780]">MAD / soin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">
        {/* Quick info */}
        <div className="flex gap-2 mb-4">
          {[
            { icon: Clock, text: pro?.startTime ? `${pro.startTime}–${pro.endTime}` : "Sur RDV" },
            { icon: Award, text: pro?.isVerified ? "Vérifié ✓" : "En attente" },
            { icon: MapPin, text: pro?.city || "Maroc" },
          ].map((item, i) => (
            <div key={i} className="flex-1 bg-white rounded-xl p-3 flex items-center gap-2" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <item.icon size={14} className="text-[#0D0870]" />
              <span className="text-[11px] text-[#1A1A1A] truncate" style={{ fontWeight: 500 }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Specialties */}
        {pro?.specialties?.length > 0 && (
          <div className="mb-4">
            <p className="text-[14px] text-[#1A1A1A] mb-2" style={{ fontWeight: 600 }}>Spécialités</p>
            <div className="flex gap-2 flex-wrap">
              {pro.specialties.map((s: string) => (
                <span key={s} className="text-[12px] px-3 py-1.5 rounded-full bg-[#EDE5CC] text-[#0D0870]" style={{ fontWeight: 500 }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Availability days */}
        {pro?.availDays?.length > 0 && (
          <div className="mb-4">
            <p className="text-[14px] text-[#1A1A1A] mb-2" style={{ fontWeight: 600 }}>Disponibilités</p>
            <div className="flex gap-2 flex-wrap">
              {pro.availDays.map((d: string) => (
                <span key={d} className="text-[12px] px-3 py-1.5 rounded-full bg-white text-[#1A1A1A]"
                  style={{ fontWeight: 500, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>{d}</span>
              ))}
            </div>
          </div>
        )}

        {/* About */}
        {pro?.about && (
          <div className="mb-4">
            <p className="text-[14px] text-[#1A1A1A] mb-2" style={{ fontWeight: 600 }}>À propos</p>
            <p className="text-[13px] text-[#888780] leading-relaxed">{pro.about}</p>
          </div>
        )}

        {/* No data fallback */}
        {!pro && (
          <div className="bg-white rounded-2xl p-5 text-center">
            <p className="text-[14px] text-[#888780]">Professionnel introuvable</p>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      {pro && (
        <div className="px-5 py-4 bg-white border-t border-[#F0F0F0] flex gap-3">
          {pro.phone && (
            <a href={`tel:${pro.phone}`}
              className="w-12 h-12 rounded-xl border border-[#E0E0E0] flex items-center justify-center">
              <Phone size={20} className="text-[#0D0870]" />
            </a>
          )}
          {pro.phone && (
            <a href={`https://wa.me/${pro.phone.replace("+", "")}`} target="_blank" rel="noopener noreferrer"
              className="w-12 h-12 rounded-xl border border-[#E0E0E0] flex items-center justify-center"
              style={{ background: "#25D366" }}>
              <MessageCircle size={18} className="text-white" />
            </a>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/app/request")}
            className="flex-1 py-3 bg-[#0D0870] text-white rounded-xl text-[14px]"
            style={{ fontWeight: 600 }}
          >
            Demander un soin — {pro.minPrice ? `dès ${pro.minPrice} MAD` : ""}
          </motion.button>
        </div>
      )}
    </div>
  );
}
