import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Clock, Users, Calendar, Star, Heart } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { motion } from "motion/react";

const filters = ["Tous", "Débutant", "Intermédiaire", "Avancé"];

const sessions = [
  {
    name: "Hatha Flow Matinal",
    level: "Débutant",
    instructor: "Sara Bennani",
    instructorImg: "https://images.unsplash.com/photo-1612944095914-33fd0a85fcfc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMGRvY3RvciUyMGhlYWRzY2FyZiUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NzYxNjI4NzB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    duration: "60 min",
    price: 80,
    date: "18 Avr. — 09h00",
    spots: 4,
    rating: 4.8,
    gradient: "linear-gradient(135deg, #6BB8C8, #6BB8C8)",
    img: "https://images.unsplash.com/photo-1760774714285-61ff516f86c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b2dhJTIwY2xhc3MlMjBncm91cCUyMHN0cmV0Y2hpbmd8ZW58MXx8fHwxNzc2MTYyODY4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    liked: false,
  },
  {
    name: "Vinyasa Dynamique",
    level: "Intermédiaire",
    instructor: "Omar Tazi",
    instructorImg: "https://images.unsplash.com/photo-1758691463393-a2aa9900af8a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWxlJTIwZG9jdG9yJTIwc3RldGhvc2NvcGUlMjBzbWlsaW5nfGVufDF8fHx8MTc3NjE2Mjg3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    duration: "75 min",
    price: 100,
    date: "19 Avr. — 10h30",
    spots: 2,
    rating: 4.9,
    gradient: "linear-gradient(135deg, #E24B4A, #6BB8C8)",
    img: "https://images.unsplash.com/photo-1667890785988-8da12fd0989b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b2dhJTIwaW5zdHJ1Y3RvciUyMG1lZGl0YXRpb258ZW58MXx8fHwxNzc2MDA3NjIxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    liked: true,
  },
  {
    name: "Yin Yoga Profond",
    level: "Tous niveaux",
    instructor: "Nadia Filali",
    instructorImg: "https://images.unsplash.com/photo-1670191247079-f9713ae06dcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmZW1hbGUlMjBudXJzZSUyMGhlYWx0aGNhcmUlMjB3b3JrZXJ8ZW58MXx8fHwxNzc2MDA3NjIzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    duration: "90 min",
    price: 90,
    date: "20 Avr. — 18h00",
    spots: 6,
    rating: 4.7,
    gradient: "linear-gradient(135deg, #0D0870, #0D0870)",
    img: "https://images.unsplash.com/photo-1559185590-fcf099ac62c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaHlzaW90aGVyYXB5JTIwbWFzc2FnZSUyMHRyZWF0bWVudHxlbnwxfHx8fDE3NzYxNjI4Njh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    liked: false,
  },
];

export function YogaCatalog() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState(0);
  const [likes, setLikes] = useState<Record<number, boolean>>({ 1: true });

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
        <div className="flex flex-col gap-4">
          {sessions.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}
            >
              {/* Image */}
              <div className="h-36 relative overflow-hidden">
                <ImageWithFallback src={s.img} alt={s.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <span className="absolute top-3 left-3 bg-white/90 text-[#1A1A1A] text-[11px] px-3 py-1 rounded-full" style={{ fontWeight: 500 }}>
                  {s.level}
                </span>
                <button
                  onClick={() => setLikes({ ...likes, [i]: !likes[i] })}
                  className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center"
                >
                  <Heart size={16} className={likes[i] ? "text-[#E24B4A]" : "text-[#888780]"} fill={likes[i] ? "#E24B4A" : "none"} />
                </button>
                <div className="absolute bottom-3 left-3 flex items-center gap-1">
                  <Star size={12} className="text-amber-400" fill="#FBBF24" />
                  <span className="text-white text-[12px]" style={{ fontWeight: 600 }}>{s.rating}</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <p className="text-[16px] text-[#1A1A1A] mb-1" style={{ fontWeight: 600 }}>{s.name}</p>
                <div className="flex items-center gap-2 mb-3">
                  <ImageWithFallback src={s.instructorImg} alt={s.instructor} className="w-5 h-5 rounded-full object-cover" />
                  <span className="text-[12px] text-[#888780]">{s.instructor}</span>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-[#888780] mb-3">
                  <span className="flex items-center gap-1"><Clock size={12} />{s.duration}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} />{s.date}</span>
                  <span className="flex items-center gap-1 text-[#6BB8C8]"><Users size={12} />{s.spots} places</span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[18px] text-[#0D0870]" style={{ fontWeight: 700 }}>{s.price} MAD</span>
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
      </div>
    </div>
  );
}
