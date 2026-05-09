import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, ChevronRight, Loader2, Stethoscope, Shield } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { GoogleButton } from "./GoogleButton";

export function ProLogin() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email, password);
      await refreshProfile();
      toast.success("Connexion réussie !");
      navigate("/nurse");
    } catch (err: any) {
      toast.error(err.message || "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  const valid = email.length > 0 && password.length > 0;

  return (
    <div className="h-full flex flex-col bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#0D0870] px-5 pt-12 pb-8 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute bottom-4 -left-8 w-24 h-24 rounded-full bg-white/5" />

        <button onClick={() => navigate("/")} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-6">
          <ArrowLeft size={20} className="text-white" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
            <Stethoscope size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-white text-[24px]" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
              Espace Pro
            </h1>
            <p className="text-white/60 text-[13px]">Infirmier · Psychologue · Kiné · Yoga</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 pt-6">
        <p className="text-[15px] text-[#1A1A1A] mb-5" style={{ fontWeight: 600 }}>
          Connectez-vous à votre compte professionnel
        </p>

        <div className="mb-4">
          <GoogleButton role="pro" label="Continuer avec Google" />
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 h-px bg-[#E0E0E0]" />
            <span className="text-[11px] text-[#888780]">ou avec email</span>
            <div className="flex-1 h-px bg-[#E0E0E0]" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Email professionnel</label>
            <div className="flex items-center h-[52px] bg-[#F3F3F5] rounded-xl px-4 gap-3">
              <Mail size={18} className="text-[#888780]" />
              <input
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="karim@carelink.ma" type="email"
                className="flex-1 h-full text-[14px] outline-none bg-transparent"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Mot de passe</label>
            <div className="flex items-center h-[52px] bg-[#F3F3F5] rounded-xl px-4 gap-3">
              <Lock size={18} className="text-[#888780]" />
              <input
                value={password} onChange={(e) => setPassword(e.target.value)}
                type={showPw ? "text" : "password"} placeholder="••••••••"
                className="flex-1 h-full text-[14px] outline-none bg-transparent"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={18} className="text-[#888780]" /> : <Eye size={18} className="text-[#888780]" />}
              </button>
            </div>
          </div>

          <button className="text-[13px] text-[#0D0870] text-right -mt-1" style={{ fontWeight: 500 }}>
            Mot de passe oublié ?
          </button>

          <motion.button
            whileTap={valid ? { scale: 0.97 } : {}}
            onClick={handleLogin}
            disabled={!valid || loading}
            className={`w-full py-4 rounded-2xl text-[15px] flex items-center justify-center gap-2 transition-all ${valid ? "bg-[#0D0870] text-white" : "bg-[#E0E0E0] text-[#888780]"}`}
            style={{ fontWeight: 600 }}
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <>Se connecter <ChevronRight size={18} /></>}
          </motion.button>
        </div>

        <div className="flex items-center gap-3 bg-[#EDE5CC] rounded-2xl p-4 mt-6">
          <Shield size={20} className="text-[#0D0870]" />
          <div>
            <p className="text-[13px] text-[#0D0870]" style={{ fontWeight: 600 }}>Compte vérifié requis</p>
            <p className="text-[11px] text-[#0D0870]/70">Seuls les professionnels approuvés peuvent se connecter</p>
          </div>
        </div>

        <div className="flex flex-col items-center mt-6 gap-3">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[#E0E0E0]" />
            <span className="text-[12px] text-[#888780]">Pas encore inscrit ?</span>
            <div className="flex-1 h-px bg-[#E0E0E0]" />
          </div>
          <button
            onClick={() => navigate("/register")}
            className="w-full py-3.5 border-2 border-[#0D0870] text-[#0D0870] rounded-2xl text-[14px] flex items-center justify-center gap-2"
            style={{ fontWeight: 600 }}
          >
            Créer un compte professionnel
          </button>
        </div>
      </div>
    </div>
  );
}
