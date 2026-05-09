/**
 * AdminMetrics — KPI dashboard: GMV, take rate, active pros, disputes, etc.
 * Reads via aggregate queries; no special SQL needed.
 */
import { useEffect, useState } from "react";
import { TrendingUp, Users, AlertCircle, DollarSign, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Metrics {
  gmv: number; commission: number; bookingsCount: number; activePros: number;
  openDisputes: number; pendingKyc: number;
}

export function AdminMetrics() {
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [pays, pros, disputes, kyc] = await Promise.all([
        supabase.from("payments").select("amount_mad, commission_mad, status, created_at").gte("created_at", since),
        supabase.from("professionals").select("id", { count: "exact", head: true }).eq("verification_status", "approved").eq("is_available", true),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("dispute_open", true),
        supabase.from("professionals").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
      ]);
      const captured = (pays.data ?? []).filter((p: any) => p.status === "captured");
      const gmv = captured.reduce((s: number, p: any) => s + (p.amount_mad ?? 0), 0);
      const commission = captured.reduce((s: number, p: any) => s + (p.commission_mad ?? 0), 0);
      setM({
        gmv, commission, bookingsCount: captured.length,
        activePros: pros.count ?? 0,
        openDisputes: disputes.count ?? 0,
        pendingKyc: kyc.count ?? 0,
      });
    })();
  }, []);

  if (!m) return <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#0D0870]" /></div>;

  const cards = [
    { label: "GMV (30j)",       value: `${m.gmv.toLocaleString()} MAD`,        icon: <DollarSign size={20} />, accent: "#0D0870" },
    { label: "Commission",      value: `${m.commission.toLocaleString()} MAD`, icon: <TrendingUp size={20} />, accent: "#5BB8D4" },
    { label: "Prestations",     value: m.bookingsCount,                        icon: <TrendingUp size={20} />, accent: "#0D0870" },
    { label: "Pros actifs",     value: m.activePros,                           icon: <Users size={20} />,      accent: "#5BB8D4" },
    { label: "Litiges ouverts", value: m.openDisputes,                         icon: <AlertCircle size={20} />, accent: "#E24B4A" },
    { label: "KYC en attente",  value: m.pendingKyc,                           icon: <Users size={20} />,      accent: "#F5B544" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-2xl p-5 border border-[#EDE5CC]">
          <div className="flex items-center gap-2 mb-2 text-[#888780]">
            <span style={{ color: c.accent }}>{c.icon}</span>
            <span className="text-[12px]">{c.label}</span>
          </div>
          <p className="text-[24px] text-[#1A1A1A]" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
