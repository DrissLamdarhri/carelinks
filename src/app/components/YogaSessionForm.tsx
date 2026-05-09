/**
 * YogaSessionForm — instructor creates a session.
 */
import { useState } from "react";
import { Loader2, Calendar, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth-context";
import { db } from "../../lib/db";

export function YogaSessionForm({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(10);
  const [price, setPrice] = useState(150);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user || !title || !startsAt) return;
    setLoading(true);
    try {
      await db.yoga.createSession({
        instructor_id: user.id,
        title,
        starts_at: new Date(startsAt).toISOString(),
        duration_minutes: duration,
        capacity,
        price_mad: price,
        location_label: null,
      } as any);
      toast.success("Session créée");
      setTitle(""); setStartsAt("");
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-white rounded-2xl" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <p className="text-[14px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>Nouvelle session yoga</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (ex: Yoga matinal)"
        className="h-[44px] bg-[#F3F3F5] rounded-xl px-3 text-[13px] outline-none" />
      <label className="flex items-center gap-2 h-[44px] bg-[#F3F3F5] rounded-xl px-3">
        <Calendar size={14} className="text-[#888780]" />
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
          className="flex-1 text-[13px] outline-none bg-transparent" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex items-center gap-1.5 h-[44px] bg-[#F3F3F5] rounded-xl px-2.5">
          <span className="text-[10px] text-[#888780]">min</span>
          <input type="number" value={duration} onChange={(e) => setDuration(+e.target.value)}
            className="w-full text-[13px] outline-none bg-transparent" />
        </label>
        <label className="flex items-center gap-1.5 h-[44px] bg-[#F3F3F5] rounded-xl px-2.5">
          <Users size={12} className="text-[#888780]" />
          <input type="number" value={capacity} onChange={(e) => setCapacity(+e.target.value)}
            className="w-full text-[13px] outline-none bg-transparent" />
        </label>
        <label className="flex items-center gap-1.5 h-[44px] bg-[#F3F3F5] rounded-xl px-2.5">
          <Wallet size={12} className="text-[#888780]" />
          <input type="number" value={price} onChange={(e) => setPrice(+e.target.value)}
            className="w-full text-[13px] outline-none bg-transparent" />
        </label>
      </div>
      <button onClick={submit} disabled={!title || !startsAt || loading}
        className={`h-[44px] rounded-xl text-[13px] ${title && startsAt ? "bg-[#0D0870] text-white" : "bg-[#E0E0E0] text-[#888780]"}`}
        style={{ fontWeight: 600 }}>
        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Créer la session"}
      </button>
    </div>
  );
}
