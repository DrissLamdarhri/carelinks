import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, MapPin, Calendar, Minus, Plus, ChevronDown, Clock, Navigation, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { createRequest } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { geo } from "../../lib/db/geo";

const careTypes = ["Pansement", "Injection IM", "Injection SC", "Perfusion", "Bilan sanguin", "Soins post-op", "Sonde urinaire", "Kinésithérapie"];

function buildDates() {
  const result = [];
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    result.push({
      day: days[d.getDay()],
      num: String(d.getDate()).padStart(2, "0"),
      month: months[d.getMonth()],
      isoDate: d.toISOString().split("T")[0],
    });
  }
  return result;
}

const dates = buildDates();
const times = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

export function NurseBooking() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedTime, setSelectedTime] = useState(4);
  const [price, setPrice] = useState(120);
  const [careType, setCareType] = useState(0);
  const [showCareMenu, setShowCareMenu] = useState(false);
  const [address, setAddress] = useState(profile?.city ? `${profile.city}, ` : "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const captureLocation = async () => {
    setLocating(true);
    try {
      const c = await geo.getCurrentPosition();
      setCoords(c);
      toast.success("Position détectée");
    } catch {
      toast.error("Impossible d'obtenir votre position GPS");
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!address.trim()) { toast.error("Veuillez entrer votre adresse"); return; }
    setLoading(true);
    try {
      let gps = coords;
      if (!gps) {
        try { gps = await geo.getCurrentPosition(); setCoords(gps); } catch { /* optional */ }
      }
      const result = await createRequest({
        careType: careTypes[careType],
        dateStr: dates[selectedDate].isoDate,
        timeStr: times[selectedTime],
        address: address.trim(),
        city: profile?.city || "",
        proposedPrice: price,
        notes,
      });
      const supabaseBookingId = result?.request?.supabaseBookingId;
      if (gps && supabaseBookingId) {
        try { await geo.setBookingLocation(supabaseBookingId, gps.lat, gps.lng); } catch { /* non-blocking */ }
      }
      toast.success("Demande publiée ! En attente de professionnels…");
      navigate("/app/waiting", { state: { requestId: result.requestId, request: result.request, coords: gps } });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la publication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#EDE5CC]">
      {/* Map area */}
      <div className="relative flex-shrink-0" style={{ height: "35%" }}>
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-12 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
            <ArrowLeft size={20} className="text-[#1A1A1A]" />
          </button>
          <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center gap-2"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
            <MapPin size={16} className="text-[#0D0870]" />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Entrez votre adresse..."
              className="flex-1 text-[13px] text-[#1A1A1A] outline-none bg-transparent"
              style={{ fontWeight: 500 }}
            />
            <button onClick={captureLocation} disabled={locating}
              className="flex items-center gap-1 text-[11px] text-[#0D0870] disabled:opacity-50"
              style={{ fontWeight: 600 }}>
              {locating ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
              {coords ? "GPS ✓" : "GPS"}
            </button>
          </div>
        </div>

        {/* Stylized map */}
        <div className="w-full h-full bg-[#E8F0E8] relative overflow-hidden">
          <div className="absolute inset-0" style={{
            background: `repeating-linear-gradient(0deg, rgba(200,220,200,0.3) 0px, rgba(200,220,200,0.3) 1px, transparent 1px, transparent 24px),
              repeating-linear-gradient(90deg, rgba(200,220,200,0.3) 0px, rgba(200,220,200,0.3) 1px, transparent 1px, transparent 24px),
              linear-gradient(135deg, #d4e8d4 0%, #c5dfc5 50%, #d4e8d4 100%)`
          }} />
          <div className="absolute top-1/2 left-0 right-0 h-3 bg-white/40" />
          <div className="absolute top-0 bottom-0 left-1/2 w-3 bg-white/40" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10">
            <div className="flex flex-col items-center">
              <div className="bg-[#0D0870] text-white text-[10px] px-2 py-1 rounded-lg mb-1 whitespace-nowrap" style={{ fontWeight: 500 }}>
                Vous êtes ici
              </div>
              <div className="w-5 h-5 bg-[#0D0870] rounded-full border-3 border-white" />
              <div className="w-12 h-12 bg-[#0D0870]/10 rounded-full absolute top-6 animate-ping" />
            </div>
          </div>
          {[{ top: "28%", left: "22%" }, { top: "35%", left: "72%" }, { top: "65%", left: "30%" }].map((pos, i) => (
            <div key={i} className="absolute flex flex-col items-center" style={pos as any}>
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                <Navigation size={14} className="text-[#6BB8C8]" fill="#6BB8C8" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom sheet */}
      <motion.div initial={{ y: 20 }} animate={{ y: 0 }}
        className="flex-1 bg-white rounded-t-[28px] -mt-5 relative z-10 overflow-y-auto"
        style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.06)" }}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-[#E0E0E0] rounded-full" />
        </div>

        <div className="px-5 pb-6">
          <p className="text-[20px] text-[#1A1A1A] mb-4" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
            Votre demande
          </p>

          {/* Care type */}
          <div className="mb-4">
            <label className="text-[12px] text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Type de soin</label>
            <button onClick={() => setShowCareMenu(!showCareMenu)}
              className="w-full h-[52px] rounded-2xl border border-[#E0E0E0] px-4 flex items-center justify-between bg-white">
              <span className="text-[14px] text-[#1A1A1A]">{careTypes[careType]}</span>
              <ChevronDown size={18} className="text-[#888780]" />
            </button>
            {showCareMenu && (
              <div className="bg-white rounded-2xl border border-[#E0E0E0] mt-1 overflow-hidden" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
                {careTypes.map((t, i) => (
                  <button key={t} onClick={() => { setCareType(i); setShowCareMenu(false); }}
                    className={`w-full px-4 py-3 text-left text-[14px] border-b border-[#F0F0F0] last:border-0 ${i === careType ? "bg-[#EDE5CC] text-[#0D0870]" : "text-[#1A1A1A]"}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date chips */}
          <div className="mb-4">
            <label className="text-[12px] text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Date</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {dates.map((d, i) => (
                <button key={i} onClick={() => setSelectedDate(i)}
                  className={`flex flex-col items-center px-3 py-2 rounded-2xl min-w-[52px] transition-all ${selectedDate === i ? "bg-[#0D0870] text-white" : "bg-[#F3F3F5] text-[#1A1A1A]"}`}>
                  <span className="text-[10px] opacity-70">{d.day}</span>
                  <span className="text-[18px]" style={{ fontWeight: 700 }}>{d.num}</span>
                  <span className="text-[9px] opacity-60">{d.month}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time chips */}
          <div className="mb-4">
            <label className="text-[12px] text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Heure</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {times.map((t, i) => (
                <button key={t} onClick={() => setSelectedTime(i)}
                  className={`px-3 py-2 rounded-xl text-[13px] whitespace-nowrap transition-all ${selectedTime === i ? "bg-[#0D0870] text-white" : "bg-[#F3F3F5] text-[#1A1A1A]"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="text-[12px] text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Notes (optionnel)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: ordonnance disponible, allergie…"
              className="w-full bg-[#F3F3F5] rounded-2xl px-4 py-3 text-[13px] text-[#1A1A1A] outline-none resize-none"
              rows={2}
            />
          </div>

          {/* Price — InDrive style */}
          <div className="mb-5">
            <label className="text-[12px] text-[#888780] mb-2 block" style={{ fontWeight: 500 }}>
              Votre prix proposé <span className="text-[#0D0870]">(enchère inversée)</span>
            </label>
            <div className="bg-[#F3F3F5] rounded-2xl p-4 flex items-center justify-between">
              <button onClick={() => setPrice(Math.max(50, price - 10))}
                className="w-11 h-11 rounded-xl bg-white flex items-center justify-center active:scale-[0.95] transition-transform"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <Minus size={18} className="text-[#1A1A1A]" />
              </button>
              <div className="flex items-baseline gap-1">
                <span className="text-[36px] text-[#0D0870]" style={{ fontWeight: 800 }}>{price}</span>
                <span className="text-[14px] text-[#888780]" style={{ fontWeight: 500 }}>MAD</span>
              </div>
              <button onClick={() => setPrice(price + 10)}
                className="w-11 h-11 rounded-xl bg-white flex items-center justify-center active:scale-[0.95] transition-transform"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <Plus size={18} className="text-[#1A1A1A]" />
              </button>
            </div>
            <p className="text-[11px] text-[#888780] text-center mt-2">Prix moyen dans votre zone : 100–150 MAD</p>
          </div>

          {/* Submit */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={loading}
            className="w-full py-4 bg-[#0D0870] text-white rounded-2xl flex items-center justify-center gap-2 mb-2 disabled:opacity-70"
            style={{ fontWeight: 600 }}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
            {loading ? "Publication en cours…" : "Publier ma demande"}
          </motion.button>
          <p className="text-[11px] text-[#888780] text-center">
            Les professionnels de votre zone verront votre offre et pourront répondre
          </p>
        </div>
      </motion.div>
    </div>
  );
}
