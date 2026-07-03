import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import {
  Check, X, Eye, Clock, AlertCircle, CheckCircle2, XCircle,
  Mail, MapPin, Phone, Award, Filter, Download, Search, UserX, ExternalLink, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { approvePro, rejectPro } from "../../lib/api";

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
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    loadProfessionals();
  }, [filter, specialtyFilter]);

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

  const loadProDocuments = async (proId: string) => {
    try {
      const { data, error } = await supabase
        .from("pro_documents")
        .select("id,doc_type,storage_path,is_verified")
        .eq("professional_id", proId);
      if (error) {
        console.error("Error fetching pro documents:", error);
        setProDocuments([]);
        return;
      }
      setProDocuments(data ?? []);
    } catch (e) {
      console.error("Error loading pro documents:", e);
      setProDocuments([]);
    }
  };

  const handleApprovePro = async (pro?: Professional) => {
    const target = pro || selectedPro;
    if (!target) return;
    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("professionals")
        .update({
          verification_status: "approved",
          verified_at: new Date().toISOString(),
        })
        .eq("id", target.id);

      if (updateError) {
        // fallback to admin API if direct update blocked by RLS
        try {
          await approvePro(target.id);
        } catch (apiErr) {
          throw updateError;
        }
      }

      // Mark documents verified as well (best-effort)
      const { error: docsErr } = await supabase.from("pro_documents").update({ is_verified: true }).eq("professional_id", target.id);
      if (docsErr) console.warn("Failed to mark docs verified:", docsErr);

      await sendApprovalNotification(target);

      toast.success(`${target.full_name} a été approuvé(e)`);
      setShowDetailsModal(false);
      loadProfessionals();
    } catch (error) {
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
    try {
      const { error: updateError } = await supabase
        .from("professionals")
        .update({
          verification_status: "rejected",
          rejection_reason: rejectReason,
        })
        .eq("id", selectedPro.id);

      if (updateError) {
        try {
          await rejectPro(selectedPro.id);
        } catch (apiErr) {
          throw updateError;
        }
      }

      await sendRejectionNotification(selectedPro, rejectReason);

      toast.success(`${selectedPro.full_name} a été rejeté(e)`);
      setShowRejectModal(false);
      setShowDetailsModal(false);
      setRejectReason("");
      loadProfessionals();
    } catch (error) {
      console.error("Error rejecting professional:", error);
      toast.error("Erreur lors du rejet");
    } finally {
      setActionLoading(false);
    }
  };

  const deletePro = async (proId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce professionnel ?")) return;
    try {
      await supabase.from("professionals").delete().eq("id", proId);
      setProfessionals((prev) => prev.filter((p) => p.id !== proId));
      toast.success("Professionnel supprimé");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const sendApprovalNotification = async (pro: Professional) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (token) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-approval-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email: pro.email,
              name: pro.full_name,
              specialty: pro.specialty,
            }),
          }
        );
      }

      await supabase.from("notifications").insert({
        user_id: pro.id,
        kind: "approval",
        title: "Compte approuvé",
        body: "Votre compte professionnel a été approuvé! Vous pouvez maintenant accéder à toutes les fonctionnalités.",
      });
    } catch (error) {
      console.error("Error sending approval notification:", error);
    }
  };

  const sendRejectionNotification = async (pro: Professional, reason: string) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (token) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-rejection-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email: pro.email,
              name: pro.full_name,
              reason: reason,
            }),
          }
        );
      }

      await supabase.from("notifications").insert({
        user_id: pro.id,
        kind: "rejection",
        title: "Compte rejeté",
        body: `Votre candidature a été rejetée pour la raison suivante: ${reason}`,
      });
    } catch (error) {
      console.error("Error sending rejection notification:", error);
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

  const filtered = professionals.filter(
    (p) =>
      p.full_name.toLowerCase().includes(searchQ.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-[#888780]">{(professionals ?? []).length} professionnels inscrits</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {}} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#888780]" style={{ background: "#F3F3F5" }}>
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
                  {["Professionnel", "Spécialité", "Email", "Ville", "Expérience", "Statut", "Actions"].map((h) => (
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
                      <div className="flex items-center gap-1">
                        {pro.verification_status === "pending" && (
                          <>
                            <button
                              onClick={() => {
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
                          onClick={async () => {
                            setSelectedPro(pro);
                            await loadProDocuments(pro.id);
                            setShowDetailsModal(true);
                          }}
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
                  <p className="text-xs text-[#888780] mb-2" style={{ fontWeight: 600 }}>Documents</p>
                  <div className="flex gap-2 flex-wrap">
                    {proDocuments.length === 0 ? (
                      <p className="text-sm text-[#888780]">Aucun document</p>
                    ) : (
                      proDocuments.map((d: any) => (
                        <button key={d.id} onClick={async () => {
                          try {
                            const { data } = await supabase.storage.from("pro-documents").createSignedUrl(d.storage_path, 60);
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                            else toast.error("Impossible d'ouvrir le document");
                          } catch (e) {
                            console.error("Error opening doc:", e);
                            toast.error("Erreur lors de l'ouverture du document");
                          }
                        }} className="inline-flex items-center gap-1.5 px-3 h-8 bg-[#F3F3F5] rounded-xl text-[12px] hover:bg-[#EDE5CC]">
                          <FileText size={12} /> {d.doc_type} <ExternalLink size={11} />
                        </button>
                      ))
                    )}
                  </div>
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
                      onClick={() => handleApprovePro(selectedPro)}
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
