import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, User, CreditCard, MapPin, Bell, Shield, Clock, LogOut, Star, Edit3, FileText, Loader2 } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useAuth } from "../../lib/auth-context";
import { getProfessional } from "../../lib/api";
import { geo } from "../../lib/db/geo";
import { toast } from "sonner";

const menuItems = [
  { icon: User, label: "Informations personnelles", color: "#0D0870" },
  { icon: FileText, label: "Mes documents", color: "#3B82F6" },
  { icon: CreditCard, label: "Compte bancaire", color: "#6BB8C8" },
  { icon: MapPin, label: "Zone de couverture", color: "#8B5CF6" },
  { icon: Clock, label: "Disponibilités", color: "#6BB8C8" },
  { icon: Bell, label: "Notifications", color: "#0D0870" },
  { icon: Shield, label: "Vérification", color: "#0D0870" },
];

export function NurseProfile() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [proData, setProData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    getProfessional(user.id)
      .then((data) => setProData(data.professional))
      .catch(() => setProData(null))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const [savingLoc, setSavingLoc] = useState(false);
  const handleSetLocation = async () => {
    if (!user?.id) return;
    setSavingLoc(true);
    try {
      const c = await geo.getCurrentPosition();
      await geo.setProLocation(user.id, c.lat, c.lng);
      toast.success("Zone de couverture mise à jour");
    } catch (e: any) {
      toast.error(e.message || "Impossible d'enregistrer votre position");
    } finally {
      setSavingLoc(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Déconnexion réussie");
    navigate("/");
  };

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : proData ? `${proData.firstName} ${proData.lastName}` : "Professionnel";
  const specialty = proData?.specialty || "Professionnel de santé";
  const rating = proData?.rating || 0;
  const reviewCount = proData?.reviewCount || 0;
  const isVerified = proData?.isVerified || false;
  const city = proData?.city || profile?.city || "";
  const availDays = proData?.availDays || [];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 size={28} className="text-[#0D0870] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 border-b border-[#F0F0F0]">
        <p className="text-[22px] text-[#1A1A1A] mb-5" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
          Mon profil pro
        </p>
        <div className="flex items-center gap-4">
          <div className="relative">
            {proData?.avatar ? (
              <ImageWithFallback
                src={proData.avatar}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#EDE5CC] flex items-center justify-center">
                <span className="text-[#0D0870] text-2xl font-bold">
                  {profile?.firstName?.[0]}{profile?.lastName?.[0]}
                </span>
              </div>
            )}
            <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#0D0870] rounded-full flex items-center justify-center border-2 border-white">
              <Edit3 size={10} className="text-white" />
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[17px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>{displayName}</p>
              {isVerified && <Shield size={14} className="text-[#0D0870]" />}
            </div>
            <p className="text-[13px] text-[#888780] capitalize">{specialty}</p>
            {city && <p className="text-[12px] text-[#B0B0B0]">{city}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-around mt-5 pt-4 border-t border-[#F0F0F0]">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Star size={14} className="text-amber-400" fill="#FBBF24" />
              <span className="text-[18px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>
                {rating > 0 ? rating.toFixed(1) : "—"}
              </span>
            </div>
            <p className="text-[11px] text-[#888780]">{reviewCount > 0 ? `${reviewCount} avis` : "Pas encore d'avis"}</p>
          </div>
          <div className="w-px h-8 bg-[#F0F0F0]" />
          <div className="text-center">
            <p className="text-[18px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>
              {proData?.minPrice ? `${proData.minPrice}+` : "—"}
            </p>
            <p className="text-[11px] text-[#888780]">MAD / soin</p>
          </div>
          <div className="w-px h-8 bg-[#F0F0F0]" />
          <div className="text-center">
            <p className="text-[18px]" style={{ fontWeight: 700, color: isVerified ? "#0D0870" : "#D97706" }}>
              {isVerified ? "Vérifié" : "En attente"}
            </p>
            <p className="text-[11px] text-[#888780]">Statut</p>
          </div>
        </div>
      </div>

      {/* Availability strip */}
      {availDays.length > 0 && (
        <div className="px-5 pt-4 pb-2">
          <p className="text-[12px] text-[#888780] mb-2" style={{ fontWeight: 500 }}>Disponibilités</p>
          <div className="flex gap-2 flex-wrap">
            {availDays.map((d: string) => (
              <span key={d} className="text-[11px] px-2.5 py-1 rounded-full bg-[#EDE5CC] text-[#0D0870]" style={{ fontWeight: 500 }}>
                {d}
              </span>
            ))}
            {proData?.startTime && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#F3F3F5] text-[#888780]" style={{ fontWeight: 500 }}>
                {proData.startTime} – {proData.endTime}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Set location */}
      <div className="px-5 pt-4">
        <button onClick={handleSetLocation} disabled={savingLoc}
          className="flex items-center gap-3 w-full px-4 py-3.5 bg-[#0D0870] text-white rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-60">
          {savingLoc ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
          <span className="text-[14px]" style={{ fontWeight: 600 }}>
            {savingLoc ? "Enregistrement…" : "Définir ma position GPS actuelle"}
          </span>
        </button>
        <p className="text-[11px] text-[#888780] mt-1.5 px-1">
          Permet aux patients de votre rayon de vous trouver via le matching géographique.
        </p>
      </div>

      {/* Menu */}
      <div className="px-5 pt-4 flex flex-col gap-1">
        {menuItems.map((item) => (
          <button key={item.label}
            className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 w-full text-left active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: item.color + "15" }}>
              <item.icon size={16} style={{ color: item.color }} />
            </div>
            <span className="flex-1 text-[14px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>{item.label}</span>
            <ChevronRight size={16} className="text-[#D0D0D0]" />
          </button>
        ))}
      </div>

      {/* Logout */}
      <div className="px-5 mt-4">
        <button onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-4 py-3.5 bg-[#FDE8E8] rounded-2xl active:scale-[0.98] transition-transform">
          <LogOut size={18} className="text-[#E24B4A]" />
          <span className="text-[14px] text-[#E24B4A]" style={{ fontWeight: 600 }}>Se déconnecter</span>
        </button>
      </div>
    </div>
  );
}
