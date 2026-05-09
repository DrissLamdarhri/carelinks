import { useState, useEffect } from "react";
import { TrendingUp, Banknote, Calendar, Loader2, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { getMyBookings } from "../../lib/api";
import { toast } from "sonner";

const COMMISSION_RATE = 0.15; // 15% platform fee

export function NurseEarnings() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyBookings("pro");
        setBookings(data.bookings || []);
      } catch {
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filter by period
  const now = new Date();
  const periodStart = new Date(now);
  if (period === "week") {
    periodStart.setDate(now.getDate() - 7);
  } else {
    periodStart.setDate(1);
  }

  const filteredBookings = bookings.filter((b) => {
    if (b.status !== "completed") return false;
    try {
      return new Date(b.createdAt) >= periodStart;
    } catch { return false; }
  });

  const allCompleted = bookings.filter((b) => b.status === "completed");
  const gross = filteredBookings.reduce((s, b) => s + (b.price || 0), 0);
  const commission = Math.round(gross * COMMISSION_RATE);
  const net = gross - commission;

  // Group by day for mini chart
  const dayMap: Record<string, number> = {};
  filteredBookings.forEach((b) => {
    const day = b.dateStr || b.createdAt?.split("T")[0] || "";
    dayMap[day] = (dayMap[day] || 0) + (b.price || 0);
  });
  const chartDays = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7);
  const maxVal = Math.max(...chartDays.map(([, v]) => v), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="text-[#0D0870] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#0D0870] px-5 pt-12 pb-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-white/5 rounded-t-2xl" />
        <p className="text-white/60 text-[13px] mb-1">Revenus nets ({period === "week" ? "7 derniers jours" : "ce mois"})</p>
        <p className="text-white text-[36px] mb-4" style={{ fontWeight: 800 }}>
          {net} <span className="text-[16px]" style={{ fontWeight: 500 }}>MAD</span>
        </p>

        <div className="flex gap-3">
          {[
            { label: "Brut", value: `${gross} MAD`, icon: Banknote },
            { label: "Commission (15%)", value: `-${commission} MAD`, icon: TrendingUp },
          ].map((s) => (
            <div key={s.label} className="flex-1 bg-white/10 rounded-xl p-3">
              <s.icon size={14} className="text-white/60 mb-1" />
              <p className="text-white text-[14px]" style={{ fontWeight: 600 }}>{s.value}</p>
              <p className="text-white/50 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Period toggle */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex bg-[#F3F3F5] rounded-xl p-1">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2.5 rounded-lg text-[13px] transition-all ${
                period === p ? "bg-white text-[#1A1A1A]" : "text-[#888780]"
              }`}
              style={{ fontWeight: period === p ? 600 : 400, boxShadow: period === p ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}
            >
              {p === "week" ? "7 jours" : "Ce mois"}
            </button>
          ))}
        </div>
      </div>

      {/* Mini bar chart */}
      {chartDays.length > 0 && (
        <div className="px-5 mb-4">
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <p className="text-[12px] text-[#888780] mb-3" style={{ fontWeight: 500 }}>Revenus par jour</p>
            <div className="flex items-end gap-1.5 h-16">
              {chartDays.map(([day, val]) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(val / maxVal) * 100}%` }}
                    className="w-full rounded-t-md min-h-[4px]"
                    style={{ background: "#0D0870" }}
                  />
                  <span className="text-[9px] text-[#B0B0B0]">
                    {new Date(day).toLocaleDateString("fr-MA", { day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Missions terminées", value: allCompleted.length, icon: Calendar, color: "#0D0870" },
            { label: "Total cumulé", value: `${allCompleted.reduce((s, b) => s + (b.price || 0), 0)} MAD`, icon: ArrowUpRight, color: "#5BB8D4" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <s.icon size={18} style={{ color: s.color }} className="mb-2" />
              <p className="text-[18px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>{s.value}</p>
              <p className="text-[11px] text-[#888780]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions list */}
      <div className="px-5">
        <p className="text-[13px] text-[#1A1A1A] mb-3" style={{ fontWeight: 600 }}>
          Historique des transactions
        </p>
        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-2xl p-5 text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <p className="text-[14px] text-[#888780]">Aucune mission terminée sur cette période</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredBookings.map((b, i) => {
              const comm = Math.round((b.price || 0) * COMMISSION_RATE);
              const netAmount = (b.price || 0) - comm;
              return (
                <motion.div key={b.id || i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl p-4 flex items-center gap-3"
                  style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
                  <div className="w-10 h-10 rounded-xl bg-[#EDE5CC] flex items-center justify-center flex-shrink-0">
                    <Banknote size={18} className="text-[#0D0870]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#1A1A1A] truncate" style={{ fontWeight: 500 }}>
                      {b.patientName || "Patient"}
                    </p>
                    <p className="text-[11px] text-[#888780]">
                      {b.careType} · {b.dateStr ? new Date(b.dateStr).toLocaleDateString("fr-MA", { day: "numeric", month: "short" }) : "—"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[15px] text-[#0D0870]" style={{ fontWeight: 700 }}>+{netAmount} MAD</p>
                    <p className="text-[10px] text-[#B0B0B0]">-{comm} comm.</p>
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
