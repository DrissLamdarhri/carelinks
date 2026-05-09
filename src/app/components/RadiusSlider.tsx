/**
 * RadiusSlider — pro adjusts service radius (km). Persists on professionals.
 */
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";

export function RadiusSlider() {
  const { user } = useAuth();
  const [km, setKm] = useState(10);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("professionals").select("service_radius_km").eq("id", user.id).single();
      if (data?.service_radius_km) setKm(data.service_radius_km);
    })();
  }, [user?.id]);

  const persist = async (v: number) => {
    if (!user) return;
    setSaved(false);
    const { error } = await supabase.from("professionals").update({ service_radius_km: v }).eq("id", user.id);
    if (error) toast.error(error.message); else setSaved(true);
  };

  return (
    <div className="bg-white rounded-2xl p-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-[#0D0870]" />
          <p className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>Rayon d'intervention</p>
        </div>
        <span className="text-[13px] text-[#0D0870]" style={{ fontWeight: 700 }}>{km} km</span>
      </div>
      <input type="range" min={1} max={50} value={km}
        onChange={(e) => setKm(+e.target.value)}
        onMouseUp={() => persist(km)} onTouchEnd={() => persist(km)}
        className="w-full accent-[#0D0870]" />
      <p className="text-[10px] text-[#888780] mt-1">{saved ? "Enregistré" : "Enregistrement…"}</p>
    </div>
  );
}
