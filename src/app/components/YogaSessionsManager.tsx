import React, { useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Calendar, Users, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAllYogaSessions, useSessionEnrollmentsWithCount, type YogaSession } from "../../lib/db/yoga-realtime";

export function YogaSessionsManager() {
  const { sessions, loading, error, refresh } = useAllYogaSessions();
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState<YogaSession | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    level: "Tous niveaux",
    instructor_name: "",
    capacity: 10,
    price_mad: 120,
    starts_at: "",
    duration_min: 60,
    is_online: false,
    meeting_url: "",
    address: "",
    image_url: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.starts_at) {
      toast.error("Titre et date/heure sont obligatoires");
      return;
    }

    try {
      let image_url = formData.image_url;

      // Convert image to base64 if new file selected
      if (imageFile) {
        const reader = new FileReader();
        image_url = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve(`data:image/jpeg;base64,${base64}`);
          };
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }

      const submitData = {
        title: formData.title,
        description: formData.description,
        level: formData.level,
        instructor_name: formData.instructor_name || null,
        capacity: formData.capacity,
        price_mad: formData.price_mad,
        starts_at: new Date(formData.starts_at).toISOString(),
        duration_min: formData.duration_min,
        is_online: formData.is_online,
        meeting_url: formData.is_online ? formData.meeting_url : null,
        address: formData.is_online ? null : formData.address,
        image_url,
      };

      if (editingSession) {
        // Update
        const { error } = await supabase
          .from("yoga_sessions")
          .update(submitData)
          .eq("id", editingSession.id);

        if (error) throw error;
        toast.success("Séance mise à jour");
      } else {
        // Create
        const { error } = await supabase
          .from("yoga_sessions")
          .insert(submitData);

        if (error) throw error;
        toast.success("Séance créée");
      }

      resetForm();
      await refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
      console.error(err);
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingSession(null);
    setFormData({
      title: "",
      description: "",
      level: "Tous niveaux",
      instructor_name: "",
      capacity: 10,
      price_mad: 120,
      starts_at: "",
      duration_min: 60,
      is_online: false,
      meeting_url: "",
      address: "",
      image_url: "",
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleEdit = (session: YogaSession) => {
    setEditingSession(session);
    setFormData({
      title: session.title,
      description: session.description || "",
      level: session.level || "Tous niveaux",
      instructor_name: session.instructor_name || "",
      capacity: session.capacity,
      price_mad: session.price_mad,
      starts_at: session.starts_at.slice(0, 16), // Format for datetime-local
      duration_min: session.duration_min || 60,
      is_online: session.is_online || false,
      meeting_url: session.meeting_url || "",
      address: session.address || "",
      image_url: session.image_url || "",
    });
    if (session.image_url) {
      setImagePreview(session.image_url);
    }
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette séance ?")) return;

    try {
      const { error } = await supabase
        .from("yoga_sessions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Séance supprimée");
      await refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
      console.error(err);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-1">Gestion des séances de yoga</h2>
          <p className="text-sm text-[#888780]">
            {sessions.length} séance{sessions.length !== 1 ? "s" : ""} créée{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm"
          style={{ background: "#0D0870", fontWeight: 600 }}
        >
          <Plus size={16} /> Ajouter une séance
        </button>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#0D0870] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[#888780]">Chargement des séances...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-[#FEE2E2] text-[#991B1B] p-4 rounded-lg">
          Erreur lors du chargement des séances
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[#888780] mb-4">Aucune séance créée</p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0D0870] text-white"
          >
            <Plus size={16} /> Créer la première séance
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#1A1A1A]">
                  {editingSession ? "Modifier la séance" : "Créer une séance"}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-[#888780] hover:text-[#1A1A1A]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                    Titre *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Ex: Hatha Flow Matinal"
                    className="w-full px-4 py-2.5 rounded-lg border border-[#E0E0E0] focus:outline-none focus:border-[#0D0870]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Décrivez la séance..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#E0E0E0] focus:outline-none focus:border-[#0D0870]"
                  />
                </div>

                {/* Row: Level & Duration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                      Niveau
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({ ...formData, level: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-lg border border-[#E0E0E0] focus:outline-none focus:border-[#0D0870]"
                    >
                      <option value="Tous niveaux">Tous niveaux</option>
                      <option value="Débutant">Débutant</option>
                      <option value="Intermédiaire">Intermédiaire</option>
                      <option value="Avancé">Avancé</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                      Durée (min)
                    </label>
                    <input
                      type="number"
                      value={formData.duration_min}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_min: parseInt(e.target.value) || 60,
                        })
                      }
                      min="15"
                      step="15"
                      className="w-full px-4 py-2.5 rounded-lg border border-[#E0E0E0] focus:outline-none focus:border-[#0D0870]"
                    />
                  </div>
                </div>

                {/* Instructor */}
                <div>
                  <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                    Instructeur yoga
                  </label>
                  <input
                    type="text"
                    value={formData.instructor_id}
                    onChange={(e) =>
                      setFormData({ ...formData, instructor_name: e.target.value })
                    }
                    placeholder="Ex: Hatha Flow Matinal"
                    className="w-full px-4 py-2.5 rounded-lg border border-[#E0E0E0] focus:outline-none focus:border-[#0D0870]"
                  />
                </div>

                {/* Start Date & Time */}
                <div>
                  <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                    Date et heure *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) =>
                      setFormData({ ...formData, starts_at: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-[#E0E0E0] focus:outline-none focus:border-[#0D0870]"
                  />
                </div>

                {/* Row: Capacity & Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                      Places max
                    </label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          capacity: parseInt(e.target.value) || 10,
                        })
                      }
                      min="1"
                      className="w-full px-4 py-2.5 rounded-lg border border-[#E0E0E0] focus:outline-none focus:border-[#0D0870]"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                      Prix (MAD)
                    </label>
                    <input
                      type="number"
                      value={formData.price_mad}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price_mad: parseFloat(e.target.value) || 0,
                        })
                      }
                      min="0"
                      step="10"
                      className="w-full px-4 py-2.5 rounded-lg border border-[#E0E0E0] focus:outline-none focus:border-[#0D0870]"
                    />
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                    Image
                  </label>
                  {imagePreview && (
                    <div className="mb-3 relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-sm"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="w-full"
                  />
                </div>

                {/* Location or Online */}
                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_online}
                      onChange={(e) =>
                        setFormData({ ...formData, is_online: e.target.checked })
                      }
                    />
                    <span className="text-sm text-[#1A1A1A]">En ligne (visio)</span>
                  </label>

                  {formData.is_online ? (
                    <div>
                      <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                        Lien de visio (Zoom, Meet, etc.)
                      </label>
                      <input
                        type="url"
                        value={formData.meeting_url}
                        onChange={(e) =>
                          setFormData({ ...formData, meeting_url: e.target.value })
                        }
                        placeholder="https://..."
                        className="w-full px-4 py-2.5 rounded-lg border border-[#E0E0E0] focus:outline-none focus:border-[#0D0870]"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-medium text-[#1A1A1A] block mb-2">
                        Adresse (domicile du patient ou lieu fixe)
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        placeholder="Ex: À domicile, Centre de yoga..."
                        className="w-full px-4 py-2.5 rounded-lg border border-[#E0E0E0] focus:outline-none focus:border-[#0D0870]"
                      />
                    </div>
                  )}
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-3 rounded-xl border border-[#E0E0E0] text-[#1A1A1A] font-medium hover:bg-[#F3F3F5]"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl text-white font-medium"
                    style={{ background: "#0D0870" }}
                  >
                    {editingSession ? "Modifier" : "Créer"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Session Card Component
function SessionCard({
  session,
  onEdit,
  onDelete,
}: {
  session: YogaSession;
  onEdit: (s: YogaSession) => void;
  onDelete: (id: string) => void;
}) {
  const { count: enrollmentCount } = useSessionEnrollmentsWithCount(session.id);
  const isFull = enrollmentCount >= session.capacity;
  const isRunning =
    new Date(session.starts_at) <= new Date() &&
    new Date(session.starts_at).getTime() + (session.duration_min || 60) * 60000 >
      new Date().getTime();
  const isPast =
    new Date(session.starts_at).getTime() +
      (session.duration_min || 60) * 60000 <
    new Date().getTime();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Image */}
      {session.image_url && (
        <div className="relative h-32 overflow-hidden">
          <img
            src={session.image_url}
            alt={session.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-medium text-[#1A1A1A]">
            {session.level}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <h4 className="font-bold text-[#1A1A1A] mb-1 text-sm">{session.title}</h4>
        <p className="text-xs text-[#888780] mb-3">
          {new Date(session.starts_at).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

        {/* Capacity bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#888780]">Inscriptions</span>
            <span className="text-xs font-medium text-[#1A1A1A]">
              {enrollmentCount}/{session.capacity}
            </span>
          </div>
          <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                isFull ? "bg-[#E24B4A]" : "bg-[#5BB8D4]"
              }`}
              style={{
                width: `${Math.min((enrollmentCount / session.capacity) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Status badge */}
        <div className="mb-3 flex gap-1 flex-wrap">
          {isRunning && (
            <span className="inline-block px-2 py-1 text-xs bg-[#FEF3C7] text-[#D97706] rounded">
              En cours
            </span>
          )}
          {isPast && (
            <span className="inline-block px-2 py-1 text-xs bg-[#F3F3F5] text-[#888780] rounded">
              Terminée
            </span>
          )}
          {isFull && (
            <span className="inline-block px-2 py-1 text-xs bg-[#FDE8E8] text-[#E24B4A] rounded">
              Complète
            </span>
          )}
        </div>

        {/* Price */}
        <p className="text-sm font-bold text-[#0D0870] mb-3">
          {session.price_mad} MAD
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(session)}
            className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-[#F3F3F5] text-[#1A1A1A] text-xs font-medium hover:bg-[#E0E0E0] transition-colors"
          >
            <Edit3 size={13} /> Modifier
          </button>
          <button
            onClick={() => onDelete(session.id)}
            className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-[#FDE8E8] text-[#E24B4A] text-xs font-medium hover:bg-[#FDD2D2] transition-colors"
          >
            <Trash2 size={13} /> Supprimer
          </button>
        </div>
      </div>
    </motion.div>
  );
}
