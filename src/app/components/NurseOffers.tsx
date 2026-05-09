import { useNavigate, useLocation } from "react-router";
import { ArrowLeft, SlidersHorizontal, Star, CheckCircle, MapPin, Clock, Shield, Loader2, Phone, MessageCircle } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getOffersForRequest, acceptOffer, rejectOffer } from "../../lib/api";

export function NurseOffers() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { requestId?: string; request?: any } | null;
  const requestId = state?.requestId;
  const request = state?.request;

  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) { setLoading(false); return; }
    const load = async () => {
      try {
        const data = await getOffersForRequest(requestId);
        setOffers(data.offers || []);
      } catch (err: any) {
        toast.error("Erreur lors du chargement des offres");
      } finally {
        setLoading(false);
      }
    };
    load();
    // Re-poll every 8s
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [requestId]);

  const handleAccept = async (offerId: string) => {
    setActionId(offerId);
    try {
      const result = await acceptOffer(offerId);
      toast.success("Offre acceptée ! Réservation confirmée 🎉");
      navigate("/app/tracking", { state: { bookingId: result.bookingId, booking: result.booking } });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'acceptation");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (offerId: string) => {
    setActionId(offerId + "_reject");
    try {
      await rejectOffer(offerId);
      setOffers((prev) => prev.filter((o) => o.id !== offerId));
      toast.info("Offre refusée");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#EDE5CC]">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-[#F0F0F0]">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[#F3F3F5] flex items-center justify-center">
            <ArrowLeft size={20} className="text-[#1A1A1A]" />
          </button>
          <span className="text-[17px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>Offres reçues</span>
          <div className="w-10 h-10 rounded-full bg-[#F3F3F5] flex items-center justify-center">
            <SlidersHorizontal size={18} className="text-[#1A1A1A]" />
          </div>
        </div>
        {request && (
          <div className="flex items-center gap-2 text-[12px] text-[#888780]">
            <span className="px-2.5 py-1 bg-[#EDE5CC] text-[#0D0870] rounded-full" style={{ fontWeight: 500 }}>
              {request.careType}
            </span>
            <span>{request.timeStr}</span>
            <span>·</span>
            <span className="truncate max-w-[140px]">{request.address}</span>
          </div>
        )}
      </div>

      {/* Count */}
      <div className="px-5 pt-4 pb-2">
        {loading ? (
          <div className="flex items-center gap-2 text-[14px] text-[#888780]">
            <Loader2 size={16} className="animate-spin" />
            Chargement des offres…
          </div>
        ) : (
          <p className="text-[14px] text-[#888780]">
            <span className="text-[#0D0870]" style={{ fontWeight: 700 }}>{offers.length} professionnel{offers.length !== 1 ? "s" : ""}</span>{" "}
            {offers.length !== 1 ? "ont répondu" : "a répondu"}
          </p>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {!loading && offers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#F3F3F5] flex items-center justify-center mb-4">
              <Clock size={28} className="text-[#D0D0D0]" />
            </div>
            <p className="text-[15px] text-[#888780]" style={{ fontWeight: 500 }}>Aucune offre pour le moment</p>
            <p className="text-[12px] text-[#B0B0B0] mt-1">Les professionnels consultent votre demande…</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {offers.map((o, i) => (
            <motion.div key={o.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
              {/* Banner */}
              <div className={`px-4 py-1.5 flex items-center gap-1 ${!o.isCounterOffer ? "bg-[#EDE5CC]" : "bg-[#D8F0F4]"}`}>
                {!o.isCounterOffer ? (
                  <>
                    <CheckCircle size={12} className="text-[#0D0870]" />
                    <span className="text-[10px] text-[#0D0870]" style={{ fontWeight: 600 }}>Accepte votre prix</span>
                  </>
                ) : (
                  <span className="text-[10px] text-[#0891B2]" style={{ fontWeight: 600 }}>
                    Contre-offre : {o.price > (request?.proposedPrice || 0) ? "+" : ""}{o.price - (request?.proposedPrice || 0)} MAD
                  </span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <button onClick={() => navigate(`/app/provider/${o.proId}`)} className="relative flex-shrink-0">
                    {o.proAvatar ? (
                      <ImageWithFallback src={o.proAvatar} alt={o.proName} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#EDE5CC] flex items-center justify-center">
                        <span className="text-[#0D0870] text-lg font-bold">
                          {o.proName?.split(" ").map((n: string) => n[0]).join("")}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#0D0870] rounded-full flex items-center justify-center border-2 border-white">
                      <Shield size={10} className="text-white" />
                    </div>
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>{o.proName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Star size={12} className="text-amber-400" fill="#FBBF24" />
                      <span className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>
                        {o.proRating > 0 ? o.proRating.toFixed(1) : "Nouveau"}
                      </span>
                      {o.proReviews > 0 && <span className="text-[11px] text-[#888780]">({o.proReviews} avis)</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-[#888780]">
                      <span className="capitalize">{o.proSpecialty}</span>
                      {o.proExperience && <span>{o.proExperience} exp.</span>}
                    </div>
                    {/* Contact buttons */}
                    <div className="flex gap-2 mt-2">
                      {o.proPhone && (
                        <a href={`tel:${o.proPhone}`}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] bg-[#0D0870] text-white"
                          style={{ fontWeight: 500 }}>
                          <Phone size={11} /> Appeler
                        </a>
                      )}
                      {o.proPhone && (
                        <a href={`https://wa.me/${o.proPhone.replace("+", "")}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] bg-[#25D366] text-white"
                          style={{ fontWeight: 500 }}>
                          <MessageCircle size={11} /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-[22px] text-[#0D0870]" style={{ fontWeight: 800 }}>{o.price}</p>
                    <p className="text-[11px] text-[#888780]">MAD</p>
                  </div>
                </div>

                {/* Specialties */}
                {o.proSpecialties?.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {o.proSpecialties.map((s: string) => (
                      <span key={s} className="text-[10px] px-2.5 py-1 rounded-full bg-[#F3F3F5] text-[#666]" style={{ fontWeight: 500 }}>{s}</span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={() => handleAccept(o.id)}
                    disabled={actionId !== null}
                    className="flex-1 py-3 bg-[#0D0870] text-white rounded-xl text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ fontWeight: 600 }}>
                    {actionId === o.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    Accepter
                  </motion.button>
                  <button onClick={() => handleReject(o.id)} disabled={actionId !== null}
                    className="px-4 py-3 border border-[#E0E0E0] text-[#888780] rounded-xl text-[13px] disabled:opacity-50">
                    Refuser
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom */}
      {request && (
        <div className="px-5 py-4 bg-white border-t border-[#F0F0F0]">
          <button onClick={() => navigate("/app/waiting", { state: { requestId, request } })}
            className="w-full py-3 border-2 border-[#0D0870] text-[#0D0870] rounded-2xl text-[14px] active:scale-[0.97] transition-transform"
            style={{ fontWeight: 600 }}>
            Modifier mon prix
          </button>
        </div>
      )}
    </div>
  );
}
