import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { confirmDialog } from "../../lib/admin-dialog";
import { toast } from "sonner";
import {
  Check, X, Eye, Clock, AlertCircle, CheckCircle2, XCircle,
  Mail, MapPin, Phone, Award, Filter, Download, Search, UserX, ExternalLink, FileText, ScanText, AlertTriangle, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import {
  approvePro, rejectPro, getProDocumentsAdmin, getAdminSignedUrl, notifyProStatus,
  getKycOcr, saveKycOcr,
} from "../../lib/api";
import { createKycOcrSession, BROWSER_OCR_MODEL } from "../../lib/browserOcr";
import {
  crossCheckKyc, docKind, ocrState, needsAnalysis, CROSS_CHECK_DISCLAIMER,
  type KycOcrRow, type KycDocument, type CheckItem, type CrossCheckResult, type OcrStatus,
} from "../../lib/kycCrossCheck";
import { useAuth } from "../../lib/auth-context";

type ProfessionalStatus = "pending" | "approved" | "rejected";
type Professional = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  specialty: "nurse" | "psychologist" | "yoga_instructor" | "physiotherapist";
  verification_status: ProfessionalStatus;
  verified_at: string | null;
  rejection_reason: string | null;
  bio: string | null;
  years_experience: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  avatar_url: string | null;
};

export function ProfessionalsManager() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ProfessionalStatus | "all">("all");
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [proDocuments, setProDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  // OCR state (pro_document_ocr rows) for every listed pro, kept live by
  // Realtime — feeds both the table's verdict column and the details modal.
  const [ocrRows, setOcrRows] = useState<Record<string, KycOcrRow>>({});
  const [docsByPro, setDocsByPro] = useState<Record<string, KycDocument[]>>({});
  // Documents whose analysis this admin just requested (call in flight)
  const [requesting, setRequesting] = useState<string[]>([]);
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [experienceFilter, setExperienceFilter] = useState<string>("all");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  useEffect(() => {
    loadProfessionals();
    
    // Subscribe to real-time changes on professionals table
    const subscription = supabase
      .channel('professionals_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'professionals' },
        (payload: any) => {
          console.log('Professional updated:', payload.new);
          // Update selected pro if it's the one being updated
          if (selectedPro && payload.new.id === selectedPro.id) {
            const updatedPro = {
              ...selectedPro,
              verification_status: payload.new.verification_status,
              rejection_reason: payload.new.rejection_reason,
            };
            setSelectedPro(updatedPro);
          }
          // Refresh professionals list when status changes
          loadProfessionals();
        }
      )
      .subscribe();

    // Fallback: Listen to CustomEvent from AdminPanel for immediate UI updates
    const handleProStatusChanged = (event: any) => {
      console.log('CustomEvent pro-status-changed received:', event.detail);
      const { id, status } = event.detail;
      
      // Update professionals list optimistically
      setProfessionals((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, verification_status: status } : p
        )
      );
      
      // Update selected professional if it's the one changed
      if (selectedPro && selectedPro.id === id) {
        setSelectedPro((s) => s ? { ...s, verification_status: status } : s);
      }
      
      // Refresh in background after a short delay
      setTimeout(() => loadProfessionals(), 500);
    };
    
    window.addEventListener('pro-status-changed', handleProStatusChanged);

    // OCR progress (pending → processing → done | error), pushed by Realtime.
    // RLS on pro_document_ocr means only admins receive these.
    const ocrChannel = supabase
      .channel('pro_document_ocr_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pro_document_ocr' },
        (payload: any) => {
          if (payload.new?.document_id) mergeOcr([payload.new as KycOcrRow]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      void supabase.removeChannel(ocrChannel);
      window.removeEventListener('pro-status-changed', handleProStatusChanged);
    };
  }, [filter, specialtyFilter, experienceFilter, selectedCities]);

  const loadProfessionals = async () => {
    try {
      setLoading(true);

      // Step 1: Get professionals
      let prosQuery = supabase
        .from("professionals")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        prosQuery = prosQuery.eq("verification_status", filter);
      }

      if (specialtyFilter && specialtyFilter !== "all") {
        prosQuery = prosQuery.eq("specialty", specialtyFilter);
      }

      const { data: prosData, error: prosError } = await prosQuery;

      if (prosError) {
        console.error("Error fetching professionals:", prosError);
        throw prosError;
      }

      if (!prosData || prosData.length === 0) {
        console.log("No professionals found");
        setProfessionals([]);
        setLoading(false);
        return;
      }

      // Step 2: Get profiles for these professionals
      const prosIds = prosData.map((p: any) => p.id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, city, avatar_url")
        .in("id", prosIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      // Step 3: Merge data
      const profilesMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      const formatted = prosData.map((pro: any) => {
        const profile = profilesMap.get(pro.id) || {};
        return {
          ...pro,
          full_name: profile.full_name || "Unknown",
          email: profile.email || "N/A",
          phone: profile.phone || "N/A",
          city: profile.city || "N/A",
          avatar_url: profile.avatar_url,
        };
      });

      console.log("Loaded professionals:", formatted.length);
      setProfessionals(formatted);

      // Documents + OCR for every listed pro → cross-check verdict column.
      // Best-effort: the list still works if these fail.
      try {
        const [docsRes, rows] = await Promise.all([
          supabase.from("pro_documents").select("id,doc_type,professional_id")
            .in("professional_id", prosIds).order("uploaded_at", { ascending: false }),
          getKycOcr(prosIds),
        ]);
        if (docsRes.error) throw docsRes.error;
        const byPro: Record<string, KycDocument[]> = {};
        for (const d of docsRes.data ?? []) (byPro[d.professional_id] ??= []).push(d);
        setDocsByPro(byPro);
        setOcrRows(Object.fromEntries(rows.map((r) => [r.document_id, r])));
      } catch (e) {
        console.warn("Could not load verification data:", e);
      }
    } catch (error: any) {
      console.error("Error loading professionals:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        status: error?.status,
      });
      toast.error("Erreur lors du chargement des professionnels");
    } finally {
      setLoading(false);
    }
  };

  const { isAdminAuthed } = useAuth();

  const loadProDocuments = async (proId: string) => {
    setDocsLoading(true);
    try {
      // If the admin UI flag is set, prefer the admin API (service-role) first — avoids RLS filtering
      if (isAdminAuthed) {
        try {
          const res = await getProDocumentsAdmin(proId);
          if (res?.documents && res.documents.length > 0) {
            setProDocuments(res.documents);
            return;
          }
        } catch (adminErr) {
          console.warn("Admin API pro documents error (falling back to client):", adminErr);
        }
      }

      const { data, error } = await supabase
        .from("pro_documents")
        .select("id,doc_type,storage_path,is_verified,uploaded_at")
        .eq("professional_id", proId)
        .order("uploaded_at", { ascending: false });

      console.log(`📄 Loaded pro_documents for ${proId}: ${data?.length ?? 0} rows`, { data });

      if (error) {
        console.warn("Error fetching pro documents via RLS:", error);
        // Try admin API fallback
        try {
          const res = await getProDocumentsAdmin(proId);
          console.log(`📄 Admin API fallback: ${res.documents?.length ?? 0} documents`);
          setProDocuments(res.documents ?? []);
          return;
        } catch (apiErr) {
          console.error("Admin API pro documents error:", apiErr);
          setProDocuments([]);
          return;
        }
      }

      if (!data || data.length === 0) {
        console.warn(`⚠️  No documents found for ${proId}. Trying admin API...`);
        // Fallback in case RLS filtered results
        try {
          const res = await getProDocumentsAdmin(proId);
          console.log(`📄 Admin API fallback: ${res.documents?.length ?? 0} documents`);
          if (res.documents && res.documents.length > 0) {
            setProDocuments(res.documents);
            return;
          }
        } catch (apiErr) {
          console.error("Admin API pro documents error:", apiErr);
        }
      }

      setProDocuments(data ?? []);
    } catch (e: any) {
      console.error("Error loading pro documents:", e);
      console.error("Pro documents error details:", {
        message: e?.message ?? String(e),
        code: e?.code ?? null,
        status: e?.status ?? null,
        stack: e?.stack ?? null,
      });
      try {
        const res = await getProDocumentsAdmin(proId);
        setProDocuments(res.documents ?? []);
      } catch (fallbackErr) {
        console.error("Fallback admin API failed:", fallbackErr);
        setProDocuments([]);
      }
    } finally {
      setDocsLoading(false);
    }
  };

  // Rows arrive from the initial load, Realtime, polling and our own calls, in
  // any order — keep the most recently requested/finished version of each.
  const mergeOcr = (rows: KycOcrRow[]) =>
    setOcrRows((prev) => {
      const next = { ...prev };
      const stamp = (r?: KycOcrRow) => (r ? Math.max(Date.parse(r.requested_at), r.ocr_at ? Date.parse(r.ocr_at) : 0) : -1);
      for (const r of rows) if (stamp(r) >= stamp(next[r.document_id])) next[r.document_id] = r;
      return next;
    });

  const analysable = (docs: KycDocument[]) => docs.filter((d) => docKind(d.doc_type));

  /**
   * Read documents with Tesseract in this browser (free, nothing sent to a
   * third party), one at a time with a single worker, and save each result.
   */
  const analyzeDocuments = async (docs: (KycDocument & { storage_path: string })[], proId: string) => {
    const targets = analysable(docs).filter((d) => !requesting.includes(d.id)) as typeof docs;
    if (!targets.length) return [] as KycOcrRow[];
    const ids = targets.map((d) => d.id);
    const started = new Date().toISOString();
    const base = (d: KycDocument): KycOcrRow =>
      ocrRows[d.id] ?? { document_id: d.id, professional_id: proId, ocr_status: "pending", ocr_data: null, ocr_error: null, requested_at: started, ocr_at: null };
    setRequesting((p) => [...p, ...ids]);
    mergeOcr(targets.map((d) => ({ ...base(d), ocr_status: "processing", ocr_error: null, requested_at: started })));

    const results: KycOcrRow[] = [];
    let saveWarned = false;
    const finish = async (row: KycOcrRow) => {
      mergeOcr([row]);
      results.push(row);
      try {
        mergeOcr([await saveKycOcr(row)]);
      } catch (e: any) {
        if (!saveWarned) toast.warning(e?.message ?? "Résultat OCR non enregistré");
        saveWarned = true;
      }
    };

    try {
      let session: Awaited<ReturnType<typeof createKycOcrSession>>;
      try {
        session = await createKycOcrSession();
      } catch (e: any) {
        const now = new Date().toISOString();
        for (const d of targets) {
          await finish({ ...base(d), ocr_status: "error", ocr_model: BROWSER_OCR_MODEL, requested_at: started, ocr_at: now,
            ocr_error: `Moteur OCR indisponible (connexion internet requise au premier lancement) : ${e?.message ?? e}` });
        }
        return results;
      }
      try {
        for (const d of targets) {
          try {
            const data = await session.analyze(d);
            await finish({ document_id: d.id, professional_id: proId, ocr_status: "done", ocr_data: data, ocr_error: null,
              ocr_model: BROWSER_OCR_MODEL, requested_at: started, ocr_at: new Date().toISOString() });
          } catch (e: any) {
            console.error(`[browserOcr] ${d.id} (${d.doc_type}) failed:`, e);
            await finish({ ...base(d), ocr_status: "error", ocr_error: e?.message ?? String(e),
              ocr_model: BROWSER_OCR_MODEL, requested_at: started, ocr_at: new Date().toISOString() });
          }
          setRequesting((p) => p.filter((id) => id !== d.id));
        }
      } finally {
        await session.terminate();
      }
      return results;
    } finally {
      setRequesting((p) => p.filter((id) => !ids.includes(id)));
    }
  };

  const openDetailsModal = async (pro: Professional) => {
    setSelectedPro(pro);
    setShowDetailsModal(true);
    // Documents + the OCR already saved
    const [rows] = await Promise.all([
      getKycOcr([pro.id]).catch((e) => {
        console.warn("Could not load OCR results:", e);
        return [] as KycOcrRow[];
      }),
      loadProDocuments(pro.id),
    ]);
    mergeOcr(rows);

    // Analysis is automatic: read whatever is waiting ('pending' from the
    // upload trigger, never analysed, stuck, or failed under the old paid path).
    try {
      const { documents } = await getProDocumentsAdmin(pro.id);
      const byId = Object.fromEntries(rows.map((r) => [r.document_id, r]));
      const missing = analysable(documents).filter((d) => needsAnalysis(byId[d.id]));
      if (missing.length) await analyzeDocuments(missing as any, pro.id);
    } catch (e) {
      console.warn("Automatic OCR failed:", e);
    }
  };

  // "Relancer l'analyse" — one document, or all of them (e.g. after the pro
  // replaced a blurry photo)
  const rerunAnalysis = async (docs: (KycDocument & { storage_path: string })[]) => {
    if (!selectedPro) return;
    const results = await analyzeDocuments(docs, selectedPro.id);
    if (!results.length) return;
    const failed = results.filter((r) => r.ocr_status === "error").length;
    if (!failed) toast.success("Analyse terminée");
    else if (failed === results.length) toast.error("L'analyse a échoué — voir le détail sous le document");
    else toast.warning(`${results.length - failed}/${results.length} document(s) analysé(s)`);
  };

  // Polling fallback (3 s) while a document of the open file is being analysed
  // elsewhere (another admin) — covers a project without Realtime on the table.
  const waitingForOcr = !!selectedPro && showDetailsModal && analysable(proDocuments).some(
    (d) => ocrState(ocrRows[d.id]) === "processing" && !requesting.includes(d.id),
  );
  useEffect(() => {
    if (!waitingForOcr || !selectedPro) return;
    const id = window.setInterval(() => {
      getKycOcr([selectedPro.id]).then(mergeOcr).catch((e) => console.warn("OCR polling failed:", e));
    }, 3000);
    return () => window.clearInterval(id);
  }, [waitingForOcr, selectedPro?.id]);

  const crossCheckFor = (pro: Professional, documents: KycDocument[] | undefined) =>
    crossCheckKyc({ fullName: pro.full_name, specialty: pro.specialty, documents: documents ?? [], ocrByDoc: ocrRows });

  const handleApprovePro = async (pro?: Professional) => {
    const target = pro || selectedPro;
    if (!target) return;
    setActionLoading(true);
    
    // Save previous state for rollback if needed
    const previousProfessionals = professionals;
    
    try {
      // OPTIMISTIC UPDATE: Immediately update local state
      setProfessionals((prevPros) =>
        prevPros.map((p) =>
          p.id === target.id
            ? { ...p, verification_status: "approved" as ProfessionalStatus, verified_at: new Date().toISOString() }
            : p
        )
      );

      // Update the selected pro in the modal too
      if (selectedPro?.id === target.id) {
        setSelectedPro((s) =>
          s ? { ...s, verification_status: "approved", verified_at: new Date().toISOString() } : s
        );
      }

      const nowIso = new Date().toISOString();
      
      // Update database with proper error handling
      const { error } = await supabase
        .from("professionals")
        .update({
          verification_status: "approved",
          verified_at: nowIso,
        })
        .eq("id", target.id);

      if (error) {
        throw error; // Fail fast - don't use fallback silently
      }

      // Show success immediately (optimistic update succeeded and DB update confirmed)
      toast.success(`${target.full_name} a été approuvé(e)`);

      // Send notification (non-blocking)
      try {
        await supabase.from('notifications').insert({
          user_id: target.id,
          kind: 'approval',
          title: 'Compte approuvé',
          body: 'Votre compte professionnel a été approuvé! Vous pouvez maintenant recevoir des demandes.',
        });
        try { await sendApprovalNotification(target); } catch (e) { console.warn('Notification failed', e); }
      } catch (e) {
        console.warn('Failed to send approval notification', e);
      }

      // Refresh in background after a longer delay to allow DB replication
      // 500ms minimum to ensure all replicas are updated before refetch
      setTimeout(() => loadProfessionals(), 500);
      
      // Clear modals
      setShowDetailsModal(false);
      setSelectedPro(null);
    } catch (error) {
      // ROLLBACK: Revert to previous state if update fails
      setProfessionals(previousProfessionals);
      if (selectedPro?.id === target.id) {
        setSelectedPro((s) => s ? { ...s, verification_status: "pending" } : s);
      }
      
      console.error("Error approving professional:", error);
      toast.error("Erreur lors de l'approbation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPro = async () => {
    if (!selectedPro || !rejectReason.trim()) {
      toast.error("Veuillez entrer un motif de rejet");
      return;
    }
    setActionLoading(true);
    
    // Save previous state for rollback if needed
    const previousProfessionals = professionals;
    
    try {
      // OPTIMISTIC UPDATE: Immediately update local state
      setProfessionals((prevPros) =>
        prevPros.map((p) =>
          p.id === selectedPro.id
            ? { ...p, verification_status: "rejected" as ProfessionalStatus, rejection_reason: rejectReason }
            : p
        )
      );

      // Update the selected pro in the modal too
      setSelectedPro((s) =>
        s ? { ...s, verification_status: "rejected", rejection_reason: rejectReason } : s
      );

      // Update database with proper error handling
      const { error } = await supabase
        .from("professionals")
        .update({
          verification_status: "rejected",
          rejection_reason: rejectReason,
        })
        .eq("id", selectedPro.id);

      if (error) {
        throw error; // Fail fast - don't use fallback silently
      }

      // Show success immediately (optimistic update succeeded and DB update confirmed)
      toast.success(`${selectedPro.full_name} a été rejeté(e)`);

      // Send notification (non-blocking)
      try {
        await supabase.from('notifications').insert({
          user_id: selectedPro.id,
          kind: 'rejection',
          title: 'Compte rejeté',
          body: "Votre dossier a été rejeté. Veuillez consulter l'application pour plus d'informations.",
        });
        try { await sendRejectionNotification(selectedPro, rejectReason); } catch (e) { console.warn('Notification failed', e); }
      } catch (e) {
        console.warn('Failed to send rejection notification', e);
      }

      // Refresh in background after a longer delay to allow DB replication
      // 500ms minimum to ensure all replicas are updated before refetch
      setTimeout(() => loadProfessionals(), 500);

      // Clear modals
      setShowRejectModal(false);
      setShowDetailsModal(false);
      setRejectReason("");
      setSelectedPro(null);
    } catch (error) {
      // ROLLBACK: Revert to previous state if update fails
      setProfessionals(previousProfessionals);
      setSelectedPro((s) => s ? { ...s, verification_status: "pending" } : s);
      
      console.error("Error rejecting professional:", error);
      toast.error("Erreur lors du rejet");
    } finally {
      setActionLoading(false);
    }
  };

  const deletePro = async (proId: string) => {
    if (!(await confirmDialog({ title: "Supprimer ce professionnel ?", destructive: true, confirmText: "Supprimer" }))) return;
    try {
      await supabase.from("professionals").delete().eq("id", proId);
      setProfessionals((prev) => prev.filter((p) => p.id !== proId));
      toast.success("Professionnel supprimé");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  // Notify the pro (in-app + email + WhatsApp) — single server-side source of
  // truth (notify-pro-status edge function) so every admin screen behaves
  // identically. This replaced two direct, unauthenticated fetches to
  // send-approval-email / send-rejection-email: those functions took no auth
  // at all (anyone with the URL could trigger them), and weren't even
  // deployed to this project, so every call here was silently failing —
  // approving/rejecting from this screen never actually emailed anyone.
  const sendApprovalNotification = async (pro: Professional) => {
    try {
      await notifyProStatus(pro.id, "approved");
    } catch (error) {
      console.error("Error notifying pro of approval:", error);
    }
  };

  const sendRejectionNotification = async (pro: Professional, reason: string) => {
    try {
      await notifyProStatus(pro.id, "rejected", reason);
    } catch (error) {
      console.error("Error notifying pro of rejection:", error);
    }
  };

  const specialtyLabel = (spec: string) => {
    const map: Record<string, string> = {
      nurse: "Infirmier",
      psychologist: "Psychologue",
      yoga_instructor: "Instructeur Yoga",
      physiotherapist: "Kinésithérapeute",
    };
    return map[spec] || spec;
  };

  const statusBadge = (status: ProfessionalStatus) => {
    const styles: Record<ProfessionalStatus, { bg: string; color: string; icon: any }> = {
      pending: { bg: "#FEF3C7", color: "#D97706", icon: Clock },
      approved: { bg: "#DCFCE7", color: "#16A34A", icon: CheckCircle2 },
      rejected: { bg: "#FDE8E8", color: "#E24B4A", icon: XCircle },
    };
    const style = styles[status];
    const Icon = style.icon;
    const labels: Record<ProfessionalStatus, string> = {
      pending: "En attente",
      approved: "Approuvé",
      rejected: "Rejeté",
    };
    return (
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
        <Icon size={14} />
        {labels[status]}
      </div>
    );
  };

  const filtered = professionals.filter((p) => {
    // Apply search filter
    const matchesSearch =
      p.full_name.toLowerCase().includes(searchQ.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQ.toLowerCase());
    
    // Apply status filter
    const matchesStatus = filter === "all" || p.verification_status === filter;
    
    // Apply specialty filter
    const matchesSpecialty =
      specialtyFilter === "all" || !specialtyFilter || p.specialty === specialtyFilter;
    
    // Apply experience filter
    let matchesExperience = true;
    if (experienceFilter !== "all" && experienceFilter) {
      const years = p.years_experience || 0;
      if (experienceFilter === "0-5") {
        matchesExperience = years >= 0 && years <= 5;
      } else if (experienceFilter === "5-10") {
        matchesExperience = years > 5 && years <= 10;
      } else if (experienceFilter === "10+") {
        matchesExperience = years > 10;
      }
    }
    
    // Apply city filter
    const matchesCity = selectedCities.length === 0 || selectedCities.includes(p.city);
    
    return matchesSearch && matchesStatus && matchesSpecialty && matchesExperience && matchesCity;
  });

  // Get unique cities from professionals
  const availableCities = Array.from(
    new Set(professionals.map((p) => p.city).filter(Boolean))
  ).sort();


  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-[#888780]">{(professionals ?? []).length} professionnels inscrits</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#888780]" style={{ background: "#F3F3F5" }}>
            <Filter size={14} /> Filtrer
          </button>
          <button onClick={() => {}} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#888780]" style={{ background: "#F3F3F5" }}>
            <Download size={14} /> Exporter
          </button>
        </div>
      </div>

      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
      >
        <div className="p-4 border-b border-[#F0F0F0]">
          <div className="flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background: "#F3F3F5" }}>
            <Search size={15} className="text-[#888780]" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Rechercher un professionnel…"
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilterDropdown && (
          <div className="px-4 py-4 border-b border-[#F0F0F0] bg-[#FAFAFA]">
            <div className="grid grid-cols-3 gap-4">
              {/* Specialty Filter */}
              <div>
                <label className="block text-xs text-[#888780] mb-2" style={{ fontWeight: 500 }}>
                  Spécialité
                </label>
                <select
                  value={specialtyFilter}
                  onChange={(e) => setSpecialtyFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0E0E0] outline-none"
                >
                  <option value="all">Toutes les spécialités</option>
                  <option value="nurse">Infirmière</option>
                  <option value="psychologist">Psychologue</option>
                  <option value="physiotherapist">Kinésithérapeute</option>
                  <option value="yoga_instructor">Instructeur de Yoga</option>
                </select>
              </div>

              {/* Experience Filter */}
              <div>
                <label className="block text-xs text-[#888780] mb-2" style={{ fontWeight: 500 }}>
                  Expérience
                </label>
                <select
                  value={experienceFilter}
                  onChange={(e) => setExperienceFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0E0E0] outline-none"
                >
                  <option value="all">Toutes les expériences</option>
                  <option value="0-5">0-5 ans</option>
                  <option value="5-10">5-10 ans</option>
                  <option value="10+">10+ ans</option>
                </select>
              </div>

              {/* City Filter */}
              <div>
                <label className="block text-xs text-[#888780] mb-2" style={{ fontWeight: 500 }}>
                  Ville
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowCityDropdown(!showCityDropdown)}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0E0E0] text-left bg-white flex items-center justify-between"
                  >
                    <span className="text-[#888780]">
                      {selectedCities.length === 0
                        ? "Toutes les villes"
                        : `${selectedCities.length} ville${selectedCities.length !== 1 ? "s" : ""}`}
                    </span>
                    <span className="text-xs">▼</span>
                  </button>
                  {showCityDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E0E0E0] rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      <div className="p-2">
                        <button
                          onClick={() => setSelectedCities([])}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[#F3F3F5] rounded"
                        >
                          Toutes les villes
                        </button>
                        {availableCities.map((city) => (
                          <button
                            key={city}
                            onClick={() => {
                              setSelectedCities((prev) =>
                                prev.includes(city)
                                  ? prev.filter((c) => c !== city)
                                  : [...prev, city]
                              );
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-[#F3F3F5] rounded flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCities.includes(city)}
                              onChange={() => {}}
                              className="w-3 h-3"
                            />
                            {city}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 px-4 py-3 border-b border-[#F0F0F0] overflow-x-auto">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs border whitespace-nowrap transition-all"
              style={{
                background: filter === f ? "#0D0870" : "white",
                color: filter === f ? "white" : "#888780",
                borderColor: filter === f ? "#0D0870" : "#E0E0E0",
                fontWeight: filter === f ? 600 : 400,
              }}
            >
              {f === "all" ? "Tous" : f === "pending" ? "En attente" : f === "approved" ? "Approuvés" : "Rejetés"}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D0870] mx-auto mb-4"></div>
                <p className="text-[#888780]">Chargement...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <AlertCircle size={48} className="text-[#B0B0B0] mx-auto mb-4" />
                <p className="text-[#888780]">
                  {professionals.length === 0
                    ? "Aucun professionnel inscrit pour le moment"
                    : "Aucun professionnel trouvé"}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ background: "#F8F8FC" }}>
                  {["Professionnel", "Spécialité", "Email", "Ville", "Expérience", "Statut", "Vérification OCR", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs text-[#888780] px-5 py-3" style={{ fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((pro) => (
                  <tr key={pro.id} className="border-t border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                          style={{ background: "#0D0870", fontWeight: 700 }}
                        >
                          {pro.full_name.charAt(0)}
                        </div>
                        <span className="text-sm text-[#1A1A1A]" style={{ fontWeight: 500 }}>
                          {pro.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#888780]">
                      {specialtyLabel(pro.specialty)}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#888780]">{pro.email}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-sm text-[#888780]">
                        <MapPin size={13} /> {pro.city}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                      {pro.years_experience && pro.years_experience > 0 ? `${pro.years_experience} ans` : "—"}
                    </td>
                    <td className="px-5 py-4">
                      {pro.verification_status === "pending" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs" style={{ background: "#FEF3C7", color: "#D97706", fontWeight: 600 }}>
                          En attente
                        </span>
                      )}
                      {pro.verification_status === "approved" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs" style={{ background: "#DCFCE7", color: "#16A34A", fontWeight: 600 }}>
                          Approuvé
                        </span>
                      )}
                      {pro.verification_status === "rejected" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs" style={{ background: "#FDE8E8", color: "#E24B4A", fontWeight: 600 }}>
                          Rejeté
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => openDetailsModal(pro)} title="Voir la vérification croisée">
                        <VerdictBadge
                          hasDocs={analysable(docsByPro[pro.id] ?? []).length > 0}
                          result={crossCheckFor(pro, docsByPro[pro.id])}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        {pro.verification_status === "pending" && (
                          <>
                            <button
                              onClick={async () => {
                                if (crossCheckFor(pro, docsByPro[pro.id]).verdict === "fail" && !(await confirmDialog({
                                  title: "Approuver malgré les incohérences ?",
                                  description: `La vérification croisée de ${pro.full_name} a trouvé des informations qui ne concordent pas. Ouvrez « Voir détails » pour le détail.`,
                                  confirmText: "Approuver quand même",
                                  destructive: true,
                                }))) return;
                                setSelectedPro(pro);
                                handleApprovePro(pro);
                              }}
                              disabled={actionLoading}
                              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#DCFCE7] transition-colors disabled:opacity-50"
                              title="Approuver"
                            >
                              <Check size={15} className="text-[#16A34A]" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPro(pro);
                                setShowRejectModal(true);
                              }}
                              disabled={actionLoading}
                              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#FDE8E8] transition-colors disabled:opacity-50"
                              title="Rejeter"
                            >
                              <X size={15} className="text-[#E24B4A]" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openDetailsModal(pro)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F3F5] transition-colors"
                          title="Voir détails"
                        >
                          <Eye size={15} className="text-[#888780]" />
                        </button>
                        <button
                          onClick={() => deletePro(pro.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#FDE8E8] transition-colors"
                          title="Supprimer"
                        >
                          <UserX size={15} className="text-[#E24B4A]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDetailsModal && selectedPro && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white px-6 py-5 border-b border-[#F0F0F0] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                    style={{ background: "#0D0870", fontWeight: 700 }}
                  >
                    {selectedPro.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                      {selectedPro.full_name}
                    </p>
                    <p className="text-xs text-[#888780]">{specialtyLabel(selectedPro.specialty)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-[#888780] hover:text-[#1A1A1A] transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div style={{ background: "#F8F8FC", borderRadius: 16, padding: 16 }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#888780] mb-2" style={{ fontWeight: 600 }}>
                        Statut Actuel
                      </p>
                      {selectedPro.verification_status === "pending" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs" style={{ background: "#FEF3C7", color: "#D97706", fontWeight: 600 }}>
                          En attente
                        </span>
                      )}
                      {selectedPro.verification_status === "approved" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs" style={{ background: "#DCFCE7", color: "#16A34A", fontWeight: 600 }}>
                          Approuvé
                        </span>
                      )}
                      {selectedPro.verification_status === "rejected" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs" style={{ background: "#FDE8E8", color: "#E24B4A", fontWeight: 600 }}>
                          Rejeté
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#888780] mb-2" style={{ fontWeight: 600 }}>
                        Inscrit
                      </p>
                      <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                        {new Date(selectedPro.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedPro.rejection_reason && (
                  <div style={{ background: "#FDE8E8", borderRadius: 12, padding: 12, border: "1px solid #F5D6D6" }}>
                    <p className="text-xs text-[#E24B4A] mb-2" style={{ fontWeight: 600 }}>
                      Motif de Rejet
                    </p>
                    <p className="text-sm text-[#C24240]">{selectedPro.rejection_reason}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div style={{ background: "#F8F8FC", borderRadius: 12, padding: 12 }}>
                    <p className="text-xs text-[#888780] mb-1" style={{ fontWeight: 600 }}>
                      Email
                    </p>
                    <p className="text-sm text-[#1A1A1A]">{selectedPro.email}</p>
                  </div>
                  <div style={{ background: "#F8F8FC", borderRadius: 12, padding: 12 }}>
                    <p className="text-xs text-[#888780] mb-1" style={{ fontWeight: 600 }}>
                      Téléphone
                    </p>
                    <p className="text-sm text-[#1A1A1A]">{selectedPro.phone}</p>
                  </div>
                  <div style={{ background: "#F8F8FC", borderRadius: 12, padding: 12 }}>
                    <p className="text-xs text-[#888780] mb-1" style={{ fontWeight: 600 }}>
                      Ville
                    </p>
                    <p className="text-sm text-[#1A1A1A]">{selectedPro.city}</p>
                  </div>
                  <div style={{ background: "#F8F8FC", borderRadius: 12, padding: 12 }}>
                    <p className="text-xs text-[#888780] mb-1" style={{ fontWeight: 600 }}>
                      Expérience
                    </p>
                    <p className="text-sm text-[#1A1A1A]">{selectedPro.years_experience && selectedPro.years_experience > 0 ? `${selectedPro.years_experience} ans` : "—"}</p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-[#888780]" style={{ fontWeight: 600 }}>Documents</p>
                    {analysable(proDocuments).length > 0 && (
                      <button
                        onClick={() => rerunAnalysis(proDocuments)}
                        disabled={analysable(proDocuments).every((d: KycDocument) => requesting.includes(d.id))}
                        className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[11px] text-[#888780] hover:bg-[#F3F3F5] disabled:opacity-50"
                        title="Relire la CIN et le diplôme (ex. après un nouvel envoi)"
                      >
                        <ScanText size={12} /> Relancer l'analyse
                      </button>
                    )}
                  </div>
                  {!docsLoading && proDocuments.length > 0 && (
                    <CrossCheckCard result={crossCheckFor(selectedPro, proDocuments)} />
                  )}
                  {docsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0D0870]"></div>
                      <span className="ml-2 text-xs text-[#888780]">Chargement des documents...</span>
                    </div>
                  ) : proDocuments.length === 0 ? (
                    <div style={{ background: "#F8F8FC", borderRadius: 12, padding: 12 }}>
                      <p className="text-sm text-[#888780]">Aucun document téléchargé</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {proDocuments.map((d: any) => (
                        <div key={d.id} style={{ background: "#F8F8FC", borderRadius: 12, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>{d.doc_type}</p>
                            <p className="text-xs text-[#888780]">{new Date(d.uploaded_at).toLocaleDateString("fr-FR")}</p>
                          </div>
                          <button onClick={() => openProDocument(d.storage_path)} className="inline-flex items-center gap-1.5 px-3 h-8 bg-[#0D0870] text-white rounded-xl text-[12px] hover:opacity-90" style={{ fontWeight: 600 }}>
                            <FileText size={12} /> Ouvrir
                          </button>
                        </div>
                        {docKind(d.doc_type) && (
                          <OcrResult
                            row={ocrRows[d.id]}
                            busy={requesting.includes(d.id)}
                            onRetry={() => rerunAnalysis([d])}
                          />
                        )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div style={{ background: "#FFFBEA", borderRadius: 12, padding: 12, border: "1px solid #FEE5C3" }}>
                    <p className="text-xs text-[#B45309] mb-1" style={{ fontWeight: 600 }}>
                      Évaluation
                    </p>
                    <p className="text-lg text-[#92400E]" style={{ fontWeight: 700 }}>
                      {selectedPro.rating_avg.toFixed(1)} ⭐
                    </p>
                    <p className="text-xs text-[#B45309]">({selectedPro.rating_count} avis)</p>
                  </div>
                  <div style={{ background: "#F0F4FF", borderRadius: 12, padding: 12, border: "1px solid #D0DEFF" }}>
                    <p className="text-xs text-[#3B42C5] mb-1" style={{ fontWeight: 600 }}>
                      Statut Vérification
                    </p>
                    <p className="text-sm text-[#3B42C5]" style={{ fontWeight: 700, textTransform: "capitalize" }}>
                      {selectedPro.verification_status === "pending"
                        ? "En attente"
                        : selectedPro.verification_status === "approved"
                        ? "Approuvé"
                        : "Rejeté"}
                    </p>
                  </div>
                </div>

                {selectedPro.bio && (
                  <div>
                    <p className="text-xs text-[#888780] mb-2" style={{ fontWeight: 600 }}>
                      Biographie
                    </p>
                    <p className="text-sm text-[#1A1A1A]" style={{ background: "#F8F8FC", borderRadius: 12, padding: 12, lineHeight: 1.6 }}>
                      {selectedPro.bio}
                    </p>
                  </div>
                )}

                {selectedPro.verification_status === "pending" && (
                  <div className="flex gap-3 pt-4 border-t border-[#F0F0F0]">
                    <button
                      onClick={async () => {
                        // The cross-check is advisory, but approving over a red
                        // verdict should be a deliberate choice, not a misclick.
                        const { verdict } = crossCheckFor(selectedPro, proDocuments);
                        if (verdict === "fail" && !(await confirmDialog({
                          title: "Approuver malgré les incohérences ?",
                          description: "La vérification croisée a trouvé des informations qui ne concordent pas entre le profil, la CIN et le diplôme.",
                          confirmText: "Approuver quand même",
                          destructive: true,
                        }))) return;
                        handleApprovePro(selectedPro);
                      }}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      style={{ background: "#16A34A" }}
                    >
                      {actionLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          En cours...
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          Approuver
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      style={{ background: "#E24B4A" }}
                    >
                      <X size={16} />
                      Rejeter
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRejectModal && selectedPro && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <h3 className="text-lg text-[#1A1A1A] mb-2" style={{ fontWeight: 600 }}>
                  Motif de Rejet
                </h3>
                <p className="text-sm text-[#888780] mb-4">
                  Justifiez le rejet de la candidature de <span style={{ fontWeight: 600 }}>{selectedPro.full_name}</span>
                </p>

                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ex: Documents incomplets, informations incorrectes, expérience insuffisante..."
                  className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D0870] mb-4 text-sm"
                  style={{ color: "#1A1A1A" }}
                  rows={4}
                  autoFocus
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason("");
                    }}
                    className="flex-1 px-4 py-2.5 border border-[#E0E0E0] text-[#888780] rounded-lg text-sm font-semibold hover:bg-[#F3F3F5] transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleRejectPro}
                    disabled={actionLoading || !rejectReason.trim()}
                    className="flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: "#E24B4A" }}
                  >
                    {actionLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        En cours...
                      </>
                    ) : (
                      <>
                        <X size={16} />
                        Confirmer
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Open a KYC document ─────────────────────────────────────────────────────
// Downloaded through the admin's session (works whether or not the bucket is
// public) and re-typed from its first bytes: older uploads from the mobile
// sign-up were stored as image/jpeg even when they were PDFs, which made the
// browser show a blank page instead of the PDF.
function sniffType(bytes: Uint8Array): string {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
  return "application/octet-stream";
}

async function openProDocument(storagePath: string) {
  // Open the tab synchronously (inside the click) so popup blockers allow it,
  // then point it at the file once downloaded.
  const tab = window.open("", "_blank");
  try {
    const { data, error } = await supabase.storage.from("pro-documents").download(storagePath);
    if (error || !data) throw error ?? new Error("Document introuvable");
    const bytes = new Uint8Array(await data.slice(0, 16).arrayBuffer());
    const url = URL.createObjectURL(new Blob([data], { type: sniffType(bytes) }));
    if (tab) tab.location.href = url;
    else window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    console.error("Error opening doc:", e);
    toast.error("Erreur lors de l'ouverture du document");
  }
}

// ── OCR result for one document (CIN / diploma) ─────────────────────────────
const OCR_FIELDS: Record<"cin" | "diploma", [key: string, label: string][]> = {
  cin: [
    ["nom", "Nom"],
    ["prenom", "Prénom"],
    ["nom_complet", "Nom et prénom"],
    ["nom_arabe", "Nom (arabe)"],
    ["prenom_arabe", "Prénom (arabe)"],
    ["numero_cin", "N° CIN"],
    ["date_naissance", "Date de naissance"],
    ["lieu_naissance", "Lieu de naissance"],
    ["date_expiration", "Expiration"],
  ],
  diploma: [
    ["nom_titulaire", "Titulaire"],
    ["nom_titulaire_arabe", "Titulaire (arabe)"],
    ["intitule", "Intitulé"],
    ["etablissement", "Établissement"],
    ["annee", "Année"],
    ["numero_cin", "N° CIN"],
  ],
};

const OCR_STATE: Record<OcrStatus, { label: string; bg: string; color: string }> = {
  pending: { label: "En attente d'analyse", bg: "#F3F3F5", color: "#888780" },
  processing: { label: "Analyse en cours…", bg: "#EEF2FF", color: "#3B42C5" },
  done: { label: "Analysé", bg: "#DCFCE7", color: "#16A34A" },
  error: { label: "Échec de l'analyse", bg: "#FDE8E8", color: "#E24B4A" },
};

function OcrResult({ row, busy, onRetry }: { row?: KycOcrRow; busy: boolean; onRetry: () => void }) {
  const state = busy ? "processing" : ocrState(row);
  const s = OCR_STATE[state];
  const data = state === "done" ? row?.ocr_data : null;
  const fields = data ? OCR_FIELDS[data.kind].filter(([k]) => (data as Record<string, unknown>)[k]) : [];
  const when = row?.ocr_at && state !== "pending" && state !== "processing"
    ? new Date(row.ocr_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : null;
  return (
    <div className="mt-3 pt-3 border-t border-[#ECECF3] space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs" style={{ background: s.bg, color: s.color, fontWeight: 600 }}>
          {state === "processing"
            ? <span className="animate-spin rounded-full h-3 w-3 border-b-2" style={{ borderColor: s.color }} />
            : <ScanText size={12} />}
          {s.label}
        </span>
        {data && !data.lisible && (
          <span className="text-[11px]" style={{ color: "#B45309", fontWeight: 600 }}>Document peu lisible</span>
        )}
        {when && <span className="text-[11px] text-[#B0B0B0]">le {when}</span>}
        {(state === "error" || state === "done") && (
          <button onClick={onRetry} className="ml-auto text-[11px] text-[#3B42C5] hover:underline" style={{ fontWeight: 600 }}>
            Relancer l'analyse
          </button>
        )}
      </div>
      {state === "error" && row?.ocr_error && (
        <p className="flex items-start gap-2 text-xs text-[#E24B4A]">
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {row.ocr_error}
        </p>
      )}
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {fields.map(([k, label]) => (
            <div key={k} className="text-xs">
              <span className="text-[#888780]">{label} : </span>
              <span className="text-[#1A1A1A]" style={{ fontWeight: 600 }} dir="auto">{String((data as Record<string, unknown>)[k])}</span>
            </div>
          ))}
        </div>
      )}
      {data && data.alertes.length > 0 && (
        <ul className="space-y-1">
          {data.alertes.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-[#B45309]">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}
      {data?.texte_brut && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[#888780]">Texte lu sur le document</summary>
          <pre className="mt-1 whitespace-pre-wrap text-[#1A1A1A] bg-white rounded-lg p-2 max-h-48 overflow-y-auto" dir="auto">{data.texte_brut}</pre>
        </details>
      )}
    </div>
  );
}

// ── Cross-check: profile ↔ CIN ↔ diploma ────────────────────────────────────
// The comparison itself is the pure crossCheckKyc() (src/lib/kycCrossCheck.ts,
// mirrored in mobile-app/lib). Here: French labels and rendering only.
const CHECK_LABELS: Record<CheckItem["key"], string> = {
  cin_read: "CIN lue",
  diploma_read: "Diplôme lu",
  name_profile_cin: "Nom profil ↔ CIN",
  name_profile_diploma: "Nom profil ↔ diplôme",
  name_cin_diploma: "Nom et prénom CIN ↔ diplôme",
  cin_expiry: "Validité de la CIN",
  cin_number_diploma: "N° CIN ↔ diplôme",
  diploma_specialty: "Diplôme ↔ spécialité déclarée",
  alerts: "Alertes sur les documents",
};

const CHECK_NOTES: Record<NonNullable<CheckItem["note"]>, string> = {
  missing: "Document non fourni",
  not_analyzed: "En attente d'analyse",
  processing: "Analyse en cours…",
  error: "Échec de l'analyse",
  illegible: "Illisible",
  wrong_document: "Ce n'est pas le document attendu",
  expired: "CIN expirée",
  not_found_on_document: "Illisible sur le document",
  name_not_found: "Nom non retrouvé dans le texte lu",
  name_partial: "Nom retrouvé en partie seulement",
  name_not_isolated: "Nom non isolé sur la CIN — comparez à l'œil",
  not_on_diploma: "N° CIN absent ou illisible sur le diplôme",
  ocr_slip: "À un caractère près — probable erreur de lecture, comparez à l'œil",
};

const SPECIALTY_TEXT: Record<string, string> = {
  nurse: "infirmier",
  physiotherapist: "kinésithérapeute",
  psychologist: "psychologue",
  yoga_instructor: "instructeur yoga",
};

function checkDetail(c: CheckItem): string | null {
  const parts: string[] = [];
  if (c.note) parts.push(CHECK_NOTES[c.note]);
  if (c.status === "unreadable" && !c.note) parts.push("Illisible");
  const expected = c.key === "diploma_specialty" && c.expected ? SPECIALTY_TEXT[c.expected] ?? c.expected : c.expected;
  if (c.read && expected && c.status !== "ok") parts.push(`lu : « ${c.read} » / attendu : « ${expected} »`);
  else if (c.read) {
    parts.push(c.key !== "cin_expiry" ? `« ${c.read} »` : c.status === "ok" ? `valide jusqu'au ${c.read}` : `le ${c.read}`);
  } else if (expected && c.key.startsWith("name_")) {
    // Name searched in the raw text (no name field read)
    parts.push(c.status === "ok" ? `« ${expected} » retrouvé dans le document` : `recherché : « ${expected} »`);
  }
  if (c.detail) parts.push(c.detail);
  return parts.length ? parts.join(" — ") : null;
}

const VERDICT: Record<CrossCheckResult["verdict"], { title: string; hint: string; bg: string; border: string; color: string }> = {
  ok: { title: "Informations cohérentes", hint: "Profil, CIN et diplôme concordent.",
    bg: "#F0FDF4", border: "#BBF7D0", color: "#16A34A" },
  warn: { title: "À vérifier", hint: "Certains points n'ont pas pu être confirmés.",
    bg: "#FFFBEB", border: "#FDE68A", color: "#B45309" },
  fail: { title: "Incohérences détectées", hint: "Les informations ne concordent pas — rejet recommandé, sauf explication.",
    bg: "#FEF2F2", border: "#FECACA", color: "#E24B4A" },
  pending: { title: "Analyse en cours", hint: "Les documents sont en cours de lecture ; le résultat s'affichera ici.",
    bg: "#F8F8FC", border: "#ECECF3", color: "#3B42C5" },
};

// Compact verdict for the professionals table.
function VerdictBadge({ hasDocs, result }: { hasDocs: boolean; result: CrossCheckResult }) {
  const pill = (label: string, bg: string, color: string) => (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs whitespace-nowrap" style={{ background: bg, color, fontWeight: 600 }}>
      {label}
    </span>
  );
  if (!hasDocs) return pill("Aucun document", "#F3F3F5", "#888780");
  if (result.verdict === "ok") return pill("✓ Cohérent", "#DCFCE7", "#16A34A");
  if (result.verdict === "fail") return pill("✗ Incohérent", "#FDE8E8", "#E24B4A");
  // Analysis runs when the file is opened (admin browser OCR)
  if (result.verdict === "pending") return pill("À analyser", "#EEF2FF", "#3B42C5");
  return pill("⚠ À vérifier", "#FEF3C7", "#B45309");
}

function CrossCheckCard({ result }: { result: CrossCheckResult }) {
  const v = VERDICT[result.verdict];
  const Icon = result.verdict === "ok" ? CheckCircle2
    : result.verdict === "fail" ? XCircle
    : result.verdict === "pending" ? Clock : AlertTriangle;
  return (
    <div className="mb-3 rounded-xl p-3" style={{ background: v.bg, border: `1px solid ${v.border}` }}>
      <div className="flex items-start gap-2 mb-2">
        <Icon size={18} style={{ color: v.color }} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm" style={{ color: v.color, fontWeight: 700 }}>Vérification croisée : {v.title}</p>
          <p className="text-xs text-[#555]">{v.hint} {CROSS_CHECK_DISCLAIMER}</p>
        </div>
      </div>
      <ul className="space-y-1">
        {result.checks.map((c) => {
          const detail = checkDetail(c);
          return (
            <li key={c.key} className="flex items-start gap-2 text-xs">
              {c.status === "ok" ? <Check size={13} className="text-[#16A34A] mt-0.5 flex-shrink-0" />
                : c.status === "fail" ? <X size={13} className="text-[#E24B4A] mt-0.5 flex-shrink-0" />
                : c.status === "pending" ? <Clock size={13} className="text-[#3B42C5] mt-0.5 flex-shrink-0" />
                : c.status === "unreadable" ? <AlertCircle size={13} className="text-[#888780] mt-0.5 flex-shrink-0" />
                : c.status === "info" ? <Info size={13} className="text-[#888780] mt-0.5 flex-shrink-0" />
                : <AlertTriangle size={13} className="text-[#B45309] mt-0.5 flex-shrink-0" />}
              <span>
                <span className="text-[#1A1A1A]" style={{ fontWeight: 600 }}>{CHECK_LABELS[c.key]}</span>
                {detail && <span className="text-[#888780]" dir="auto"> — {detail}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
