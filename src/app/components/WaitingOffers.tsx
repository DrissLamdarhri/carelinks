import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { X, MapPin, Clock, Banknote, Loader2, Bell } from "lucide-react";
import { toast } from "sonner";
import { cancelRequest } from "../../lib/api";
import { useBookingBids } from "../../lib/db/realtime";
import { geo, type NearbyPro } from "../../lib/db/geo";

export function WaitingOffers() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as {
    requestId?: string;
    request?: any;
  } | null;

  const requestId = locationState?.requestId;
  const request = locationState?.request;

  // The supabaseBookingId is stored on the request object after dual-write
  const supabaseBookingId: string | null = request?.supabaseBookingId ?? null;

  const [dots, setDots] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [prevCount, setPrevCount] = useState(0);
  const [radiusKm, setRadiusKm] = useState(15);
  const [nearbyPros, setNearbyPros] = useState<NearbyPro[]>([]);

  // Periodically query PostGIS RPC to show how many pros are in radius
  useEffect(() => {
    if (!supabaseBookingId) return;
    let cancelled = false;
    const fetchNearby = async () => {
      try {
        const list = await geo.findProsNearBooking(supabaseBookingId, radiusKm);
        if (!cancelled) setNearbyPros(list);
      } catch { /* RPC may not be migrated yet — silent */ }
    };
    fetchNearby();
    const iv = setInterval(fetchNearby, 8000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [supabaseBookingId, radiusKm]);

  // ── Realtime bids from Supabase (if schema is set up) ───────────────────────
  const { pendingBids, loading: bidsLoading } = useBookingBids(supabaseBookingId);
  const offersCount = pendingBids.length;

  // Notify when new bids arrive
  useEffect(() => {
    if (offersCount > prevCount && prevCount >= 0) {
      if (offersCount > 0) {
        toast.success(`${offersCount} professionnel(s) ont répondu !`, { icon: "🔔" });
      }
    }
    setPrevCount(offersCount);
  }, [offersCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animated dots
  useEffect(() => {
    const iv = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(iv);
  }, []);

  const handleCancel = async () => {
    if (!requestId) { navigate(-1); return; }
    setCancelling(true);
    try {
      await cancelRequest(requestId);
      toast.info("Demande annulée");
      navigate("/app");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'annulation");
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("fr-MA", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <button
          onClick={() => navigate("/app")}
          className="w-10 h-10 rounded-full bg-[#F3F3F5] flex items-center justify-center"
        >
          <X size={20} className="text-[#1A1A1A]" />
        </button>
        <span className="text-[16px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>
          Recherche en cours
        </span>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Animated radar circles */}
        <div className="relative w-40 h-40 mb-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border-2 border-[#0D0870]/20"
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.6,
                ease: "easeOut",
              }}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-[#0D0870] flex items-center justify-center">
              <MapPin size={32} className="text-white" />
            </div>
          </div>
        </div>

        <p
          className="text-[20px] text-[#1A1A1A] text-center mb-2"
          style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}
        >
          Recherche de professionnels{"•".repeat(dots)}
        </p>
        <p className="text-[14px] text-[#888780] text-center mb-8">
          Nous cherchons les professionnels disponibles dans votre zone
        </p>

        {/* Realtime indicator */}
        {supabaseBookingId && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#0D0870] mb-4">
            <span className="w-2 h-2 rounded-full bg-[#0D0870] animate-pulse" />
            Connexion temps réel active
          </div>
        )}

        {/* Nearby pros (PostGIS) + radius slider */}
        {supabaseBookingId && (
          <div className="w-full bg-white border border-[#E0E0E0] rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                {nearbyPros.length} pro(s) à portée
              </p>
              <span className="text-[11px] text-[#888780]">{radiusKm} km</span>
            </div>
            <input
              type="range" min={3} max={50} step={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-[#0D0870]"
            />
            {nearbyPros.length > 0 && (
              <p className="text-[11px] text-[#888780] mt-1">
                Plus proche : {nearbyPros[0].distance_km.toFixed(1)} km
              </p>
            )}
          </div>
        )}

        {/* Request summary */}
        {request && (
          <div className="w-full bg-[#EDE5CC] rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center">
                <Clock size={16} className="text-[#0D0870]" />
              </div>
              <div>
                <p className="text-[13px] text-[#888780]">Date & heure</p>
                <p className="text-[14px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>
                  {formatDate(request.dateStr)} — {request.timeStr}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center">
                <MapPin size={16} className="text-[#0D0870]" />
              </div>
              <div>
                <p className="text-[13px] text-[#888780]">Adresse</p>
                <p
                  className="text-[14px] text-[#1A1A1A]"
                  style={{ fontWeight: 500 }}
                >
                  {request.address}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center">
                <Banknote size={16} className="text-[#0D0870]" />
              </div>
              <div>
                <p className="text-[13px] text-[#888780]">
                  Votre prix · {request.careType}
                </p>
                <p
                  className="text-[14px] text-[#0D0870]"
                  style={{ fontWeight: 700 }}
                >
                  {request.proposedPrice} MAD
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No request state */}
        {!request && (
          <div className="w-full bg-[#EDE5CC] rounded-2xl p-5 mb-6 text-center">
            <Loader2 size={24} className="text-[#0D0870] animate-spin mx-auto mb-2" />
            <p className="text-[13px] text-[#888780]">
              Chargement de votre demande…
            </p>
          </div>
        )}

        {/* Offers indicator */}
        {offersCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() =>
              navigate("/app/offers", {
                state: {
                  requestId,
                  request,
                  supabaseBookingId,
                },
              })
            }
            className="w-full py-4 bg-[#0D0870] text-white rounded-2xl flex items-center justify-center gap-2"
            style={{ fontWeight: 600 }}
          >
            <div
              className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-[12px]"
              style={{ fontWeight: 700 }}
            >
              {offersCount}
            </div>
            <Bell size={16} />
            Voir les offres reçues
          </motion.button>
        )}

        {offersCount === 0 && (
          <div className="flex items-center gap-2 text-[13px] text-[#888780]">
            <Loader2 size={14} className="animate-spin" />
            En attente de réponses…
          </div>
        )}
      </div>

      <div className="px-8 pb-8">
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full py-3 border border-[#E0E0E0] text-[#888780] rounded-2xl text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {cancelling ? <Loader2 size={16} className="animate-spin" /> : null}
          Annuler la demande
        </button>
      </div>
    </div>
  );
}
