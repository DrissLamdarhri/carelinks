import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import {
  Ban, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock, Flower2, Plus, RefreshCw, Trash2, Upload, Users, X,
} from "lucide-react";

// Full yoga management for admins: create a class, see every class with its real
// enrollment count (needs migration 0029 for the enrollments read policy), expand
// to see who enrolled, and delete. Yoga is a *class* model, distinct from the
// on-demand services: admin publishes a session → patients see it in the app →
// enroll → pay the price (escrow) → attend at the scheduled time.

type Session = {
  id: string;
  title: string;
  instructor: string;
  level: string;
  starts_at: string;
  duration_min: number;
  capacity: number;
  price_mad: number;
  image_url: string | null;
  enrolled: number;
  status: "scheduled" | "completed" | "cancelled";
  cancel_reason: string | null;
};
type Enrollee = { patient_id: string; name: string; enrolled_at: string };

const LEVELS = ["Tous niveaux", "Débutant", "Intermédiaire", "Avancé"];
const emptyForm = { title: "", instructor: "", date: "", time: "10:00", level: "Tous niveaux", capacity: 10, price: 120, imageUrl: "" };

const STATUS_BADGE = {
  scheduled: { bg: "#DCFCE7", fg: "#15803D", label: "Publiée" },
  completed: { bg: "#EEF0FB", fg: "#0D0870", label: "Terminée" },
  cancelled: { bg: "#FDE8E8", fg: "#B91C1C", label: "Annulée" },
} as const;

export function YogaManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [enrollees, setEnrollees] = useState<Record<string, Enrollee[]>>({});
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // NB: the deployed table uses `instructor_name` (text), not instructor_id.
      const { data: rows, error } = await supabase
        .from("yoga_sessions")
        .select("id, title, description, level, starts_at, duration_min, capacity, price_mad, image_url, instructor_name, status, cancel_reason")
        .order("starts_at", { ascending: false });
      if (error) throw error;

      const ids = (rows ?? []).map((s: any) => s.id);
      // Real enrollment counts (admin can read them via migration 0029).
      const counts = new Map<string, number>();
      if (ids.length > 0) {
        const { data: enr } = await supabase.from("yoga_enrollments").select("session_id").in("session_id", ids);
        for (const e of enr ?? []) counts.set(e.session_id as string, (counts.get(e.session_id as string) ?? 0) + 1);
      }

      setSessions(
        (rows ?? []).map((s: any) => ({
          id: s.id,
          title: s.title,
          instructor:
            s.instructor_name ||
            (s.description ?? "").replace(/^Instructeur:\s*/, "") ||
            "—",
          level: s.level ?? "Tous niveaux",
          starts_at: s.starts_at,
          duration_min: s.duration_min ?? 60,
          capacity: s.capacity ?? 0,
          price_mad: Number(s.price_mad ?? 0),
          image_url: s.image_url,
          enrolled: counts.get(s.id) ?? 0,
          status: (s.status ?? "scheduled") as Session["status"],
          cancel_reason: s.cancel_reason ?? null,
        })),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement des séances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const sub = supabase
      .channel("yoga_admin_mgr")
      .on("postgres_changes", { event: "*", schema: "public", table: "yoga_sessions" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "yoga_enrollments" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createSession = async () => {
    if (!form.title.trim()) return toast.error("Le titre est obligatoire");
    if (!form.date) return toast.error("La date est obligatoire");
    const starts = new Date(`${form.date}T${form.time || "10:00"}:00`);
    if (isNaN(starts.getTime())) return toast.error("Date/heure invalide");
    if (!(form.price > 0)) return toast.error("Le prix doit être supérieur à 0");
    if (!(form.capacity > 0)) return toast.error("La capacité doit être supérieure à 0");

    setSaving(true);
    try {
      const { error } = await supabase.from("yoga_sessions").insert({
        instructor_name: form.instructor.trim() || null,
        title: form.title.trim(),
        level: form.level,
        image_url: form.imageUrl.trim() || null,
        starts_at: starts.toISOString(),
        duration_min: 60,
        capacity: form.capacity,
        price_mad: form.price,
        description: null,
      });
      if (error) throw error;
      toast.success("Séance créée et publiée");
      setForm({ ...emptyForm });
      setShowForm(false);
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de créer la séance");
    } finally {
      setSaving(false);
    }
  };

  // The class photo is uploaded to our own storage, never hot-linked from an
  // external URL: third-party links rot, can be pulled at any time, and are not
  // something we can ship to a client.
  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `sessions/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("yoga-images")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("yoga-images").getPublicUrl(path);
      setForm((f) => ({ ...f, imageUrl: data.publicUrl }));
      toast.success("Photo téléversée");
    } catch (e: any) {
      toast.error(e?.message ?? "Téléversement impossible");
    } finally {
      setUploading(false);
    }
  };

  // Marking the class done flips its bookings to 'completed', which is what
  // releases the escrow to the instructor. Without it the money stays frozen.
  const completeSession = async (id: string, title: string) => {
    if (!confirm(`Marquer « ${title} » comme terminée ?\n\nLes paiements bloqués seront libérés.`)) return;
    setBusyId(id);
    try {
      const { data, error } = await supabase.rpc("complete_yoga_session", { p_session_id: id });
      if (error) throw error;
      toast.success(`Séance terminée — ${data ?? 0} paiement(s) libéré(s)`);
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de terminer la séance");
    } finally {
      setBusyId(null);
    }
  };

  const cancelSession = async (id: string, title: string) => {
    const reason = window.prompt(`Annuler « ${title} » ?\n\nTous les inscrits seront remboursés. Motif :`, "Séance annulée par le studio.");
    if (reason === null) return;
    setBusyId(id);
    try {
      const { data, error } = await supabase.rpc("cancel_yoga_session", { p_session_id: id, p_reason: reason });
      if (error) throw error;
      toast.success(`Séance annulée — ${data ?? 0} remboursement(s)`);
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible d'annuler la séance");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette séance ? Les inscriptions liées seront retirées.")) return;
    try {
      const { error } = await supabase.from("yoga_sessions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Séance supprimée");
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    }
  };

  const toggleEnrollees = async (id: string) => {
    if (expanded === id) return setExpanded(null);
    setExpanded(id);
    if (enrollees[id]) return;
    try {
      const { data: enr } = await supabase
        .from("yoga_enrollments")
        .select("patient_id, enrolled_at")
        .eq("session_id", id)
        .order("enrolled_at", { ascending: true });
      const pids = (enr ?? []).map((e: any) => e.patient_id);
      const names = new Map<string, string>();
      if (pids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", pids);
        for (const p of profs ?? []) names.set(p.id as string, (p.full_name as string) || "Patient");
      }
      setEnrollees((prev) => ({
        ...prev,
        [id]: (enr ?? []).map((e: any) => ({ patient_id: e.patient_id, name: names.get(e.patient_id) ?? "Patient", enrolled_at: e.enrolled_at })),
      }));
    } catch {
      setEnrollees((prev) => ({ ...prev, [id]: [] }));
    }
  };

  const upcoming = useMemo(() => sessions.filter((s) => new Date(s.starts_at) > new Date()).length, [sessions]);
  const totalEnrolled = useMemo(() => sessions.reduce((s, x) => s + x.enrolled, 0), [sessions]);
  const money = (n: number) => `${n.toLocaleString("fr-MA")} MAD`;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-MA", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl" style={{ fontWeight: 700, color: "#1A1A1A" }}>Yoga</h2>
          <p className="text-sm" style={{ color: "#888780" }}>Séances de groupe publiées aux patients</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm" style={{ background: "#F3F3F5", color: "#0D0870", fontWeight: 600 }}>
            <RefreshCw size={15} /> Actualiser
          </button>
          <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white" style={{ background: "#0D0870", fontWeight: 600 }}>
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Fermer" : "Ajouter une séance"}
          </button>
        </div>
      </div>

      {/* How the yoga process works — the "full process" at a glance. */}
      <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: "#EEF6FB", color: "#0B5563" }}>
        <strong>Comment ça marche :</strong> vous publiez une séance → elle apparaît dans l'app patient →
        le patient s'inscrit et paie le prix (bloqué en escrow) → il assiste à l'heure prévue → vous cliquez
        <strong> « Terminer &amp; payer »</strong>, ce qui libère l'argent. « Annuler » rembourse tous les inscrits.
        La capacité est bloquée automatiquement côté serveur. Les séances sont uniquement en présentiel.
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Summary icon={Flower2} label="Séances" value={String(sessions.length)} tint="#5BB8D4" bg="#D8F0F4" />
        <Summary icon={Calendar} label="À venir" value={String(upcoming)} tint="#0D0870" bg="#EEF0FB" />
        <Summary icon={Users} label="Inscrits (total)" value={String(totalEnrolled)} tint="#15803D" bg="#DCFCE7" />
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 mb-5" style={{ border: "1px solid #EFEFF2" }}>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Field label="Titre de la séance *"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex: Hatha Flow Matinal" style={inputStyle} /></Field>
            <Field label="Instructeur"><input value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} placeholder="Nom de l'instructeur" style={inputStyle} /></Field>
            <Field label="Date *"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} /></Field>
            <Field label="Heure"><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle} /></Field>
            <Field label="Capacité"><input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} style={inputStyle} /></Field>
            <Field label="Prix (MAD)"><input type="number" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} style={inputStyle} /></Field>
            <Field label="Photo de la séance">
              <div className="flex items-center gap-2">
                <label
                  className="inline-flex items-center gap-2 rounded-xl px-3.5 text-sm cursor-pointer"
                  style={{ background: "#F3F3F5", color: "#0D0870", fontWeight: 600, height: 44 }}
                >
                  <Upload size={15} />
                  {uploading ? "Téléversement…" : form.imageUrl ? "Remplacer" : "Choisir une photo"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadImage(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="" style={{ height: 44, width: 60, objectFit: "cover", borderRadius: 10 }} />
                ) : null}
              </div>
            </Field>
          </div>
          <div className="mt-3">
            <label className="text-xs" style={{ color: "#888780" }}>Niveau</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {LEVELS.map((lvl) => (
                <button key={lvl} onClick={() => setForm({ ...form, level: lvl })} className="rounded-full px-3.5 py-1.5 text-xs" style={{ background: form.level === lvl ? "#0D0870" : "#F3F3F5", color: form.level === lvl ? "#fff" : "#888780", fontWeight: 600 }}>{lvl}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setShowForm(false); setForm({ ...emptyForm }); }} className="rounded-xl px-4 py-2.5 text-sm" style={{ background: "#F3F3F5", color: "#888780", fontWeight: 600 }}>Annuler</button>
            <button onClick={createSession} disabled={saving} className="rounded-xl px-5 py-2.5 text-sm text-white" style={{ background: "#0D0870", fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? "Création…" : "Créer la séance"}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: "#888780" }}>Chargement…</div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl bg-white py-16 text-center">
          <Flower2 size={28} className="mx-auto mb-2" style={{ color: "#B0B0B0" }} />
          <p className="text-sm" style={{ color: "#888780" }}>Aucune séance. Ajoutez-en une pour qu'elle apparaisse dans l'app patient.</p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {sessions.map((s) => {
            const past = new Date(s.starts_at) < new Date();
            const pct = s.capacity ? Math.min(100, (s.enrolled / s.capacity) * 100) : 0;
            const full = s.enrolled >= s.capacity && s.capacity > 0;
            const badge = STATUS_BADGE[s.status];
            const open = s.status === "scheduled";
            return (
              <div key={s.id} className="rounded-2xl bg-white p-5" style={{ border: "1px solid #EFEFF2" }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#D8F0F4" }}>
                    <Flower2 size={20} className="text-[#5BB8D4]" />
                  </div>
                  <span className="inline-flex rounded-full px-2.5 py-1 text-xs" style={{ background: badge.bg, color: badge.fg, fontWeight: 600 }}>
                    {s.status === "scheduled" && past ? "À clôturer" : badge.label}
                  </span>
                </div>
                <p className="text-sm mb-1" style={{ fontWeight: 700, color: "#1A1A1A" }}>{s.title}</p>
                <p className="text-xs mb-3" style={{ color: "#888780" }}>{s.instructor} · {s.level}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs mb-3" style={{ color: "#888780" }}>
                  <span className="flex items-center gap-1"><Calendar size={12} /> {fmt(s.starts_at)}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {s.duration_min} min</span>
                  <span style={{ fontWeight: 700, color: "#0D0870" }}>{money(s.price_mad)}</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "#F0F0F0" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: full ? "#DC2626" : "#5BB8D4" }} />
                  </div>
                  <span className="text-xs" style={{ color: full ? "#DC2626" : "#888780", fontWeight: 600 }}>{s.enrolled}/{s.capacity}</span>
                </div>
                {/* Closing the class is what releases the escrow — it is the
                    primary action once the class has taken place. */}
                {open && (
                  <div className="flex gap-2 mb-3">
                    <button
                      disabled={busyId === s.id}
                      onClick={() => void completeSession(s.id, s.title)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs disabled:opacity-50"
                      style={{ background: past ? "#0D0870" : "#EEF0FB", color: past ? "#fff" : "#0D0870", fontWeight: 700 }}
                    >
                      <CheckCircle2 size={13} /> Terminer & payer
                    </button>
                    <button
                      disabled={busyId === s.id}
                      onClick={() => void cancelSession(s.id, s.title)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
                      style={{ background: "#FDE8E8", color: "#B91C1C", fontWeight: 700 }}
                    >
                      <Ban size={13} /> Annuler
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button onClick={() => toggleEnrollees(s.id)} className="inline-flex items-center gap-1 text-xs" style={{ color: "#0D0870", fontWeight: 600 }}>
                    <Users size={13} /> Inscrits {expanded === s.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <button onClick={() => remove(s.id)} className="inline-flex items-center gap-1 text-xs" style={{ color: "#DC2626", fontWeight: 600 }}>
                    <Trash2 size={13} /> Supprimer
                  </button>
                </div>
                {s.status === "cancelled" && s.cancel_reason ? (
                  <p className="text-xs mt-2" style={{ color: "#B91C1C" }}>{s.cancel_reason}</p>
                ) : null}
                {expanded === s.id && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F0F0F3" }}>
                    {!enrollees[s.id] ? (
                      <p className="text-xs" style={{ color: "#B0B0B0" }}>Chargement…</p>
                    ) : enrollees[s.id].length === 0 ? (
                      <p className="text-xs" style={{ color: "#B0B0B0" }}>Aucun inscrit pour l'instant.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {enrollees[s.id].map((e) => (
                          <div key={e.patient_id} className="flex items-center justify-between text-xs">
                            <span style={{ color: "#1A1A1A", fontWeight: 500 }}>{e.name}</span>
                            <span style={{ color: "#B0B0B0" }}>{new Date(e.enrolled_at).toLocaleDateString("fr-MA")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 44, background: "#F3F3F5", borderRadius: 12, padding: "0 14px", fontSize: 14, outline: "none", border: "none",
};
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs" style={{ color: "#888780" }}>{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
function Summary({ icon: Icon, label, value, tint, bg }: { icon: any; label: string; value: string; tint: string; bg: string }) {
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
