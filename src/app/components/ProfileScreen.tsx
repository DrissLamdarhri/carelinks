import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, User, CreditCard, MapPin, Bell, Shield, HelpCircle, LogOut, Star, Edit3, Phone, MessageCircle, Loader2 } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useAuth } from "../../lib/auth-context";
import { getMyBookings } from "../../lib/api";
import { toast } from "sonner";

const menuSections = [
  {
    title: "Compte",
    items: [
      { icon: User, label: "Informations personnelles", color: "#0D0870" },
      { icon: CreditCard, label: "Paiement & Portefeuille", color: "#3B82F6" },
      { icon: MapPin, label: "Adresses enregistrées", color: "#6BB8C8" },
    ],
  },
  {
    title: "Préférences",
    items: [
      { icon: Bell, label: "Notifications", color: "#6BB8C8" },
      { icon: Shield, label: "Sécurité & Confidentialité", color: "#8B5CF6" },
    ],
  },
  {
    title: "Support",
    items: [
      { icon: HelpCircle, label: "Aide & FAQ", color: "#888780" },
    ],
  },
];

export function ProfileScreen() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    getMyBookings("patient")
      .then((data) => setBookings(data.bookings || []))
      .catch(() => setBookings([]))
      .finally(() => setStatsLoading(false));
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Déconnexion réussie");
    navigate("/");
  };

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : "Utilisateur";
  const initials = profile ? `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}` : "?";
  const email = profile?.email || "";
  const phone = profile?.phone || "";
  const city = profile?.city || "";

  // Compute stats from real bookings
  const totalBookings = bookings.length;
  const totalSpent = bookings.reduce((s, b) => s + (b.price || 0), 0);
  const ratedBookings = bookings.filter((b) => b.rating);
  const avgRating = ratedBookings.length > 0
    ? (ratedBookings.reduce((s, b) => s + b.rating, 0) / ratedBookings.length).toFixed(1)
    : null;

  return (
    <div className="flex flex-col h-full bg-[#EDE5CC]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 border-b border-[#F0F0F0]">
        <p className="text-[22px] text-[#1A1A1A] mb-5" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
          Mon profil
        </p>

        <div className="flex items-center gap-4">
          <div className="relative">
            {profile?.avatar ? (
              <ImageWithFallback
                src={profile.avatar}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#EDE5CC] flex items-center justify-center border-2 border-[#0D0870]/10">
                <span className="text-[#0D0870] text-2xl font-bold">{initials}</span>
              </div>
            )}
            <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#0D0870] rounded-full flex items-center justify-center border-2 border-white">
              <Edit3 size={10} className="text-white" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] text-[#1A1A1A] truncate" style={{ fontWeight: 600 }}>{displayName}</p>
            {email && <p className="text-[12px] text-[#888780] truncate">{email}</p>}
            <div className="flex items-center gap-2 mt-1">
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-1 text-[12px] text-[#0D0870]" style={{ fontWeight: 500 }}>
                  <Phone size={12} /> {phone}
                </a>
              )}
              {phone && (
                <a href={`https://wa.me/${phone.replace("+", "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] bg-[#25D366] text-white px-2 py-0.5 rounded-full">
                  <MessageCircle size={10} /> WA
                </a>
              )}
            </div>
            {city && <p className="text-[11px] text-[#B0B0B0]">{city}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-around mt-5 pt-4 border-t border-[#F0F0F0]">
          <div className="text-center">
            {statsLoading ? (
              <Loader2 size={16} className="text-[#0D0870] animate-spin mx-auto mb-1" />
            ) : (
              <p className="text-[18px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>{totalBookings}</p>
            )}
            <p className="text-[11px] text-[#888780]">Réservations</p>
          </div>
          <div className="w-px h-8 bg-[#F0F0F0]" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Star size={14} className="text-amber-400" fill="#FBBF24" />
              <p className="text-[18px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>
                {avgRating || "—"}
              </p>
            </div>
            <p className="text-[11px] text-[#888780]">Note moyenne</p>
          </div>
          <div className="w-px h-8 bg-[#F0F0F0]" />
          <div className="text-center">
            <p className="text-[18px] text-[#0D0870]" style={{ fontWeight: 700 }}>
              {statsLoading ? "…" : totalSpent.toLocaleString("fr-MA")}
            </p>
            <p className="text-[11px] text-[#888780]">MAD dépensés</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4">
        {menuSections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="text-[12px] text-[#888780] mb-2 uppercase tracking-wide" style={{ fontWeight: 600 }}>
              {section.title}
            </p>
            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              {section.items.map((item, i) => (
                <button
                  key={i}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#F5F5F5] last:border-0 active:bg-[#EDE5CC] transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${item.color}15` }}>
                    <item.icon size={18} style={{ color: item.color }} />
                  </div>
                  <span className="flex-1 text-left text-[14px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>
                    {item.label}
                  </span>
                  <ChevronRight size={16} className="text-[#D0D0D0]" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl text-[#E24B4A] text-[14px]"
          style={{ fontWeight: 500, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <LogOut size={18} />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
