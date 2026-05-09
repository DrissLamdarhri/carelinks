/**
 * KycModerationQueue — admin desktop view to approve/reject pro documents
 * and flip professionals.verification_status.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, FileText, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";

interface PendingPro {
  id: string;
  full_name: string | null;
  specialty: string;
  city: string | null;
  documents: { id: string; doc_type: string; storage_path: string; is_verified: boolean }[];
}

export function KycModerationQueue() {
  const [pros, setPros] = useState<PendingPro[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("professionals")
      .select("id, specialty, city, profiles!professionals_id_fkey(full_name), pro_documents(id,doc_type,storage_path,is_verified)")
      .eq("verification_status", "pending");
    if (error) toast.error(error.message);
    setPros((data ?? []).map((p: any) => ({
      id: p.id, full_name: p.profiles?.full_name ?? null,
      specialty: p.specialty, city: p.city,
      documents: p.pro_documents ?? [],
    })));
    setLoading(false);
  };

  useEffect(() => { fetchQueue(); }, []);

  const signedUrl = async (path: string) => {
    const { data } = await supabase.storage.from("pro-documents").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const decide = async (proId: string, status: "approved" | "rejected") => {
    setWorking(proId);
    try {
      await supabase.from("professionals").update({ verification_status: status }).eq("id", proId);
      if (status === "approved") {
        await supabase.from("pro_documents").update({ is_verified: true }).eq("professional_id", proId);
      }
      await supabase.from("notifications").insert({
        user_id: proId,
        kind: "system",
        title: status === "approved" ? "Compte approuvé" : "Compte rejeté",
        body: status === "approved"
          ? "Votre dossier a été validé. Vous pouvez recevoir des demandes."
          : "Votre dossier nécessite des corrections.",
        payload: {},
      });
      toast.success(status === "approved" ? "Pro approuvé" : "Pro rejeté");
      fetchQueue();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setWorking(null);
    }
  };

  if (loading)
    return <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#0D0870]" /></div>;

  if (!pros.length)
    return <p className="text-center text-[14px] text-[#888780] py-10">Aucun dossier en attente</p>;

  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {pros.map((p) => (
        <div key={p.id} className="bg-white rounded-2xl p-5 border border-[#EDE5CC]">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[16px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>{p.full_name ?? p.id.slice(0, 8)}</p>
              <p className="text-[12px] text-[#888780]">{p.specialty} · {p.city ?? "—"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => decide(p.id, "rejected")} disabled={working === p.id}
                className="px-4 h-10 rounded-xl border-2 border-[#E24B4A] text-[#E24B4A] text-[13px] flex items-center gap-1.5"
                style={{ fontWeight: 600 }}>
                <XCircle size={14} />Rejeter
              </button>
              <button onClick={() => decide(p.id, "approved")} disabled={working === p.id}
                className="px-4 h-10 rounded-xl bg-[#0D0870] text-white text-[13px] flex items-center gap-1.5"
                style={{ fontWeight: 600 }}>
                {working === p.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Approuver
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.documents.length === 0 && <p className="text-[12px] text-[#888780]">Aucun document</p>}
            {p.documents.map((d) => (
              <button key={d.id} onClick={() => signedUrl(d.storage_path)}
                className="inline-flex items-center gap-1.5 px-3 h-8 bg-[#F3F3F5] rounded-xl text-[12px] hover:bg-[#EDE5CC]">
                <FileText size={12} />{d.doc_type}<ExternalLink size={11} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}