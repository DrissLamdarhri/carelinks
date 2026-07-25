import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { BadgeCheck, Check, Eye, RefreshCw, ShieldQuestion, X } from "lucide-react";

// Admin review for patient identity (CIN) — migration 0030.
// A patient must be verified before their first booking, because a professional
// physically enters their home. They submit a CIN number + photo (private
// bucket); this screen is where an admin actually approves or rejects it.
//
// Privacy: the photo lives in the private `patient-ids` bucket. We never render
// a public URL — we mint a short-lived signed URL on demand, only for admins.

type IdStatus = "unverified" | "pending" | "approved" | "rejected";

type Row = {
  id: string;
  cin_number: string | null;
  cin_photo_path: string | null;
  id_status: IdStatus;
  id_submitted_at: string | null;
  id_rejection_reason: string | null;
  name: string;
  phone: string | null;
  city: string | null;
};

const STATUS_STYLE: Record<IdStatus, { bg: string; fg: string; label: string }> = {
  unverified: { bg: "#F1F1F1", fg: "#6B7280", label: "Non vérifié" },
  pending: { bg: "#FFF7E6", fg: "#B45309", label: "À vérifier" },
  approved: { bg: "#DCFCE7", fg: "#15803D", label: "Vérifié" },
  rejected: { bg: "#FDE8E8", fg: "#B91C1C", label: "Rejeté" },
};

export function PatientIdentityManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<IdStatus | "all">("pending");

  const load = async () => {
    setLoading(true);
    try {
      const { data: patients, error } = await supabase
        .from("patients")
        .select("id, cin_number, cin_photo_path, id_status, id_submitted_at, id_rejection_reason")
        .neq("id_status", "unverified")
        .order("id_submitted_at", { ascending: false, nullsFirst: false });
      if (error) throw error;

      const ids = (patients ?? []).map((p: any) => p.id);
      const info = new Map<string, { name: string; phone: string | null; city: string | null }>();
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone, city")
          .in("id", ids);
        for (const p of profiles ?? []) {
          info.set(p.id as string, {
            name: (p.full_name as string) || "—",
            phone: (p.phone as string) ?? null,
            city: (p.city as string) ?? null,
          });
        }
      }
      setRows(
        (patients ?? []).map((p: any) => ({
          ...p,
          name: info.get(p.id)?.name ?? "—",
          phone: info.get(p.id)?.phone ?? null,
          city: info.get(p.id)?.city ?? null,
        })),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement des vérifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const sub = supabase
      .channel("patient_ids_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Short-lived signed URL — the bucket is private on purpose.
  const openPhoto = async (path: string | null) => {
    if (!path) {
      toast.error("Aucune photo envoyée");
      return;
    }
    const { data, error } = await supabase.storage.from("patient-ids").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Impossible d'ouvrir la photo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const decide = async (id: string, status: "approved" | "rejected") => {
    let reason: string | null = null;
    if (status === "rejected") {
      reason = window.prompt("Motif du rejet (visible par le patient) :", "Document illisible. Merci d'envoyer une photo plus nette.");
      if (reason === null) return; // cancelled
    }
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("patients")
        .update({
          id_status: status,
          id_verified_at: new Date().toISOString(),
          id_rejection_reason: status === "rejected" ? reason : null,
        })
        .eq("id", id);
      if (error) throw error;

      // Tell the patient in-app. Best-effort: never fail the decision on this.
      await supabase.from("notifications").insert({
        user_id: id,
        kind: "system",
        title: status === "approved" ? "Identité vérifiée ✅" : "Pièce d'identité à renvoyer",
        body:
          status === "approved"
            ? "Votre identité est confirmée. Vous pouvez maintenant réserver un professionnel."
            : reason || "Votre document n'a pas pu être validé. Merci d'en envoyer un plus net.",
        payload: { id_status: status },
      });

      toast.success(status === "approved" ? "Patient vérifié" : "Document rejeté");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, id_status: status, id_rejection_reason: reason } : r)));
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de mettre à jour");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.id_status === filter)), [rows, filter]);
  const pendingCount = useMemo(() => rows.filter((r) => r.id_status === "pending").length, [rows]);
  const approvedCount = useMemo(() => rows.filter((r) => r.id_status === "approved").length, [rows]);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl" style={{ fontWeight: 700, color: "#1A1A1A" }}>Identités patients</h2>
          <p className="text-sm" style={{ color: "#888780" }}>
            Vérification CIN — obligatoire avant la première réservation
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ background: "#F4F3F8", color: "#0D0870", fontWeight: 600 }}
        >
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl p-4" style={{ background: "#FFF7E6" }}>
          <div className="flex items-center gap-2" style={{ color: "#B45309" }}>
            <ShieldQuestion size={16} />
            <span className="text-sm" style={{ fontWeight: 600 }}>En attente de vérification</span>
          </div>
          <div className="text-2xl mt-1" style={{ fontWeight: 700, color: "#B45309" }}>{pendingCount}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: "#DCFCE7" }}>
          <div className="flex items-center gap-2" style={{ color: "#15803D" }}>
            <BadgeCheck size={16} />
            <span className="text-sm" style={{ fontWeight: 600 }}>Patients vérifiés</span>
          </div>
          <div className="text-2xl mt-1" style={{ fontWeight: 700, color: "#15803D" }}>{approvedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["pending", "approved", "rejected", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: filter === k ? "#0D0870" : "#F4F3F8",
              color: filter === k ? "white" : "#555",
              fontWeight: 600,
            }}
          >
            {k === "all" ? "Tous" : STATUS_STYLE[k].label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#EEE" }}>
        <table className="w-full text-sm" style={{ minWidth: 760 }}>
          <thead>
            <tr style={{ background: "#FAFAF8", color: "#888780" }}>
              <th className="text-left px-4 py-3" style={{ fontWeight: 600 }}>Patient</th>
              <th className="text-left px-4 py-3" style={{ fontWeight: 600 }}>CIN</th>
              <th className="text-left px-4 py-3" style={{ fontWeight: 600 }}>Envoyé le</th>
              <th className="text-left px-4 py-3" style={{ fontWeight: 600 }}>Statut</th>
              <th className="text-right px-4 py-3" style={{ fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: "#888780" }}>Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: "#888780" }}>Aucune demande</td></tr>
            ) : (
              filtered.map((r) => {
                const st = STATUS_STYLE[r.id_status];
                return (
                  <tr key={r.id} className="border-t" style={{ borderColor: "#F0F0F0" }}>
                    <td className="px-4 py-3">
                      <div style={{ fontWeight: 600, color: "#1A1A1A" }}>{r.name}</div>
                      <div style={{ color: "#888780", fontSize: 12 }}>
                        {[r.phone, r.city].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "monospace", letterSpacing: 0.5 }}>
                      {r.cin_number ?? "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#555" }}>{fmtDate(r.id_submitted_at)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-md text-xs" style={{ background: st.bg, color: st.fg, fontWeight: 700 }}>
                        {st.label}
                      </span>
                      {r.id_status === "rejected" && r.id_rejection_reason ? (
                        <div style={{ color: "#B91C1C", fontSize: 11, marginTop: 4, maxWidth: 220 }}>{r.id_rejection_reason}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => void openPhoto(r.cin_photo_path)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                          style={{ background: "#F4F3F8", color: "#0D0870", fontWeight: 600 }}
                        >
                          <Eye size={13} /> Voir la CIN
                        </button>
                        {r.id_status !== "approved" && (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => void decide(r.id, "approved")}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-50"
                            style={{ background: "#DCFCE7", color: "#15803D", fontWeight: 700 }}
                          >
                            <Check size={13} /> Approuver
                          </button>
                        )}
                        {r.id_status !== "rejected" && (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => void decide(r.id, "rejected")}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-50"
                            style={{ background: "#FDE8E8", color: "#B91C1C", fontWeight: 700 }}
                          >
                            <X size={13} /> Rejeter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-4" style={{ color: "#888780", lineHeight: 1.6 }}>
        <strong>Confidentialité :</strong> la photo de CIN est stockée dans un bucket privé. Seuls les
        administrateurs peuvent l'ouvrir (lien signé valable 60 secondes). Les professionnels ne voient
        jamais le numéro ni la photo — uniquement un badge « identité vérifiée ».
      </p>
    </div>
  );
}
