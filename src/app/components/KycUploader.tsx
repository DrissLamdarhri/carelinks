/**
 * KycUploader — pro uploads diploma / license / ID to Supabase Storage,
 * inserts a pro_documents row. Admin moderation flips is_verified later.
 *
 * Storage bucket: 'pro-documents' (private). Run once in Supabase SQL Editor:
 *   insert into storage.buckets (id, name, public) values ('pro-documents','pro-documents', false)
 *   on conflict do nothing;
 */
import { useEffect, useState } from "react";
import { Upload, FileText, CheckCircle2, Clock, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth-context";
import { db } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import type { ProDocument } from "../../lib/db";

const DOC_TYPES = [
  { key: "diploma", label: "Diplôme" },
  { key: "license", label: "Licence professionnelle" },
  { key: "id",      label: "Pièce d'identité" },
] as const;

export function KycUploader() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<ProDocument[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) return;
    const list = await db.proDocuments.listForPro(user.id);
    setDocs(list);
  };

  useEffect(() => { refresh(); }, [user?.id]);

  const handleUpload = async (docType: string, file: File) => {
    if (!user) return;
    setUploading(docType);
    try {
      const path = `${user.id}/${docType}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("pro-documents").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      await db.proDocuments.create({ professional_id: user.id, doc_type: docType, storage_path: path });
      toast.success("Document envoyé. En attente de vérification.");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Échec de l'envoi");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <p className="text-[13px] text-[#888780]">
        Téléversez vos documents pour validation par notre équipe.
      </p>
      {DOC_TYPES.map(({ key, label }) => {
        const existing = docs.find((d) => d.doc_type === key);
        return (
          <div key={key} className="bg-white rounded-2xl p-3.5 border border-[#EDE5CC]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#5BB8D4]/15 flex items-center justify-center">
                <FileText size={18} className="text-[#0D0870]" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>{label}</p>
                {existing ? (
                  <p className={`text-[11px] flex items-center gap-1 mt-0.5 ${existing.is_verified ? "text-[#0D0870]" : "text-[#F5B544]"}`}>
                    {existing.is_verified ? <><CheckCircle2 size={11} />Vérifié</> : <><Clock size={11} />En cours d'examen</>}
                  </p>
                ) : (
                  <p className="text-[11px] text-[#888780]">Aucun document</p>
                )}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(key, e.target.files[0])} />
                <span className="inline-flex items-center gap-1.5 px-3 h-9 bg-[#0D0870] text-white text-[12px] rounded-xl" style={{ fontWeight: 600 }}>
                  {uploading === key ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {existing ? "Remplacer" : "Téléverser"}
                </span>
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
