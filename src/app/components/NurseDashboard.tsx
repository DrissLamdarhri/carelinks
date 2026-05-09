import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  MapPin, Star, Check, X, Banknote,
  TrendingUp, Calendar, Activity, Loader2, Wifi, WifiOff
} from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth-context";
import { getMyBookings, submitOffer, setProOnlineStatus } from "../../lib/api";
import { useOpenBookingsBySpecialty } from "../../lib/db/realtime";
import { db } from "../../lib/db";
import { toDbSpecialty } from "../../lib/db/types";
import { NotificationBell } from "./NotificationBell";

export function NurseDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const proId = user?.id;

  const [tab, setTab] = useState<"requests" | "schedule">("requests");
  const [kvRequests, setKvRequests] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [counterOfferId, setCounterOfferId] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);

  // ── Realtime feed from Supabase (open bookings by specialty) ────────────────
  const proSpecialty = toDbSpecialty((profile as any)?.specialty || "nurse");
  const { bookings: supabaseRequests, loading: rtLoading } =
    useOpenBookingsBySpecialty(proId ? proSpecialty : null);

  // Merge KV requests (legacy) with Supabase realtime bookings
  const requests = supabaseRequests.length > 0 ? supabaseRequests : kvRequests;

  // Stats
  const todayEarnings = bookings
    .filter(
      (b) =>
        b.status === "completed" &&
        b.scheduledAt?.startsWith(new Date().toISOString().split("T")[0])
    )
    .reduce((sum, b) => sum + (b.price || b.final_price_mad || 0), 0);
  const monthMissions = bookings.filter((b) => b.status !== "cancelled").length;

  const loadKvRequests = async () => {
    try {
      const { getPendingRequests } = await import("../../lib/api");
      const data = await getPendingRequests(profile?.city);
      setKvRequests(data.requests || []);
    } catch {
      setKvRequests([]);
    }
  };

  const loadBookings = async () => {
    try {
      const data = await getMyBookings("pro");
      setBookings(data.bookings || []);
    } catch {
      setBookings([]);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadKvRequests(), loadBookings()]);
      setLoading(false);
    };
    init();
    const iv = setInterval(loadKvRequests, 15000);
    return () => clearInterval(iv);
  }, [profile?.city]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleOnline = async () => {
    if (!proId) return;
    const newStatus = !isOnline;
    try {
      await setProOnlineStatus(proId, newStatus);
      setIsOnline(newStatus);
      toast.success(newStatus ? "Vous êtes maintenant en ligne" : "Vous êtes hors ligne");
    } catch {
      toast.error("Erreur lors du changement de statut");
    }
  };

  const handleAccept = async (req: any) => {
    if (!req || !proId) return;
    setActionId(req.id + "_accept");
    try {
      if (req.patient_id) {
        await db.bids.create({
          booking_id: req.id,
          professional_id: proId,
          price_mad: req.budget_max_mad ?? 100,
        });
        toast.success("Offre envoyée au patient !");
      } else {
        await submitOffer(req.id, req.proposedPrice);
        toast.success("Offre envoyée au patient !");
      }
      setKvRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi de l'offre");
    } finally {
      setActionId(null);
    }
  };

  const handleCounter = (req: any) => {
    setCounterOfferId(req.id);
    setCounterPrice((req.proposedPrice ?? req.budget_max_mad ?? 100) + 20);
  };

  const submitCounter = async () => {
    if (!counterOfferId || !proId) return;
    const req = requests.find((r) => r.id === counterOfferId);
    if (!req) return;
    setActionId(counterOfferId);
    try {
      if (req.patient_id) {
        await db.bids.create({
          booking_id: req.id,
          professional_id: proId,
          price_mad: counterPrice,
          message: "Contre-offre",
        });
      } else {
        await submitOffer(req.id, counterPrice);
      }
      toast.success("Contre-offre envoyée !");
      setKvRequests((prev) => prev.filter((r) => r.id !== counterOfferId));
      setCounterOfferId(null);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = (reqId: string) => {
    setKvRequests((prev) => prev.filter((r) => r.id !== reqId));
    toast.info("Demande ignorée");
  };

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : "Professionnel";
  const proRating = (user as any)?.rating || 0;

  return (
    <div className="flex flex-col h-full bg-[#EDE5CC]">
      {/* ── Header ── */}
      <div className="bg-[#0D0870] px-5 pt-12 pb-5 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/5" />

        <div className="flex items-center justify-between mb-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#5BB8D4]/30 border-2 border-white/30 flex items-center justify-center overflow-hidden">
              {profile?.avatar ? (
                <ImageWithFallback src={profile.avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold">{profile?.firstName?.[0]}{profile?.lastName?.[0]}</span>
              )}
            </div>
            <div>
              <p className="text-white/60 text-[12px]">Bonjour 👋</p>
              <p className="text-white text-[18px]" style={{ fontWeight: 600 }}>{displayName}</p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Online toggle */}
            <button onClick={toggleOnline}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${isOnline ? "bg-green-500/20" : "bg-white/10"}`}>
              {isOnline ? <Wifi size={14} className="text-green-400" /> : <WifiOff size={14} className="text-white/50" />}
              <span className="text-[11px]" style={{ color: isOnline ? "#4ade80" : "rgba(255,255,255,0.5)", fontWeight: 500 }}>
                {isOnline ? "En ligne" : "Hors ligne"}
              </span>
            </button>
            {/* ── Realtime Notification Bell ── */}
            <NotificationBell userId={proId ?? null} light />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3">
          {[
            { icon: TrendingUp, label: "Aujourd'hui", value: `${todayEarnings} MAD` },
            { icon: Star, label: "Note", value: proRating > 0 ? proRating.toFixed(1) : "—" },
            { icon: Activity, label: "Ce mois", value: `${monthMissions} missions` },
          ].map((s) => (
            <div key={s.label} className="flex-1 bg-white/10 rounded-xl p-3">
              <s.icon size={14} className="text-white/60 mb-1" />
              <p className="text-white text-[14px]" style={{ fontWeight: 700 }}>{s.value}</p>
              <p className="text-white/50 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Realtime badge */}
      {supabaseRequests.length > 0 && (
        <div className="bg-[#5BB8D4]/10 px-4 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#5BB8D4] animate-pulse" />
          <span className="text-[11px] text-[#0D0870]" style={{ fontWeight: 500 }}>
            Flux temps réel actif · {supabaseRequests.length} demande(s) ouverte(s)
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white px-5 border-b border-[#F0F0F0]">
        <div className="flex">
          {(["requests", "schedule"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-[14px] border-b-2 transition-all ${tab === t ? "border-[#0D0870] text-[#0D0870]" : "border-transparent text-[#888780]"}`}
              style={{ fontWeight: tab === t ? 600 : 400 }}>
              {t === "requests" ? `Demandes (${requests.length})` : "Mon planning"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">
        {tab === "requests" && (
          <div className="flex flex-col gap-3">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={28} className="text-[#0D0870] animate-spin" />
              </div>
            )}

            {!loading && !rtLoading && requests.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-[#F3F3F5] flex items-center justify-center mb-4">
                  <Calendar size={28} className="text-[#D0D0D0]" />
                </div>
                <p className="text-[15px] text-[#888780]" style={{ fontWeight: 500 }}>Aucune demande pour le moment</p>
                <p className="text-[12px] text-[#B0B0B0] mt-1">
                  {isOnline ? "Restez en ligne pour recevoir des demandes" : "Passez en ligne pour voir les demandes"}
                </p>
              </div>
            )}

            <AnimatePresence>
              {requests.map((r) => (
                <motion.div key={r.id} layout
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -200 }}
                  className="bg-white rounded-2xl overflow-hidden"
                  style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
                  {/* New badge */}
                  <div className="bg-[#6BB8C8] px-4 py-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-white" style={{ fontWeight: 600 }}>Nouvelle demande</span>
                    <span className="text-[10px] text-white/70">
                      {new Date(r.createdAt ?? r.created_at ?? Date.now()).toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="p-4">
                    {(() => {
                      const isSupabase = !!r.patient_id;
                      const label = isSupabase ? r.specialty?.replace("_", " ") : r.careType;
                      const budget = isSupabase ? r.budget_max_mad : r.proposedPrice;
                      const when = isSupabase
                        ? (r.scheduled_at
                            ? new Date(r.scheduled_at).toLocaleString("fr-MA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                            : "—")
                        : `${new Date(r.dateStr ?? r.created_at).toLocaleDateString("fr-MA", { day: "numeric", month: "short" })} · ${r.timeStr ?? ""}`;
                      return (
                        <>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-[#EDE5CC] flex items-center justify-center flex-shrink-0">
                              <span className="text-[#0D0870] font-bold text-base">
                                {(r.patientName ?? "P")?.split(" ").map((n: string) => n[0]).join("")}
                              </span>
                            </div>
                            <div className="flex-1">
                              <p className="text-[15px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                                {r.patientName ?? (isSupabase ? "Patient" : "—")}
                              </p>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#EDE5CC] text-[#0D0870] capitalize" style={{ fontWeight: 500 }}>
                                {label}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-[22px] text-[#0D0870]" style={{ fontWeight: 800 }}>{budget ?? "—"}</p>
                              <p className="text-[10px] text-[#888780]">MAD proposé</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mb-3 text-[12px] text-[#888780]">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {when}
                            </span>
                          </div>
                          {r.address && (
                            <div className="flex items-center gap-2 mb-4 bg-[#F3F3F5] rounded-xl px-3 py-2">
                              <MapPin size={14} className="text-[#888780]" />
                              <span className="text-[12px] text-[#888780]">{r.address}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Counter-offer input */}
                    {counterOfferId === r.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-3">
                        <p className="text-[12px] text-[#888780] mb-2" style={{ fontWeight: 500 }}>Votre contre-offre :</p>
                        <div className="flex items-center gap-3">
                          <input type="number" value={counterPrice} onChange={(e) => setCounterPrice(Number(e.target.value))}
                            className="flex-1 h-[44px] bg-[#F3F3F5] rounded-xl px-4 text-[16px] text-[#0D0870] outline-none"
                            style={{ fontWeight: 700 }} />
                          <span className="text-[14px] text-[#888780]">MAD</span>
                          <button onClick={submitCounter} disabled={actionId !== null}
                            className="h-[44px] px-4 bg-[#0D0870] text-white rounded-xl text-[13px] disabled:opacity-50"
                            style={{ fontWeight: 600 }}>
                            {actionId === counterOfferId ? <Loader2 size={16} className="animate-spin" /> : "Envoyer"}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => handleAccept(r)}
                        disabled={actionId !== null}
                        className="flex-1 py-3 bg-[#0D0870] text-white rounded-xl text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-60"
                        style={{ fontWeight: 600 }}>
                        {actionId === r.id + "_accept" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Accepter
                      </motion.button>
                      <button onClick={() => handleCounter(r)} disabled={actionId !== null}
                        className="flex-1 py-3 border-2 border-[#0D0870] text-[#0D0870] rounded-xl text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                        style={{ fontWeight: 600 }}>
                        <Banknote size={16} /> Contre-offre
                      </button>
                      <button onClick={() => handleReject(r.id)} disabled={actionId !== null}
                        className="w-12 py-3 border border-[#E0E0E0] text-[#888780] rounded-xl flex items-center justify-center disabled:opacity-50">
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {tab === "schedule" && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="text-[#0D0870] animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-[#F3F3F5] flex items-center justify-center mb-4">
                  <Calendar size={28} className="text-[#D0D0D0]" />
                </div>
                <p className="text-[15px] text-[#888780]" style={{ fontWeight: 500 }}>Aucun rendez-vous</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {bookings.map((b, i) => (
                  <div key={b.id || i} className="bg-white rounded-2xl p-4 flex items-center gap-4"
                    style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                    <div className="text-center min-w-[52px]">
                      <p className="text-[16px] text-[#0D0870]" style={{ fontWeight: 700 }}>{b.timeStr}</p>
                      <p className="text-[10px] text-[#888780]">{new Date(b.dateStr).toLocaleDateString("fr-MA", { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="w-px h-10 bg-[#E0E0E0]" />
                    <div className="flex-1">
                      <p className="text-[14px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>{b.patientName}</p>
                      <p className="text-[12px] text-[#888780]">{b.careType} · {b.address}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                        b.status === "completed" ? "bg-[#F3F3F5] text-[#888780]" :
                        b.status === "confirmed" ? "bg-[#EDE5CC] text-[#0D0870]" : "bg-[#FDE8E8] text-[#E24B4A]"
                      }`}>
                        {b.status === "completed" ? "Terminé" : b.status === "confirmed" ? "À venir" : b.status}
                      </span>
                      <p className="text-[13px] text-[#0D0870]" style={{ fontWeight: 700 }}>{b.price} MAD</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
