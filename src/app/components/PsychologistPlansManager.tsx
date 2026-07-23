import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit3, Calendar, Clock, DollarSign, Users,
  Check, X, ChevronDown, ChevronUp, Zap, BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type PlanType = "single" | "recurring" | "subscription" | "program";
type Recurrence = "none" | "weekly" | "biweekly" | "monthly" | "daily";

interface AppointmentPlan {
  id?: string;
  pro_id: string;
  plan_type: PlanType;
  recurrence: Recurrence;
  session_duration_min: number;
  sessions_count?: number;
  price_per_session_mad: number;
  total_price_mad?: number;
  title: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Professional {
  id: string;
  full_name: string;
  specialty: string;
  email: string;
  city: string;
  bio?: string;
  rating_avg: number;
  rating_count: number;
}

const PLAN_TEMPLATES: Record<PlanType, { label: string; icon: any; color: string }> = {
  single: { label: "Séance unique", icon: Calendar, color: "#5BB8D4" },
  recurring: { label: "Récurrent", icon: Zap, color: "#8B5CF6" },
  subscription: { label: "Abonnement", icon: BookOpen, color: "#16A34A" },
  program: { label: "Programme (Kiné)", icon: Clock, color: "#EC4899" },
};

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "Une fois",
  weekly: "Hebdomadaire",
  biweekly: "Bi-hebdomadaire",
  monthly: "Mensuel",
  daily: "Quotidien",
};

export function PsychologistPlansManager() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProId, setSelectedProId] = useState<string | null>(null);
  const [plans, setPlans] = useState<AppointmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AppointmentPlan | null>(null);
  const [formData, setFormData] = useState<AppointmentPlan>({
    pro_id: "",
    plan_type: "single",
    recurrence: "none",
    session_duration_min: 60,
    sessions_count: 1,
    price_per_session_mad: 300,
    total_price_mad: 300,
    title: "",
    description: "",
    is_active: true,
  });
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  useEffect(() => {
    loadProfessionals();
  }, []);

  useEffect(() => {
    if (selectedProId) {
      loadPlans(selectedProId);
    }
  }, [selectedProId]);

  const loadProfessionals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("professionals")
        .select("id, full_name, specialty, email, city, bio, rating_avg, rating_count")
        .in("specialty", ["psychologist", "physiotherapist"])
        .eq("is_available", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProfessionals(data || []);
      if (data && data.length > 0) {
        setSelectedProId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading professionals:", error);
      toast.error("Erreur lors du chargement des professionnels");
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async (proId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("appointment_plans")
        .select("*")
        .eq("pro_id", proId)
        .order("created_at", { ascending: false });

      if (error) {
        // Table might not exist yet, it's okay
        console.warn("Appointment plans table not found:", error);
        setPlans([]);
      } else {
        setPlans(data || []);
      }
    } catch (error) {
      console.error("Error loading plans:", error);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanTypeChange = (planType: PlanType) => {
    setFormData((prev) => {
      const updated = { ...prev, plan_type: planType };
      
      // Set default recurrence based on plan type
      if (planType === "single") {
        updated.recurrence = "none";
        updated.sessions_count = 1;
      } else if (planType === "recurring") {
        updated.recurrence = "weekly";
        updated.sessions_count = 1;
      } else if (planType === "subscription") {
        updated.recurrence = "monthly";
        updated.sessions_count = 4;
      } else if (planType === "program") {
        updated.recurrence = "weekly";
        updated.sessions_count = 8;
      }

      return updated;
    });
  };

  const handleRecurrenceChange = (recurrence: Recurrence) => {
    setFormData((prev) => ({
      ...prev,
      recurrence,
    }));
  };

  const calculateTotalPrice = () => {
    const { price_per_session_mad, sessions_count = 1, plan_type } = formData;
    if (plan_type === "single") {
      return price_per_session_mad;
    }
    return price_per_session_mad * sessions_count;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProId || !formData.title) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }

    try {
      const submitData = {
        ...formData,
        pro_id: selectedProId,
        total_price_mad: calculateTotalPrice(),
      };

      if (editingPlan) {
        // Update
        const { error } = await supabase
          .from("appointment_plans")
          .update(submitData)
          .eq("id", editingPlan.id);

        if (error) throw error;
        toast.success("Plan mis à jour");
      } else {
        // Create
        const { error } = await supabase
          .from("appointment_plans")
          .insert(submitData);

        if (error) throw error;
        toast.success("Plan créé");
      }

      resetForm();
      await loadPlans(selectedProId);
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Erreur lors de la sauvegarde du plan");
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce plan ?")) return;

    try {
      const { error } = await supabase
        .from("appointment_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;
      toast.success("Plan supprimé");
      if (selectedProId) {
        await loadPlans(selectedProId);
      }
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast.error("Erreur lors de la suppression du plan");
    }
  };

  const handleEdit = (plan: AppointmentPlan) => {
    setEditingPlan(plan);
    setFormData(plan);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingPlan(null);
    setFormData({
      pro_id: selectedProId || "",
      plan_type: "single",
      recurrence: "none",
      session_duration_min: 60,
      sessions_count: 1,
      price_per_session_mad: 300,
      total_price_mad: 300,
      title: "",
      description: "",
      is_active: true,
    });
    setShowModal(false);
  };

  const selectedPro = professionals.find((p) => p.id === selectedProId);

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Plans d'appointment (Psychologues & Kinés)
        </h2>

        {/* Professional selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sélectionner un professionnel
          </label>
          <select
            value={selectedProId || ""}
            onChange={(e) => setSelectedProId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            {professionals.map((pro) => (
              <option key={pro.id} value={pro.id}>
                {pro.full_name} ({pro.specialty}) - {pro.city}
              </option>
            ))}
          </select>
        </div>

        {selectedPro && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedPro.full_name}</h3>
                <p className="text-sm text-gray-600">
                  {selectedPro.specialty === "psychologist" ? "Psychologue" : "Kinésithérapeute"} • {selectedPro.city}
                </p>
                {selectedPro.rating_count > 0 && (
                  <p className="text-sm text-yellow-600">
                    ⭐ {selectedPro.rating_avg.toFixed(1)} ({selectedPro.rating_count} avis)
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setEditingPlan(null);
                  setFormData({
                    pro_id: selectedProId,
                    plan_type: "single",
                    recurrence: "none",
                    session_duration_min: 60,
                    sessions_count: 1,
                    price_per_session_mad: 300,
                    total_price_mad: 300,
                    title: "",
                    description: "",
                    is_active: true,
                  });
                  setShowModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus size={18} /> Nouveau plan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Plans list */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Chargement...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Calendar size={32} className="mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">Aucun plan pour ce professionnel</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const Icon = PLAN_TEMPLATES[plan.plan_type]?.icon;
            const isExpanded = expandedPlan === plan.id;
            return (
              <motion.div
                key={plan.id}
                layout
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() =>
                    setExpandedPlan(isExpanded ? null : plan.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: PLAN_TEMPLATES[plan.plan_type]?.color + "20",
                      }}
                    >
                      {Icon && (
                        <Icon
                          size={20}
                          style={{
                            color: PLAN_TEMPLATES[plan.plan_type]?.color,
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {plan.title}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {PLAN_TEMPLATES[plan.plan_type]?.label} •{" "}
                        {RECURRENCE_LABELS[plan.recurrence]}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-4">
                      <p className="font-bold text-gray-900">
                        {plan.total_price_mad || plan.price_per_session_mad} MAD
                      </p>
                      <p className="text-xs text-gray-600">
                        {plan.sessions_count ? `${plan.sessions_count} séances` : ""}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-gray-200"
                    >
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase">
                            Durée de la séance
                          </p>
                          <p className="font-semibold text-gray-900">
                            {plan.session_duration_min} min
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">
                            Par séance
                          </p>
                          <p className="font-semibold text-gray-900">
                            {plan.price_per_session_mad} MAD
                          </p>
                        </div>
                        {plan.description && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500 uppercase">
                              Description
                            </p>
                            <p className="text-sm text-gray-700">
                              {plan.description}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(plan)}
                          className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          <Edit3 size={16} /> Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(plan.id!)}
                          className="flex items-center gap-1 px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          <Trash2 size={16} /> Supprimer
                        </button>
                        <div className="ml-auto flex items-center gap-2">
                          {plan.is_active ? (
                            <span className="flex items-center gap-1 text-green-700 text-sm">
                              <Check size={16} /> Actif
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-500 text-sm">
                              <X size={16} /> Inactif
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => resetForm()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingPlan ? "Modifier le plan" : "Créer un nouveau plan"}
                </h3>
                <button
                  onClick={() => resetForm()}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titre du plan *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Ex: Suivi psychologique mensuel"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optionnel)
                  </label>
                  <textarea
                    value={formData.description || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Détails du plan..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Plan Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Type de plan *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(PLAN_TEMPLATES).map(
                      ([type, { label, icon: Icon, color }]) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            handlePlanTypeChange(type as PlanType)
                          }
                          className={`p-3 rounded-lg border-2 transition flex items-center gap-2 ${
                            formData.plan_type === type
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <Icon size={18} style={{ color }} />
                          <span className="font-medium">{label}</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Recurrence */}
                {formData.plan_type !== "single" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fréquence *
                    </label>
                    <select
                      value={formData.recurrence}
                      onChange={(e) =>
                        handleRecurrenceChange(e.target.value as Recurrence)
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(RECURRENCE_LABELS).map(
                        ([rec, label]) => (
                          <option key={rec} value={rec}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}

                {/* Sessions count */}
                {formData.plan_type !== "single" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre de séances *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.sessions_count || 1}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sessions_count: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                )}

                {/* Session duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Durée de la séance (minutes) *
                  </label>
                  <select
                    value={formData.session_duration_min}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        session_duration_min: parseInt(e.target.value),
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min (1 heure)</option>
                    <option value="90">90 min (1.5 heures)</option>
                    <option value="120">120 min (2 heures)</option>
                  </select>
                </div>

                {/* Price per session */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prix par séance (MAD) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formData.price_per_session_mad}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        price_per_session_mad: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Total price (read-only) */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Prix total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {calculateTotalPrice()} MAD
                  </p>
                </div>

                {/* Active status */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        is_active: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Activer ce plan
                  </label>
                </div>

                {/* Submit buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                  >
                    {editingPlan ? "Mettre à jour" : "Créer le plan"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
