import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Stethoscope, MapPin, Shield, ChevronRight } from "lucide-react";
import { useAuth } from "../../lib/auth-context";

const slides = [
  {
    icon: Stethoscope,
    title: "Soins à domicile",
    subtitle: "Infirmiers, kinés, et professionnels de santé viennent chez vous en quelques minutes.",
    color: "#0D0870",
  },
  {
    icon: MapPin,
    title: "Vous fixez le prix",
    subtitle: "Comme InDrive, proposez votre tarif. Les professionnels acceptent ou font une contre-offre.",
    color: "#0D0870",
  },
  {
    icon: Shield,
    title: "Vérifiés & certifiés",
    subtitle: "Tous nos professionnels sont vérifiés : diplôme, CIN et avis patients contrôlés.",
    color: "#0D0870",
  },
];

export function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [step, setStep] = useState(0);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (loading) return;
    if (user && profile) {
      if (profile.role === "pro") {
        navigate("/nurse", { replace: true });
      } else if (profile.role === "patient") {
        navigate("/app", { replace: true });
      }
    }
  }, [user, profile, loading, navigate]);

  const next = () => {
    if (step < 2) setStep(step + 1);
    else navigate("/app");
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden" style={{ background: "linear-gradient(160deg, #0D0870 0%, #0D0870 60%, #25b882 100%)" }}>
      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/5" />
      <div className="absolute top-40 -left-16 w-40 h-40 rounded-full bg-white/5" />
      <div className="absolute bottom-20 -right-10 w-32 h-32 rounded-full bg-white/5" />

      {/* Skip */}
      <div className="flex justify-end px-6 pt-14">
        <button onClick={() => navigate("/app")} className="text-white/60 text-[13px]">
          Passer
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Logo */}
        <div className="mb-12">
          <h1 className="text-white text-[38px] tracking-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>
            CareLink
          </h1>
          <div className="w-8 h-1 bg-white/40 rounded-full mx-auto mt-1" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-6">
              {(() => {
                const Icon = slides[step].icon;
                return <Icon size={36} className="text-white" />;
              })()}
            </div>
            <h2 className="text-white text-[24px] mb-3" style={{ fontFamily: "'DM Serif Display', serif" }}>
              {slides[step].title}
            </h2>
            <p className="text-white/75 text-[15px] leading-relaxed max-w-[280px]">
              {slides[step].subtitle}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom */}
      <div className="px-8 pb-12">
        {/* Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: step === i ? 24 : 8,
                background: step === i ? "white" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        {step < 2 ? (
          <button
            onClick={next}
            className="w-full py-4 bg-white text-[#0D0870] rounded-2xl flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            style={{ fontWeight: 600 }}
          >
            Continuer
            <ChevronRight size={18} />
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate("/auth/patient")}
              className="w-full py-4 bg-white text-[#0D0870] rounded-2xl active:scale-[0.97] transition-transform"
              style={{ fontWeight: 600 }}
            >
              Je suis patient
            </button>
            <button
              onClick={() => navigate("/auth/pro")}
              className="w-full py-4 border-2 border-white/50 text-white rounded-2xl active:scale-[0.97] transition-transform"
              style={{ fontWeight: 500 }}
            >
              Je suis professionnel
            </button>
            <div className="flex items-center justify-center gap-4 mt-2">
              <button
                onClick={() => navigate("/admin")}
                className="text-white/40 text-[11px] underline"
              >
                Admin Panel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wave */}
      <svg className="absolute bottom-0 left-0 w-full pointer-events-none opacity-30" viewBox="0 0 375 80">
        <path d="M0 40C50 15 100 65 187.5 40C275 15 325 65 375 40V80H0Z" fill="white" />
      </svg>
    </div>
  );
}