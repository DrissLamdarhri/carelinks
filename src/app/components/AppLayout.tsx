import { Outlet, useNavigate, useLocation, Navigate } from "react-router";
import { Home, Search, CalendarDays, MessageCircle, User, Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { useEffect } from "react";

const tabs = [
  { icon: Home, label: "Accueil", path: "/app" },
  { icon: Search, label: "Explorer", path: "/app/yoga" },
  { icon: CalendarDays, label: "Mes RDV", path: "/app/bookings" },
  { icon: MessageCircle, label: "Chat", path: "/app/chat" },
  { icon: User, label: "Profil", path: "/app/profile" },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, profile } = useAuth();

  // Hide bottom nav on certain screens
  const hideNav = ["/app/request", "/app/waiting", "/app/offers", "/app/tracking", "/app/rating", "/app/chat"].some(
    (p) => location.pathname.startsWith(p)
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[#0D0870] flex items-center justify-center">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <Loader2 size={24} className="text-[#0D0870] animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/patient" replace />;
  }

  // If user is a pro, redirect to nurse portal
  if (profile?.role === "pro") {
    return <Navigate to="/nurse" replace />;
  }

  return (
    <div className="h-full flex flex-col bg-[#EDE5CC]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </div>
      {!hideNav && (
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
      )}
    </div>
  );
}
