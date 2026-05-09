import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  MapPin, ChevronRight, Star, Clock, Zap,
  Syringe, Brain, Flower2, Activity, ChevronDown,
  Phone, MessageCircle, Loader2
} from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../lib/auth-context";
import { getProfessionals, getMyBookings } from "../../lib/api";
import { NotificationBell } from "./NotificationBell";

const MOROCCAN_CITIES = ["Fès", "Casablanca", "Rabat", "Marrakech", "Agadir", "Tanger", "Meknès", "Oujda", "Salé", "Kénitra"];

const primaryServices = [
  { key: "infirmier", label: "Infirmier", sub: "À domicile · Dès 60 MAD", icon: Syringe,
    bgGrad: "linear-gradient(135deg, #0D0870 0%, #1A1585 100%)",
    img: "https://images.unsplash.com/photo-1706958581603-dffa91fec580?w=200&q=80",
    route: "/app/request", tag: "Populaire" },
  { key: "psy", label: "Psychologue", sub: "En ligne ou à domicile", icon: Brain,
    bgGrad: "linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)",
    img: "https://images.unsplash.com/photo-1714976694468-ff722f34d0b6?w=200&q=80",
    route: "/app/psychologist", tag: null },
  { key: "yoga", label: "Yoga", sub: "Séances individuelles", icon: Flower2,
    bgGrad: "linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)",
    img: "https://images.unsplash.com/photo-1767611120077-3697335ec748?w=200&q=80",
    route: "/app/yoga", tag: null },
  { key: "kine", label: "Kiné", sub: "Rééducation à domicile", icon: Activity,
    bgGrad: "linear-gradient(135deg, #065F46 0%, #059669 100%)",
    img: "https://images.unsplash.com/photo-1545463913-5083aa7359a6?w=200&q=80",
    route: "/app/request", tag: null },
];

const quickServices = [
  { label: "Urgence", icon: Zap, color: "#E24B4A", bg: "#FDE8E8", route: "/app/request" },
  { label: "Pansement", icon: Syringe, color: "#0D0870", bg: "#EDE5CC", route: "/app/request" },
  { label: "Injection", icon: Syringe, color: "#5BB8D4", bg: "#D8F0F4", route: "/app/request" },
];

export function PatientDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [city, setCity] = useState(profile?.city || "Fès");
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [upcomingBooking, setUpcomingBooking] = useState<any>(null);
  const [prosLoading, setProsLoading] = useState(true);

  // Sync city with profile when it loads
  useEffect(() => {
    if (profile?.city) setCity(profile.city);
  }, [profile?.city]);

  // Fetch nearby professionals
  useEffect(() => {
    const load = async () => {
      setProsLoading(true);
      try {
        const data = await getProfessionals({ city });
        setProfessionals(data.professionals || []);
      } catch {
        setProfessionals([]);
      } finally {
        setProsLoading(false);
      }
    };
    load();
  }, [city]);

  // Fetch upcoming booking
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyBookings("patient");
        const bookings: any[] = data.bookings || [];
        const upcoming = bookings.find((b: any) => b.status === "confirmed");
        setUpcomingBooking(upcoming || null);
      } catch {
        setUpcomingBooking(null);
      }
    };
    load();
  }, []);

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : "…";
  const avatar = profile?.avatar || "";

  return (
    <div className="flex flex-col pb-6" style={{ background: "#F6F5F0", minHeight: "100%" }}>
      {/* ── Header ── */}
      <div className="px-5 pt-10 pb-5 relative overflow-hidden flex-shrink-0"
        style={{ background: "linear-gradient(160deg, #0D0870 0%, #1A1585 70%, #0D0870 100%)" }}>
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="absolute top-16 -left-6 w-20 h-20 rounded-full" style={{ background: "rgba(91,184,212,0.15)" }} />

        <div className="flex items-center justify-between mb-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-[#5BB8D4]/30 border-2 border-white/30 flex items-center justify-center overflow-hidden">
                {avatar ? (
                  <ImageWithFallback src={avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-base font-bold">
                    {profile?.firstName?.[0] || "?"}{profile?.lastName?.[0] || ""}
                  </span>
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#5BB8D4] rounded-full border-2 border-[#0D0870]" />
            </div>
            <div>
              <p className="text-white/60 text-xs">Bonjour 👋</p>
              <p className="text-white text-base" style={{ fontWeight: 700 }}>{displayName}</p>
            </div>
          </div>

          {/* ── Notification Bell (Realtime) ── */}
          <NotificationBell userId={user?.id ?? null} light />
        </div>

        {/* Location row */}
        <button onClick={() => setShowCityPicker(!showCityPicker)} className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(91,184,212,0.3)" }}>
            <MapPin size={13} className="text-[#5BB8D4]" />
          </div>
          <span className="text-white/80 text-sm" style={{ fontWeight: 500 }}>{city}</span>
          <ChevronDown size={14} className="text-white/50" />
        </button>

        <AnimatePresence>
          {showCityPicker && (
            <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className="absolute left-5 top-[100px] z-20 bg-white rounded-2xl shadow-2xl overflow-hidden"
              style={{ width: 180 }}>
              {MOROCCAN_CITIES.map((c) => (
                <button key={c} onClick={() => { setCity(c); setShowCityPicker(false); }}
                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-2 hover:bg-[#F8F8FC] transition-colors"
                  style={{ color: c === city ? "#0D0870" : "#1A1A1A", fontWeight: c === city ? 600 : 400, borderBottom: "1px solid #F0F0F0" }}>
                  <MapPin size={12} className={c === city ? "text-[#0D0870]" : "text-[#888780]"} />
                  {c}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <p className="text-white text-xl mb-0.5" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Quel soin recherchez-vous ?
          </p>
          <p className="text-white/50 text-xs">Des professionnels certifiés disponibles maintenant</p>
        </div>
      </div>

      {/* ── Quick strip ── */}
      <div className="px-5 -mt-3 mb-4 relative z-10">
        <div className="flex gap-2">
          {quickServices.map((qs) => (
            <motion.button key={qs.label} whileTap={{ scale: 0.95 }}
              onClick={() => navigate(qs.route)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl"
              style={{ background: qs.bg }}>
              <qs.icon size={14} style={{ color: qs.color }} />
              <span className="text-xs" style={{ color: qs.color, fontWeight: 600 }}>{qs.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Service tiles ── */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 700 }}>Choisissez votre service</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {primaryServices.map((s) => (
            <motion.button key={s.key} whileTap={{ scale: 0.97 }}
              onClick={() => navigate(s.route)}
              className="relative rounded-3xl overflow-hidden text-left" style={{ height: 140 }}>
              <img src={s.img} alt={s.label} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 100%)" }} />
              <div className="relative z-10 p-4 flex flex-col h-full justify-between">
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                    <s.icon size={18} className="text-white" />
                  </div>
                  {s.tag && (
                    <span className="text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ background: "rgba(255,255,255,0.25)", fontWeight: 600 }}>{s.tag}</span>
                  )}
                </div>
                <div>
                  <p className="text-white text-base mb-0.5" style={{ fontWeight: 700 }}>{s.label}</p>
                  <p className="text-white/70 text-xs">{s.sub}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-5 mb-5">
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => navigate("/app/request")}
          className="w-full py-4 rounded-3xl flex items-center justify-center gap-2.5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #5BB8D4 0%, #4AACCA 100%)", boxShadow: "0 6px 20px rgba(91,184,212,0.4)" }}>
          <Zap size={18} className="text-white" fill="white" />
          <span className="text-white text-base" style={{ fontWeight: 700 }}>Demander un soin maintenant</span>
          <ChevronRight size={18} className="text-white/80" />
        </motion.button>
        <p className="text-center text-xs text-[#888780] mt-2">⚡ Réponse en moins de 5 minutes</p>
      </div>

      {/* ── Nearby professionals ── */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 700 }}>
            Proches de vous {city && <span className="text-[#888780]">· {city}</span>}
          </p>
        </div>

        {prosLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="text-[#0D0870] animate-spin" />
          </div>
        ) : professionals.length === 0 ? (
          <div className="bg-white rounded-2xl p-5 text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <p className="text-[14px] text-[#888780]">Aucun professionnel trouvé à {city}</p>
            <p className="text-[12px] text-[#B0B0B0] mt-1">Essayez une autre ville ou publiez une demande</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {professionals.slice(0, 4).map((n, i) => (
              <motion.button key={n.id || i} whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/app/provider/${n.id}`)}
                className="bg-white rounded-2xl p-4 flex items-center gap-3 text-left w-full"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                <div className="relative flex-shrink-0">
                  {n.avatar ? (
                    <ImageWithFallback src={n.avatar} alt={n.firstName} className="w-14 h-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-[#EDE5CC] flex items-center justify-center">
                      <span className="text-[#0D0870] text-lg font-bold">
                        {n.firstName?.[0]}{n.lastName?.[0]}
                      </span>
                    </div>
                  )}
                  {n.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
                      style={{ background: "#22C55E" }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1A1A1A] truncate mb-0.5" style={{ fontWeight: 600 }}>
                    {n.firstName} {n.lastName}
                  </p>
                  <p className="text-xs text-[#888780] mb-1.5 capitalize">{n.specialty}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      <Star size={11} fill="#FBBF24" className="text-amber-400" />
                      <span className="text-xs text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                        {n.rating > 0 ? n.rating.toFixed(1) : "Nouveau"}
                      </span>
                      {n.reviewCount > 0 && <span className="text-xs text-[#B0B0B0]">({n.reviewCount})</span>}
                    </div>
                    <span className="text-xs text-[#B0B0B0]">·</span>
                    <div className="flex items-center gap-0.5">
                      <MapPin size={10} className="text-[#B0B0B0]" />
                      <span className="text-xs text-[#888780]">{n.city}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-[#0D0870] mb-2" style={{ fontWeight: 700 }}>
                    Dès {n.minPrice || 60} MAD
                  </p>
                  <div className="flex gap-1.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#EDE5CC" }}>
                      <MessageCircle size={14} className="text-[#0D0870]" />
                    </div>
                    <a href={`tel:${n.phone}`} onClick={(e) => e.stopPropagation()}
                      className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#0D0870" }}>
                      <Phone size={14} className="text-white" />
                    </a>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* ── Next appointment ── */}
      {upcomingBooking && (
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 700 }}>Prochain rendez-vous</p>
            <button onClick={() => navigate("/app/bookings")} className="text-xs text-[#0D0870]" style={{ fontWeight: 500 }}>
              Historique
            </button>
          </div>

          <motion.button whileTap={{ scale: 0.99 }} onClick={() => navigate("/app/tracking")}
            className="w-full text-left relative overflow-hidden rounded-3xl p-5"
            style={{ background: "linear-gradient(135deg, #0D0870 0%, #1A1585 100%)", boxShadow: "0 6px 24px rgba(13,8,112,0.25)" }}>
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="absolute right-8 bottom-2 w-16 h-16 rounded-full" style={{ background: "rgba(91,184,212,0.12)" }} />

            <div className="flex items-center justify-between relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2.5 py-1 rounded-full text-[#0D0870]"
                    style={{ background: "#EDE5CC", fontWeight: 600 }}>{upcomingBooking.careType}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full text-white"
                    style={{ background: "rgba(91,184,212,0.3)", fontWeight: 500 }}>Confirmé</span>
                </div>
                <p className="text-white text-base mb-1" style={{ fontWeight: 700 }}>{upcomingBooking.proName}</p>
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-white/60" />
                  <span className="text-white/70 text-sm">{upcomingBooking.dateStr} — {upcomingBooking.timeStr}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.12)" }}>
                <ChevronRight size={22} className="text-white" />
              </div>
            </div>
          </motion.button>
        </div>
      )}
    </div>
  );
}
