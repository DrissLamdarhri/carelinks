import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import {
  Check, X, Eye, Clock, AlertCircle, CheckCircle2, XCircle,
  Mail, MapPin, Phone, Award, Filter, Download, Search, UserX, ExternalLink, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { approvePro, rejectPro, getProDocumentsAdmin, getAdminSignedUrl } from "../../lib/api";
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

    return () => {
      subscription.unsubscribe();
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

      if (error) {
        console.warn("Error fetching pro documents via RLS:", error);
        // Try admin API fallback
        try {
          const res = await getProDocumentsAdmin(proId);
          setProDocuments(res.documents ?? []);
          return;
        } catch (apiErr) {
          console.error("Admin API pro documents error:", apiErr);
          setProDocuments([]);
          return;
        }
      }

      if (!data || data.length === 0) {
        // Fallback in case RLS filtered results
        try {
          const res = await getProDocumentsAdmin(proId);
          if (res.documents && res.documents.length > 0) {
            setProDocuments(res.documents);
            return;
          }
        } catch (apiErr) {
          // ignore
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

  const openDetailsModal = async (pro: Professional) => {
    setSelectedPro(pro);
    setShowDetailsModal(true);
    // Load documents when modal opens
    await loadProDocuments(pro.id);
  };

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
                  <p className="text-xs text-[#888780] mb-2" style={{ fontWeight: 600 }}>Documents</p>
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
                        <div key={d.id} style={{ background: "#F8F8FC", borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>{d.doc_type}</p>
                            <p className="text-xs text-[#888780]">{new Date(d.uploaded_at).toLocaleDateString("fr-FR")}</p>
                          </div>
                          <button onClick={async () => {
                            try {
                              const res = await getAdminSignedUrl(d.storage_path);
                              if (res?.signedUrl) window.open(res.signedUrl, "_blank");
                              else toast.error("Impossible d'ouvrir le document");
                            } catch (e) {
                              console.error("Error opening doc via admin signed-url:", e);
                              toast.error("Erreur lors de l'ouverture du document");
                            }
                          }} className="inline-flex items-center gap-1.5 px-3 h-8 bg-[#0D0870] text-white rounded-xl text-[12px] hover:opacity-90" style={{ fontWeight: 600 }}>
                            <FileText size={12} /> Ouvrir
                          </button>
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
