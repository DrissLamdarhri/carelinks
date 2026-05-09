import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Star, Video, MessageCircle, MapPin } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { motion } from "motion/react";

const days = [
  { day: "Lun", num: 14, available: true },
  { day: "Mar", num: 15, available: true },
  { day: "Mer", num: 16, available: true },
  { day: "Jeu", num: 17, available: false },
  { day: "Ven", num: 18, available: true },
  { day: "Sam", num: 19, available: true },
  { day: "Dim", num: 20, available: false },
];

const slots = [
  { time: "09:00", taken: false },
  { time: "10:30", taken: false },
  { time: "14:00", taken: true },
  { time: "15:30", taken: false },
  { time: "16:00", taken: false },
  { time: "17:30", taken: true },
];

const consultTypes = [
  { label: "En personne", icon: MapPin, desc: "À son cabinet" },
  { label: "Vidéo", icon: Video, desc: "Consultation en ligne" },
  { label: "Chat", icon: MessageCircle, desc: "Messagerie" },
];

export function PsychologistBooking() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(2);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [consultType, setConsultType] = useState(0);

  const canConfirm = selectedSlot !== null;

  return (
    <div className="flex flex-col h-full bg-[#EDE5CC]">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-[#F0F0F0]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[#F3F3F5] flex items-center justify-center">
            <ArrowLeft size={20} className="text-[#1A1A1A]" />
          </button>
          <span className="text-[17px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>Prendre un RDV</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">
        {/* Doctor profile */}
        <div className="bg-white rounded-2xl p-5 mb-5" style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1621255612554-440c5e7b21b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmZW1hbGUlMjBwc3ljaG9sb2dpc3QlMjB0aGVyYXBpc3QlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzYwMDc2MjJ8MA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Dr. Mansouri"
                className="w-16 h-16 rounded-2xl object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#0D0870] rounded-full border-2 border-white" />
            </div>
            <div className="flex-1">
              <p className="text-[17px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>Dr. Dalila Mansouri</p>
              <p className="text-[13px] text-[#888780]">Psychologue Clinicienne</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-[12px]">
                  <Star size={12} className="text-amber-400" fill="#FBBF24" />
                  <span style={{ fontWeight: 600 }}>4.9</span>
                  <span className="text-[#888780]">(42)</span>
                </span>
                <span className="text-[12px] text-[#0D0870]" style={{ fontWeight: 500 }}>Disponible</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F0F0F0]">
            <span className="text-[13px] text-[#888780]">Consultation</span>
            <span className="text-[16px] text-[#0D0870]" style={{ fontWeight: 700 }}>200 MAD</span>
          </div>
        </div>

        {/* Consultation type */}
        <p className="text-[14px] text-[#1A1A1A] mb-3" style={{ fontWeight: 600 }}>Type de consultation</p>
        <div className="flex gap-2 mb-5">
          {consultTypes.map((ct, i) => (
            <button
              key={i}
              onClick={() => setConsultType(i)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
                consultType === i ? "border-[#0D0870] bg-[#EDE5CC]" : "border-[#F0F0F0] bg-white"
              }`}
            >
              <ct.icon size={18} className={consultType === i ? "text-[#0D0870]" : "text-[#888780]"} />
              <span className={`text-[11px] ${consultType === i ? "text-[#0D0870]" : "text-[#888780]"}`} style={{ fontWeight: 500 }}>
                {ct.label}
              </span>
            </button>
          ))}
        </div>

        {/* Date selection */}
        <p className="text-[14px] text-[#1A1A1A] mb-3" style={{ fontWeight: 600 }}>Choisir une date</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5">
          {days.map((d, i) => (
            <button
              key={i}
              onClick={() => d.available && setSelectedDay(i)}
              disabled={!d.available}
              className={`flex flex-col items-center px-3 py-2.5 rounded-2xl min-w-[50px] transition-all ${
                !d.available ? "bg-[#F3F3F5] text-[#D0D0D0]" :
                selectedDay === i ? "bg-[#0D0870] text-white" : "bg-white text-[#1A1A1A] border border-[#F0F0F0]"
              }`}
            >
              <span className="text-[10px] opacity-70">{d.day}</span>
              <span className="text-[17px]" style={{ fontWeight: 700 }}>{d.num}</span>
            </button>
          ))}
        </div>

        {/* Time slots */}
        <p className="text-[14px] text-[#1A1A1A] mb-3" style={{ fontWeight: 600 }}>Créneaux disponibles</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {slots.map((s, i) => (
            <button
              key={i}
              onClick={() => !s.taken && setSelectedSlot(i)}
              disabled={s.taken}
              className={`py-3.5 rounded-xl text-[14px] transition-all ${
                s.taken ? "bg-[#F3F3F5] text-[#D0D0D0] line-through" :
                selectedSlot === i ? "bg-[#0D0870] text-white" : "bg-white border border-[#E0E0E0] text-[#1A1A1A]"
              }`}
              style={{ fontWeight: 500 }}
            >
              {s.time}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="px-5 py-4 bg-white border-t border-[#F0F0F0]">
        <motion.button
          whileTap={canConfirm ? { scale: 0.97 } : {}}
          disabled={!canConfirm}
          onClick={() => navigate("/app/chat")}
          className={`w-full py-4 rounded-2xl text-[15px] transition-all ${
            canConfirm ? "bg-[#0D0870] text-white" : "bg-[#E0E0E0] text-[#888780]"
          }`}
          style={{ fontWeight: 600 }}
        >
          Confirmer — 200 MAD
        </motion.button>
      </div>
    </div>
  );
}
