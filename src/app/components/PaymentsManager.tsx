import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownCircle, Lock, RefreshCw, Unlock } from "lucide-react";

// Read-only escrow oversight: the money the platform is currently holding vs
// released vs refunded, plus a flag for holds that have been stuck too long
// (the "escrow frozen" problem). No mutations here on purpose — settlement is
// done by the DB function settle_stale_bookings / cancel_booking, so this stays
// a safe window onto the money rather than a place to move it by hand.

type PaymentStatus = "pending" | "authorized" | "captured" | "refunded" | "failed";
type PaymentRow = {
  id: string;
  booking_id: string;
  amount_mad: number;
  commission_mad: number;
  status: PaymentStatus;
  kind: string | null;
  provider: string | null;
  created_at: string;
  specialty?: string;
};

const STALE_HOURS = 48;

const STATUS_STYLE: Record<PaymentStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#F3F3F5", fg: "#888780", label: "En attente" },
  authorized: { bg: "#FFF7E6", fg: "#B45309", label: "Bloqué (escrow)" },
  captured: { bg: "#DCFCE7", fg: "#15803D", label: "Versé" },
  refunded: { bg: "#E0F2FE", fg: "#0369A1", label: "Remboursé" },
  failed: { bg: "#FDE8E8", fg: "#B91C1C", label: "Échoué" },
};

export function PaymentsManager() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PaymentStatus | "all" | "stuck">("all");

  const load = async () => {
    setLoading(true);
    try {
      const { data: pays, error } = await supabase
        .from("payments")
        .select("id, booking_id, amount_mad, commission_mad, status, kind, provider, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;

      const bookingIds = Array.from(new Set((pays ?? []).map((p: any) => p.booking_id)));
      const specById = new Map<string, string>();
      if (bookingIds.length > 0) {
        const { data: bookings } = await supabase
          .from("bookings")
          .select("id, specialty")
          .in("id", bookingIds);
        for (const b of bookings ?? []) specById.set(b.id as string, b.specialty as string);
      }
      setRows((pays ?? []).map((p: any) => ({ ...p, specialty: specById.get(p.booking_id) ?? "—" })));
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement des paiements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const sub = supabase
      .channel("payments_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isStuck = (r: PaymentRow) =>
    r.status === "authorized" && Date.now() - new Date(r.created_at).getTime() > STALE_HOURS * 3600_000;

  const totals = useMemo(() => {
    let held = 0, captured = 0, refunded = 0, stuck = 0;
    for (const r of rows) {
      if (r.status === "authorized") { held += Number(r.amount_mad); if (isStuck(r)) stuck += Number(r.amount_mad); }
      else if (r.status === "captured") captured += Number(r.amount_mad);
      else if (r.status === "refunded") refunded += Number(r.amount_mad);
    }
    return { held, captured, refunded, stuck };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "stuck") return rows.filter(isStuck);
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const money = (n: number) => `${n.toLocaleString("fr-MA")} MAD`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl" style={{ fontWeight: 700, color: "#1A1A1A" }}>Paiements &amp; escrow</h2>
          <p className="text-sm" style={{ color: "#888780" }}>Fonds bloqués, versés et remboursés</p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm"
          style={{ background: "#F3F3F5", color: "#0D0870", fontWeight: 600 }}
        >
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <SummaryCard icon={Lock} label="Bloqué (escrow)" value={money(totals.held)} tint="#B45309" bg="#FFF7E6" />
        <SummaryCard icon={Unlock} label="Versé aux pros" value={money(totals.captured)} tint="#15803D" bg="#DCFCE7" />
        <SummaryCard icon={ArrowDownCircle} label="Remboursé" value={money(totals.refunded)} tint="#0369A1" bg="#E0F2FE" />
        <SummaryCard icon={AlertTriangle} label={`Bloqué > ${STALE_HOURS}h`} value={money(totals.stuck)} tint="#B91C1C" bg="#FDE8E8" />
      </div>

      {totals.stuck > 0 ? (
        <div className="rounded-xl px-4 py-3 mb-4 flex items-start gap-2" style={{ background: "#FDE8E8" }}>
          <AlertTriangle size={16} style={{ color: "#B91C1C", marginTop: 2 }} />
          <p className="text-sm" style={{ color: "#7F1D1D" }}>
            {money(totals.stuck)} sont bloqués depuis plus de {STALE_HOURS}h. Lancez
            <code style={{ background: "#fff", padding: "1px 6px", borderRadius: 6, margin: "0 4px" }}>settle_stale_bookings()</code>
            (SQL) pour les régler automatiquement.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "authorized", "captured", "refunded", "stuck"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className="rounded-full px-3.5 py-1.5 text-xs"
            style={{ background: filter === k ? "#0D0870" : "#F3F3F5", color: filter === k ? "#fff" : "#888780", fontWeight: 600 }}
          >
            {k === "all" ? "Tous" : k === "stuck" ? "Bloqués longtemps" : STATUS_STYLE[k as PaymentStatus].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: "#888780" }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white py-16 text-center text-sm" style={{ color: "#888780" }}>Aucun paiement</div>
      ) : (
        <div className="rounded-2xl bg-white overflow-hidden" style={{ border: "1px solid #EFEFF2" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr style={{ background: "#FAFAFC", color: "#888780" }}>
                  <Th>Service</Th><Th>Type</Th><Th>Montant</Th><Th>Commission</Th><Th>Statut</Th><Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const s = STATUS_STYLE[r.status];
                  const stuck = isStuck(r);
                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid #F0F0F3", background: stuck ? "#FEF6F6" : undefined }}>
                      <Td><span style={{ fontWeight: 600, color: "#1A1A1A", textTransform: "capitalize" }}>{(r.specialty ?? "").replace(/_/g, " ")}</span></Td>
                      <Td><span style={{ color: "#888780" }}>{r.kind ?? "service"}</span></Td>
                      <Td><span style={{ fontWeight: 700, color: "#0D0870" }}>{money(Number(r.amount_mad))}</span></Td>
                      <Td><span style={{ color: "#888780" }}>{money(Number(r.commission_mad))}</span></Td>
                      <Td>
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: s.bg, color: s.fg, fontWeight: 600 }}>
                          {stuck ? <AlertTriangle size={11} /> : null}{s.label}
                        </span>
                      </Td>
                      <Td><span style={{ color: "#888780" }}>{fmtDate(r.created_at)}</span></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tint, bg }: { icon: any; label: string; value: string; tint: string; bg: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 flex items-center gap-3" style={{ border: "1px solid #EFEFF2" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon size={18} style={{ color: tint }} />
      </div>
      <div className="min-w-0">
        <div className="text-lg" style={{ fontWeight: 800, color: "#1A1A1A" }}>{value}</div>
        <div className="text-xs" style={{ color: "#888780" }}>{label}</div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs" style={{ textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3" style={{ textAlign: "left", whiteSpace: "nowrap" }}>{children}</td>;
}
