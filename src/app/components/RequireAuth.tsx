import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";

interface Props {
  children: ReactNode;
  role?: "patient" | "pro" | "admin";
  redirectTo?: string;
}

export function RequireAuth({ children, role, redirectTo }: Props) {
  const { user, profile, loading, isAdminAuthed } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#EDE5CC]">
        <Loader2 size={28} className="animate-spin text-[#0D0870]" />
      </div>
    );
  }

  if (role === "admin") {
    if (!isAdminAuthed) return <Navigate to="/admin" replace />;
    return <>{children}</>;
  }

  const fallback = redirectTo ?? (role === "pro" ? "/auth/pro" : "/auth/patient");
  if (!user) return <Navigate to={fallback} state={{ from: location.pathname }} replace />;

  if (role && profile && profile.role && profile.role !== role) {
    return <Navigate to={profile.role === "pro" ? "/nurse" : "/app"} replace />;
  }
  return <>{children}</>;
}
