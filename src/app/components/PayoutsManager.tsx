import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { Banknote, Check, Clock, RefreshCw, Wallet, X } from "lucide-react";

// Admin view for pro withdrawal requests. Pros tap "Retirer" in the app which
// inserts a `payouts` row (status 'requested'); this is where an admin actually
// actions it: requested -> processing -> paid, or rejects it. Advancing the
// status is what makes the payout real (the bank transfer itself is offline).

type PayoutStatus = "requested" | "processing" | "paid" | "rejected";
type PayoutRow = {
  id: string;
  professional_id: string;
  amount_mad: number;
  status: PayoutStatus;
  method: string | null;
  note: string | null;
  created_at: string;
  processed_at: string | null;
  pro_name?: string;
};

const STATUS_STYLE: Record<PayoutStatus, { bg: string; fg: string; label: string }> = {
  requested: { bg: "#FFF7E6", fg: "#B45309", label: "Demandé" },
  processing: { bg: "#E0F2FE", fg: "#0369A1", label: "En traitement" },
  paid: { bg: "#DCFCE7", fg: "#15803D", label: "Payé" },
  rejected: { bg: "#FDE8E8", fg: "#B91C1C", label: "Rejeté" },
};

export function PayoutsManager() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PayoutStatus | "all">("all");

  const load = async () => {
    setLoading(true);
    try {
      const { data: payouts, error } = await supabase
        .from("payouts")
        .select("id, professional_id, amount_mad, status, method, note, created_at, processed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const proIds = Array.from(new Set((payouts ?? []).map((p: any) => p.professional_id)));
      const names = new Map<string, string>();
      if (proIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", proIds);
        for (const p of profiles ?? []) names.set(p.id as string, (p.full_name as string) || "—");
      }
      setRows((payouts ?? []).map((p: any) => ({ ...p, pro_name: names.get(p.professional_id) ?? "—" })));
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement des retraits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const sub = supabase
      .channel("payouts_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "payouts" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (id: string, status: PayoutStatus) => {
    setBusyId(id);
    try {
      const patch: Record<string, unknown> = { status };
      if (status === "paid" || status === "rejected") patch.processed_at = new Date().toISOString();
      const { error } = await supabase.from("payouts").update(patch).eq("id", id);
      if (error) throw error;
      toast.success(`Retrait: ${STATUS_STYLE[status].label}`);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status, processed_at: (patch.processed_at as string) ?? r.processed_at } : r)));
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de mettre à jour le retrait");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );
  const pendingTotal = useMemo(
    () => rows.filter((r) => r.status === "requested" || r.status === "processing").reduce((s, r) => s + Number(r.amount_mad), 0),
    [rows],
  );
  const paidTotal = useMemo(
    () => rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount_mad), 0),
    [rows],
  );

  const money = (n: number) => `${n.toLocaleString("fr-MA")} MAD`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl" style={{ fontWeight: 700, color: "#1A1A1A" }}>Retraits</h2>
          <p className="text-sm" style={{ color: "#888780" }}>Demandes de retrait des professionnels</p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm"
          style={{ background: "#F3F3F5", color: "#0D0870", fontWeight: 600 }}
        >
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <SummaryCard icon={Clock} label="À traiter" value={money(pendingTotal)} tint="#B45309" bg="#FFF7E6" />
        <SummaryCard icon={Check} label="Déjà payé" value={money(paidTotal)} tint="#15803D" bg="#DCFCE7" />
        <SummaryCard icon={Wallet} label="Demandes" value={String(rows.length)} tint="#0D0870" bg="#EEF0FB" />
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "requested", "processing", "paid", "rejected"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className="rounded-full px-3.5 py-1.5 text-xs"
            style={{
              background: filter === k ? "#0D0870" : "#F3F3F5",
              color: filter === k ? "#fff" : "#888780",
              fontWeight: 600,
            }}
          >
            {k === "all" ? "Tous" : STATUS_STYLE[k].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: "#888780" }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white py-16 text-center">
          <Banknote size={28} className="mx-auto mb-2" style={{ color: "#B0B0B0" }} />
          <p className="text-sm" style={{ color: "#888780" }}>Aucune demande de retrait</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white overflow-hidden" style={{ border: "1px solid #EFEFF2" }}>
          {/* Table scrolls inside its own box so the page never swipes sideways. */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ background: "#FAFAFC", color: "#888780" }}>
                  <Th>Professionnel</Th>
                  <Th>Montant</Th>
                  <Th>Méthode</Th>
                  <Th>Statut</Th>
                  <Th>Demandé le</Th>
                  <Th right>Action</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const s = STATUS_STYLE[r.status];
                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid #F0F0F3" }}>
                      <Td><span style={{ fontWeight: 600, color: "#1A1A1A" }}>{r.pro_name}</span></Td>
                      <Td><span style={{ fontWeight: 700, color: "#0D0870" }}>{money(Number(r.amount_mad))}</span></Td>
                      <Td><span style={{ color: "#888780", textTransform: "capitalize" }}>{r.method ?? "bank"}</span></Td>
                      <Td>
                        <span className="inline-flex rounded-full px-2.5 py-1 text-xs" style={{ background: s.bg, color: s.fg, fontWeight: 600 }}>
                          {s.label}
                        </span>
                      </Td>
                      <Td><span style={{ color: "#888780" }}>{fmtDate(r.created_at)}</span></Td>
                      <Td right>
                        <div className="flex justify-end gap-2">
                          {r.status === "requested" && (
                            <>
                              <RowBtn disabled={busyId === r.id} onClick={() => setStatus(r.id, "processing")} bg="#0D0870" fg="#fff">
                                Traiter
                              </RowBtn>
                              <RowBtn disabled={busyId === r.id} onClick={() => setStatus(r.id, "rejected")} bg="#FDE8E8" fg="#B91C1C">
                                <X size={14} />
                              </RowBtn>
                            </>
                          )}
                          {r.status === "processing" && (
                            <RowBtn disabled={busyId === r.id} onClick={() => setStatus(r.id, "paid")} bg="#DCFCE7" fg="#15803D">
                              <Check size={14} /> Marquer payé
                            </RowBtn>
                          )}
                          {(r.status === "paid" || r.status === "rejected") && (
                            <span className="text-xs" style={{ color: "#B0B0B0" }}>
                              {r.processed_at ? fmtDate(r.processed_at) : "—"}
                            </span>
                          )}
                        </div>
                      </Td>
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

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className="px-4 py-3 text-xs" style={{ textAlign: right ? "right" : "left", fontWeight: 600, whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className="px-4 py-3" style={{ textAlign: right ? "right" : "left", whiteSpace: "nowrap" }}>{children}</td>;
}
function RowBtn({ children, onClick, disabled, bg, fg }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; bg: string; fg: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
      style={{ background: bg, color: fg, fontWeight: 600, opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}
