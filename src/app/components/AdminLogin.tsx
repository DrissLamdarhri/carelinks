import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail, Lock, Eye, EyeOff, Shield, AlertCircle,
  Loader2, CheckCircle2, Activity
} from "lucide-react";

import { signIn } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";

export function AdminLogin() {
  const navigate = useNavigate();
  const { setAdminAuthed } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Real Supabase auth + admin role gate (no demo-credential fallback).
      await signIn(email, password);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Identifiants incorrects.");
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", u.user.id)
        .single();
      if (prof?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Ce compte n'a pas le rôle administrateur.");
      }
      setAdminAuthed(true);
      setSuccess(true);
      toast.success("Connecté en tant qu'admin CareLink !");
      setTimeout(() => navigate("/admin/dashboard"), 900);
    } catch (err: any) {
      setError(err.message || "Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#F4F6FB",
      }}
    >
      {/* ── Left panel (brand) ──────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between p-12 relative overflow-hidden flex-shrink-0"
        style={{
          background: "linear-gradient(160deg, #0D0870 0%, #0a065a 60%, #071650 100%)",
        }}
      >
        {/* Background decoration */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full" style={{ background: "rgba(91,184,212,0.12)" }} />
        <div className="absolute bottom-32 -left-16 w-60 h-60 rounded-full" style={{ background: "rgba(91,184,212,0.08)" }} />
        <div className="absolute top-1/2 right-12 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <Activity size={24} className="text-white" />
            </div>
            <div>
              <h1
                className="text-white text-2xl tracking-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                CareLink
              </h1>
              <p className="text-white/50 text-xs mt-0.5">Admin Dashboard</p>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
            style={{ background: "rgba(91,184,212,0.2)", border: "1px solid rgba(91,184,212,0.3)" }}
          >
            <Shield size={14} className="text-[#5BB8D4]" />
            <span className="text-[#5BB8D4] text-xs" style={{ fontWeight: 600 }}>
              Accès Sécurisé
            </span>
          </div>

          <h2
            className="text-white text-4xl xl:text-5xl mb-4 leading-tight"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Gérez votre plateforme de santé
          </h2>
          <p className="text-white/60 text-base leading-relaxed">
            Superviser les professionnels, patients, réservations et services depuis un tableau de bord centralisé.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-10">
            {[
              { value: "1,247", label: "Utilisateurs" },
              { value: "342", label: "Réservations" },
              { value: "4.8★", label: "Note moy." },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <p className="text-white text-xl mb-0.5" style={{ fontWeight: 700 }}>
                  {s.value}
                </p>
                <p className="text-white/50 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs">
            © 2025 CareLink · Plateforme de soins à domicile · Maroc
          </p>
        </div>
      </div>

      {/* ── Right panel (form) ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#0D0870" }}
            >
              <Activity size={20} className="text-white" />
            </div>
            <span
              className="text-[#0D0870] text-xl"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              CareLink Admin
            </span>
          </div>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center py-12"
              >
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
                  style={{ background: "#EDE5CC" }}
                >
                  <CheckCircle2 size={40} className="text-[#0D0870]" />
                </div>
                <h2 className="text-2xl text-[#1A1A1A] mb-2" style={{ fontWeight: 700 }}>
                  Bienvenue !
                </h2>
                <p className="text-[#888780]">Redirection vers le tableau de bord…</p>
                <div className="mt-6 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-[#0D0870]"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-3xl text-[#1A1A1A] mb-1" style={{ fontWeight: 700 }}>
                  Connexion Admin
                </h2>
                <p className="text-[#888780] mb-8 text-sm">
                  Accès réservé aux administrateurs CareLink
                </p>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 p-3 rounded-xl mb-4"
                      style={{ background: "#FDE8E8" }}
                    >
                      <AlertCircle size={16} className="text-[#E24B4A] flex-shrink-0" />
                      <p className="text-[#E24B4A] text-sm">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <div className="flex flex-col gap-4">
                  {/* Email */}
                  <div>
                    <label className="text-sm text-[#1A1A1A] mb-1.5 block" style={{ fontWeight: 500 }}>
                      Adresse email
                    </label>
                    <div
                      className="flex items-center h-14 rounded-2xl px-4 gap-3 transition-all"
                      style={{
                        background: "#F3F3F5",
                        border: "2px solid transparent",
                        outline: "none",
                      }}
                    >
                      <Mail size={18} className="text-[#888780] flex-shrink-0" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@carelink.ma"
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        className="flex-1 h-full text-sm outline-none bg-transparent text-[#1A1A1A] placeholder:text-[#B0B0B0]"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm text-[#1A1A1A]" style={{ fontWeight: 500 }}>
                        Mot de passe
                      </label>
                      <button className="text-xs text-[#0D0870]" style={{ fontWeight: 500 }}>
                        Mot de passe oublié ?
                      </button>
                    </div>
                    <div
                      className="flex items-center h-14 rounded-2xl px-4 gap-3"
                      style={{ background: "#F3F3F5" }}
                    >
                      <Lock size={18} className="text-[#888780] flex-shrink-0" />
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        className="flex-1 h-full text-sm outline-none bg-transparent text-[#1A1A1A]"
                      />
                      <button onClick={() => setShowPw(!showPw)} className="flex-shrink-0">
                        {showPw ? (
                          <EyeOff size={18} className="text-[#888780]" />
                        ) : (
                          <Eye size={18} className="text-[#888780]" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLogin}
                    disabled={loading}
                    className="h-14 rounded-2xl text-white flex items-center justify-center gap-2 mt-2 transition-all"
                    style={{
                      background: email && password
                        ? "linear-gradient(135deg, #0D0870 0%, #1A1585 100%)"
                        : "#D0D0D0",
                      fontSize: 15,
                      fontWeight: 600,
                      boxShadow: email && password
                        ? "0 8px 24px rgba(13,8,112,0.3)"
                        : "none",
                    }}
                  >
                    {loading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <>
                        <Shield size={18} />
                        Accéder au tableau de bord
                      </>
                    )}
                  </motion.button>
                </div>

                {/* Security notice */}
                <div className="flex items-center gap-2 mt-6 justify-center">
                  <Shield size={14} className="text-[#B0B0B0]" />
                  <p className="text-xs text-[#B0B0B0]">
                    Connexion sécurisée · Accès protégé
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}