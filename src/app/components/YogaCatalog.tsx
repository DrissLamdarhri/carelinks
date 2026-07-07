import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Clock, Users, Calendar, Heart } from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";

const filters = ["Tous", "Débutant", "Intermédiaire", "Avancé"];

export function YogaCatalog() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState(0);
  const [sessions, setSessions] = useState<any[]>([]);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Load yoga sessions from Supabase
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("yoga_sessions")
          .select("*")
          .gt("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(30);
        
        if (error) throw error;
        
        setSessions(data || []);
      } catch (err) {
        console.error("Error fetching yoga sessions:", err);
        toast.error("Erreur lors du chargement des séances");
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("yoga_catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "yoga_sessions" }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredSessions = activeFilter === 0 
    ? sessions 
    : sessions.filter(s => s.level === filters[activeFilter]);

  return (
    <div className="flex flex-col h-full bg-[#EDE5CC]">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-[#F0F0F0]">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[#F3F3F5] flex items-center justify-center">
            <ArrowLeft size={20} className="text-[#1A1A1A]" />
          </button>
          <span className="text-[18px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>Séances de Yoga</span>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map((f, i) => (
            <button
              key={f}
              onClick={() => setActiveFilter(i)}
              className={`px-4 py-2 rounded-full text-[13px] whitespace-nowrap transition-all ${
                i === activeFilter ? "bg-[#0D0870] text-white" : "bg-[#F3F3F5] text-[#888780]"
              }`}
              style={{ fontWeight: 500 }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-[#888780] text-center">
              <div className="text-[14px]">Chargement des séances...</div>
            </div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-[#888780] text-center">
              <div className="text-[14px]">Aucune séance disponible</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredSessions.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}
              >
                {/* Image */}
                <div className="h-36 relative overflow-hidden bg-[#F3F3F5]">
                  {s.address?.startsWith("data:image") ? (
                    <img src={s.address} alt={s.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#888780]">
                      Pas d'image
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className="absolute top-3 left-3 bg-white/90 text-[#1A1A1A] text-[11px] px-3 py-1 rounded-full" style={{ fontWeight: 500 }}>
                    {s.level || "Tous niveaux"}
                  </span>
                  <button
                    onClick={() => setLikes({ ...likes, [s.id]: !likes[s.id] })}
                    className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center"
                  >
                    <Heart size={16} className={likes[s.id] ? "text-[#E24B4A]" : "text-[#888780]"} fill={likes[s.id] ? "#E24B4A" : "none"} />
                  </button>
                </div>

                {/* Body */}
                <div className="p-4">
                  <p className="text-[16px] text-[#1A1A1A] mb-1" style={{ fontWeight: 600 }}>{s.title}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[12px] text-[#888780]">{s.description || "—"}</span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-[#888780] mb-3 flex-wrap">
                    <span className="flex items-center gap-1"><Clock size={12} />{s.duration_min || 60} min</span>
                    <span className="flex items-center gap-1"><Calendar size={12} />{new Date(s.starts_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="flex items-center gap-1 text-[#6BB8D4]"><Users size={12} />{s.capacity} places</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[18px] text-[#0D0870]" style={{ fontWeight: 700 }}>{s.price_mad} MAD</span>
                      <span className="text-[11px] text-[#888780]"> / séance</span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className="px-5 py-2.5 bg-[#0D0870] text-white rounded-xl text-[13px]"
                      style={{ fontWeight: 600 }}
                    >
                      Réserver
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
