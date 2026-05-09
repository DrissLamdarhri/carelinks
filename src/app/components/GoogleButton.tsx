import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth-context";

export function GoogleButton({ role = "patient", label }: { role?: "patient" | "pro"; label?: string }) {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle(role);
    } catch (err: any) {
      toast.error(err?.message ?? "Connexion Google impossible");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="w-full h-[50px] bg-white border border-[#E0E0E0] rounded-2xl flex items-center justify-center gap-3 text-[14px] text-[#1A1A1A] hover:bg-[#FAFAFA] transition-colors"
      style={{ fontWeight: 500 }}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin text-[#888780]" />
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C40.9 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          {label ?? "Continuer avec Google"}
        </>
      )}
    </button>
  );
}
