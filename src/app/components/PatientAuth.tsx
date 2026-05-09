import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Mail, Lock, Eye, EyeOff, User, Phone, MapPin,
  ChevronRight, CheckCircle2, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { signUpPatient, signIn } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { GoogleButton } from "./GoogleButton";

const MOROCCAN_CITIES = [
  "Fès", "Casablanca", "Rabat", "Marrakech", "Agadir", "Tanger", "Meknès",
  "Oujda", "Salé", "Tétouan", "Kénitra", "Safi"
];

export function PatientAuth() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Signup fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Fès");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPw, setSignupPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email, password);
      await refreshProfile();
      toast.success("Connexion réussie !");
      navigate("/app");
    } catch (err: any) {
      toast.error(err.message || "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!firstName || !lastName || !phone || !signupEmail || !signupPw || !confirmPw || !agreed) return;
    if (signupPw !== confirmPw) { toast.error("Les mots de passe ne correspondent pas"); return; }
    if (signupPw.length < 6) { toast.error("Mot de passe trop court (min. 6 caractères)"); return; }
    setLoading(true);
    try {
      await signUpPatient({
        email: signupEmail, password: signupPw,
        firstName, lastName, phone, city,
      });
      // Auto sign-in after signup
      await signIn(signupEmail, signupPw);
      await refreshProfile();
      toast.success("Compte créé avec succès !");
      navigate("/app");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-2">
        <button onClick={() => navigate("/")} className="w-10 h-10 rounded-full bg-[#F3F3F5] flex items-center justify-center mb-4">
          <ArrowLeft size={20} className="text-[#1A1A1A]" />
        </button>
        <h1 className="text-[28px] text-[#1A1A1A] mb-1" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
          {mode === "login" ? "Bon retour !" : "Créer un compte"}
        </h1>
        <p className="text-[14px] text-[#888780] mb-4">
          {mode === "login" ? "Connectez-vous pour accéder à vos soins" : "Inscrivez-vous pour commencer à utiliser CareLink"}
        </p>
      </div>

      {/* Tabs */}
      <div className="mx-5 mb-5 flex bg-[#F3F3F5] rounded-xl p-1">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 rounded-lg text-[14px] transition-all ${mode === m ? "bg-white text-[#1A1A1A]" : "text-[#888780]"}`}
            style={{ fontWeight: mode === m ? 600 : 400, boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}
          >
            {m === "login" ? "Connexion" : "Inscription"}
          </button>
        ))}
      </div>

      {/* Google sign-in (always visible alongside email/password) */}
      <div className="px-5 pb-3">
        <GoogleButton role="patient" />
        <div className="flex items-center gap-3 mt-4 mb-1">
          <div className="flex-1 h-px bg-[#E0E0E0]" />
          <span className="text-[11px] text-[#888780]">ou avec email</span>
          <div className="flex-1 h-px bg-[#E0E0E0]" />
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Email</label>
                <div className="flex items-center h-[50px] bg-[#F3F3F5] rounded-xl px-4 gap-3">
                  <Mail size={18} className="text-[#888780]" />
                  <input
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com" type="email"
                    className="flex-1 h-full text-[14px] outline-none bg-transparent"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Mot de passe</label>
                <div className="flex items-center h-[50px] bg-[#F3F3F5] rounded-xl px-4 gap-3">
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

              <button className="text-[13px] text-[#0D0870] text-right" style={{ fontWeight: 500 }}>
                Mot de passe oublié ?
              </button>

              <motion.button
                whileTap={email && password ? { scale: 0.97 } : {}}
                onClick={handleLogin}
                disabled={!email || !password || loading}
                className={`w-full py-4 rounded-2xl text-[15px] flex items-center justify-center gap-2 mt-2 transition-all ${email && password ? "bg-[#0D0870] text-white" : "bg-[#E0E0E0] text-[#888780]"}`}
                style={{ fontWeight: 600 }}
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <>Se connecter <ChevronRight size={18} /></>}
              </motion.button>

              {/* Demo hint */}
              <div className="bg-[#EDE5CC] rounded-xl p-3 mt-1">
                <p className="text-[11px] text-[#0D0870]" style={{ fontWeight: 500 }}>
                  💡 Première visite ? Créez un compte via l'onglet "Inscription" ci-dessus.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="signup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-3">
              {/* Name row */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Prénom</label>
                  <div className="flex items-center h-[50px] bg-[#F3F3F5] rounded-xl px-4 gap-2">
                    <User size={16} className="text-[#888780]" />
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Driss"
                      className="flex-1 h-full text-[14px] outline-none bg-transparent" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Nom</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Alaoui"
                    className="w-full h-[50px] bg-[#F3F3F5] rounded-xl px-4 text-[14px] outline-none" />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Téléphone</label>
                <div className="flex items-center h-[50px] bg-[#F3F3F5] rounded-xl overflow-hidden">
                  <span className="px-3 text-[13px] text-[#888780] border-r border-[#E0E0E0]">+212</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6 12 34 56 78"
                    className="flex-1 h-full px-3 text-[14px] outline-none bg-transparent" type="tel" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Email</label>
                <div className="flex items-center h-[50px] bg-[#F3F3F5] rounded-xl px-4 gap-3">
                  <Mail size={16} className="text-[#888780]" />
                  <input value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="driss@email.com" type="email"
                    className="flex-1 h-full text-[14px] outline-none bg-transparent" />
                </div>
              </div>

              {/* City */}
              <div>
                <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Ville</label>
                <div className="flex items-center h-[50px] bg-[#F3F3F5] rounded-xl px-4 gap-3">
                  <MapPin size={16} className="text-[#888780]" />
                  <select value={city} onChange={(e) => setCity(e.target.value)}
                    className="flex-1 h-full text-[14px] outline-none bg-transparent">
                    {MOROCCAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Mot de passe</label>
                <div className="flex items-center h-[50px] bg-[#F3F3F5] rounded-xl px-4 gap-3">
                  <Lock size={16} className="text-[#888780]" />
                  <input value={signupPw} onChange={(e) => setSignupPw(e.target.value)}
                    type={showSignupPw ? "text" : "password"} placeholder="Min. 6 caractères"
                    className="flex-1 h-full text-[14px] outline-none bg-transparent" />
                  <button onClick={() => setShowSignupPw(!showSignupPw)}>
                    {showSignupPw ? <EyeOff size={16} className="text-[#888780]" /> : <Eye size={16} className="text-[#888780]" />}
                  </button>
                </div>
                {signupPw.length > 0 && (
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 3, 4].map((level) => (
                      <div key={level} className="flex-1 h-1 rounded-full"
                        style={{ background: signupPw.length >= level * 3 ? (signupPw.length >= 10 ? "#0D0870" : signupPw.length >= 6 ? "#6BB8C8" : "#E24B4A") : "#E0E0E0" }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Confirmer le mot de passe</label>
                <div className="flex items-center h-[50px] bg-[#F3F3F5] rounded-xl px-4 gap-3">
                  <Lock size={16} className="text-[#888780]" />
                  <input value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                    type="password" placeholder="••••••••"
                    className="flex-1 h-full text-[14px] outline-none bg-transparent" />
                  {confirmPw && confirmPw === signupPw && <CheckCircle2 size={18} className="text-[#0D0870]" />}
                </div>
                {confirmPw && confirmPw !== signupPw && (
                  <p className="text-[11px] text-[#E24B4A] mt-1">Les mots de passe ne correspondent pas</p>
                )}
              </div>

              {/* Terms */}
              <button onClick={() => setAgreed(!agreed)} className="flex items-start gap-3 mt-1">
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${agreed ? "bg-[#0D0870]" : "border-2 border-[#D0D0D0]"}`}>
                  {agreed && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <p className="text-[12px] text-[#888780] text-left leading-relaxed">
                  J'accepte les <span className="text-[#0D0870] underline">conditions d'utilisation</span> et la{" "}
                  <span className="text-[#0D0870] underline">politique de confidentialité</span>
                </p>
              </button>

              <motion.button
                whileTap={agreed && signupPw === confirmPw ? { scale: 0.97 } : {}}
                onClick={handleSignup}
                disabled={!firstName || !lastName || !phone || !signupEmail || !signupPw || signupPw !== confirmPw || !agreed || loading}
                className={`w-full py-4 rounded-2xl text-[15px] flex items-center justify-center gap-2 mt-1 transition-all ${firstName && lastName && phone && signupEmail && signupPw && signupPw === confirmPw && agreed ? "bg-[#0D0870] text-white" : "bg-[#E0E0E0] text-[#888780]"}`}
                style={{ fontWeight: 600 }}
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <>Créer mon compte <ChevronRight size={18} /></>}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
