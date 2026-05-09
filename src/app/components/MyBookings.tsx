import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, Clock, MapPin, Star, ChevronRight, Loader2, Calendar,
} from "lucide-react";
import { motion } from "motion/react";
import { getMyBookings } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { usePatientBookings } from "../../lib/db/realtime";

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  // Supabase statuses
  open:        { color: "#0891B2", bg: "#D8F0F4", label: "En attente" },
  matched:     { color: "#0D0870", bg: "#EDE5CC", label: "Confirmé" },
  in_progress: { color: "#0891B2", bg: "#D8F0F4", label: "En cours" },
  completed:   { color: "#16A34A", bg: "#DCFCE7", label: "Terminé" },
  cancelled:   { color: "#E24B4A", bg: "#FDE8E8", label: "Annulé" },
  // Legacy KV statuses
  confirmed:   { color: "#0D0870", bg: "#EDE5CC", label: "Confirmé" },
};

export function MyBookings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [kvBookings, setKvBookings] = useState<any[]>([]);
  const [kvLoading, setKvLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  // ── Real-time bookings from Supabase ──────────────────────────────────────
  const {
    bookings: rtBookings,
    upcoming: rtUpcoming,
    past: rtPast,
    loading: rtLoading,
  } = usePatientBookings(user?.id ?? null);

  // Fall back to KV if Supabase has nothing yet
  const useRealtime = rtBookings.length > 0;
  const loading = rtLoading && kvLoading;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyBookings("patient");
        setKvBookings(data.bookings || []);
      } catch {
        setKvBookings([]);
      } finally {
        setKvLoading(false);
      }
    };
    load();
  }, []);

  const upcoming = useRealtime
    ? rtUpcoming
    : kvBookings.filter((b) =>
        ["confirmed", "matched", "open", "in_progress"].includes(b.status)
      );
  const past = useRealtime
    ? rtPast
    : kvBookings.filter((b) =>
        ["completed", "cancelled"].includes(b.status)
      );
  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <div className="flex flex-col h-full bg-[#EDE5CC]">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-[#F0F0F0]">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate("/app")}
            className="w-10 h-10 rounded-full bg-[#F3F3F5] flex items-center justify-center"
          >
            <ArrowLeft size={20} className="text-[#1A1A1A]" />
          </button>
          <p
            className="text-[20px] text-[#1A1A1A]"
            style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}
          >
            Mes Rendez-vous
          </p>
          {useRealtime && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-[#5BB8D4]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5BB8D4] animate-pulse" />
              Temps réel
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-[#F3F3F5] rounded-xl p-1">
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-[13px] transition-all ${
                tab === t ? "bg-white text-[#1A1A1A]" : "text-[#888780]"
              }`}
              style={{
                fontWeight: tab === t ? 600 : 400,
                boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {t === "upcoming"
                ? `À venir (${upcoming.length})`
                : `Passés (${past.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="text-[#0D0870] animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-[#F3F3F5] flex items-center justify-center mb-4">
              <Calendar size={28} className="text-[#D0D0D0]" />
            </div>
            <p
              className="text-[15px] text-[#888780]"
              style={{ fontWeight: 500 }}
            >
              {tab === "upcoming"
                ? "Aucun rendez-vous à venir"
                : "Aucun historique"}
            </p>
            {tab === "upcoming" && (
              <button
                onClick={() => navigate("/app/request")}
                className="mt-4 px-5 py-2.5 bg-[#0D0870] text-white rounded-xl text-[13px]"
                style={{ fontWeight: 600 }}
              >
                Prendre un rendez-vous
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayed.map((b: any, i: number) => {
              const s = statusConfig[b.status] ?? statusConfig.confirmed;
              const isSupabase = !!b.patient_id;

              // Normalise fields between Supabase & KV shapes
              const label = isSupabase
                ? (b.specialty?.replace(/_/g, " ") ?? "Soin")
                : b.careType ?? "Soin";
              const proLabel = b.proName ?? "Professionnel";
              const price = b.final_price_mad ?? b.price ?? b.budget_max_mad;
              const when =
                isSupabase && b.scheduled_at
                  ? new Date(b.scheduled_at).toLocaleString("fr-MA", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : b.dateStr
                  ? `${new Date(b.dateStr).toLocaleDateString("fr-MA", {
                      day: "numeric",
                      month: "short",
                    })} · ${b.timeStr ?? ""}`
                  : "—";

              const isCompleted = b.status === "completed";
              const isActive = ["matched", "confirmed", "in_progress"].includes(b.status);

              return (
                <motion.div
                  key={b.id ?? i}
                  className="bg-white rounded-2xl p-4 text-left w-full"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#EDE5CC] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#0D0870] font-bold">
                        {proLabel
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2) || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[14px] text-[#1A1A1A] truncate"
                        style={{ fontWeight: 600 }}
                      >
                        {proLabel}
                      </p>
                      <p className="text-[12px] text-[#888780] capitalize">
                        {label}
                      </p>
                    </div>
                    <span
                      className="text-[11px] px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: s.bg, color: s.color, fontWeight: 600 }}
                    >
                      {s.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[12px] text-[#888780] mb-2">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {when}
                    </span>
                    {b.address && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={12} />
                        <span className="truncate">{b.address}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F5]">
                    <p
                      className="text-[15px] text-[#0D0870]"
                      style={{ fontWeight: 700 }}
                    >
                      {price != null ? `${price} MAD` : "—"}
                    </p>

                    {isCompleted && !b.rating && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() =>
                          navigate("/app/rating", {
                            state: { bookingId: b.id, booking: b },
                          })
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EDE5CC] text-[#0D0870] text-[12px]"
                        style={{ fontWeight: 600 }}
                      >
                        <Star size={12} fill="#0D0870" />
                        Évaluer
                      </motion.button>
                    )}
                    {isCompleted && b.rating && (
                      <div className="flex items-center gap-1">
                        <Star
                          size={12}
                          fill="#FBBF24"
                          className="text-amber-400"
                        />
                        <span className="text-[12px] text-[#888780]">
                          {b.rating}/5
                        </span>
                      </div>
                    )}
                    {isActive && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() =>
                          navigate("/app/tracking", {
                            state: { bookingId: b.id, booking: b },
                          })
                        }
                        className="flex items-center gap-1 text-[12px] text-[#0D0870]"
                        style={{ fontWeight: 500 }}
                      >
                        Suivre <ChevronRight size={14} />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
