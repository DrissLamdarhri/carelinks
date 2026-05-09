import { Outlet, useNavigate, useLocation, Navigate } from "react-router";
import { Home, CalendarDays, Banknote, User, Loader2, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { useState, useEffect } from "react";
import { getProfessional } from "../../lib/api";

const tabs = [
  { icon: Home, label: "Demandes", path: "/nurse" },
  { icon: CalendarDays, label: "Planning", path: "/nurse/schedule" },
  { icon: Banknote, label: "Revenus", path: "/nurse/earnings" },
  { icon: User, label: "Profil", path: "/nurse/profile" },
];

export function NurseLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, profile } = useAuth();
  const [proProfile, setProProfile] = useState<any>(null);
  const [proLoading, setProLoading] = useState(true);

  // Load the detailed pro profile (which has isPending, isVerified, isRejected)
  useEffect(() => {
    if (!user?.id) { setProLoading(false); return; }
    getProfessional(user.id)
      .then((data) => setProProfile(data.professional))
      .catch(() => setProProfile(null))
      .finally(() => setProLoading(false));
  }, [user?.id]);

  if (loading || proLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <Loader2 size={28} className="text-[#0D0870] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/pro" replace />;
  }

  // Show pending approval screen
  if (proProfile?.isPending && !proProfile?.isVerified) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white px-8 text-center"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="w-20 h-20 rounded-full bg-[#EDE5CC] flex items-center justify-center mb-5">
          <Clock size={36} className="text-[#0D0870]" />
        </div>
        <h2 className="text-[22px] text-[#1A1A1A] mb-2" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
          Compte en attente
        </h2>
        <p className="text-[14px] text-[#888780] mb-6 leading-relaxed">
          Votre dossier est en cours de vérification par notre équipe. Vous serez notifié dès validation (24–48h).
        </p>
        <div className="w-full bg-[#EDE5CC] rounded-2xl p-4 mb-8 text-left">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 rounded-full bg-[#0D0870]" />
            <span className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>Informations personnelles ✓</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 rounded-full bg-[#0D0870]" />
            <span className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>Documents soumis ✓</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#5BB8D4] animate-pulse" />
            <span className="text-[13px] text-[#5BB8D4]" style={{ fontWeight: 500 }}>Validation admin en cours…</span>
          </div>
        </div>
        <button
          onClick={() => { navigate("/"); }}
          className="w-full py-4 border-2 border-[#0D0870] text-[#0D0870] rounded-2xl text-[14px]"
          style={{ fontWeight: 600 }}
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  // Show rejected screen
  if (proProfile?.isRejected) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white px-8 text-center"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="w-20 h-20 rounded-full bg-[#FDE8E8] flex items-center justify-center mb-5">
          <AlertCircle size={36} className="text-[#E24B4A]" />
        </div>
        <h2 className="text-[22px] text-[#1A1A1A] mb-2" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
          Dossier non approuvé
        </h2>
        <p className="text-[14px] text-[#888780] mb-6 leading-relaxed">
          Votre dossier n'a pas été approuvé. Contactez le support pour plus d'informations.
        </p>
        <a href="mailto:support@carelink.ma"
          className="w-full py-4 bg-[#0D0870] text-white rounded-2xl text-[14px] block text-center"
          style={{ fontWeight: 600 }}>
          Contacter le support
        </a>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#EDE5CC]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </div>
      <div className="flex-shrink-0 bg-white border-t border-[#F0F0F0] px-2 pt-2 pb-5">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <button key={tab.label} onClick={() => navigate(tab.path)}
                className="flex flex-col items-center gap-1 active:scale-[0.95] transition-transform min-w-[56px]">
                <div className={`p-1.5 rounded-xl transition-colors ${active ? "bg-[#EDE5CC]" : ""}`}>
                  <tab.icon size={22} className={active ? "text-[#0D0870]" : "text-[#B0B0B0]"} strokeWidth={active ? 2.2 : 1.8} />
                </div>
                <span className={`text-[10px] ${active ? "text-[#0D0870]" : "text-[#B0B0B0]"}`} style={{ fontWeight: active ? 600 : 400 }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
