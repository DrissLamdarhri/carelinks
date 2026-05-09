import { useState } from "react";
import { signUpPro, signIn } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import {
  ArrowLeft, Upload, FileText, CreditCard, Check, X, AlertTriangle, Camera,
  ChevronRight, ChevronDown, User, Phone, Mail, MapPin, Briefcase, Eye, EyeOff,
  Clock, Shield, CheckCircle2, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

const specialties = ["Pansement", "Injection", "Perfusion", "Bilan sanguin", "Soins post-op", "Sonde urinaire", "Kinésithérapie"];

export function NurseRegistration() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(0);

  // Step 0: Personal info
  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", email: "", city: "",
    experience: "", password: "", showPassword: false,
  });
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [showSpecMenu, setShowSpecMenu] = useState(false);

  // Step 1: Documents
  const [diploma, setDiploma] = useState(false);
  const [cin, setCin] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);

  // Step 2: Availability
  const [availDays, setAvailDays] = useState<string[]>(["Lun", "Mar", "Mer", "Ven"]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [minPrice, setMinPrice] = useState(80);
  const [maxDistance, setMaxDistance] = useState(10);

  // Step 3: Review & submit
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleUpload = (type: "diploma" | "cin" | "selfie") => {
    if (type === "diploma") { setDiploma(true); }
    if (type === "cin") { setCin(true); }
    if (type === "selfie") { setSelfie(true); }

    if ((type === "cin" && diploma) || (type === "diploma" && cin)) {
      setOcrRunning(true);
      setTimeout(() => { setOcrRunning(false); setOcrDone(true); }, 2000);
    }
  };

  const handleSubmit = async () => {
    if (!form.email || !form.password) { toast.error("Email et mot de passe requis"); return; }
    setSubmitting(true);
    try {
      await signUpPro({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        city: form.city,
        specialty: selectedSpecs[0] || "Infirmier",
        experience: form.experience,
        specialties: selectedSpecs,
        minPrice: minPrice,
        availDays,
        startTime,
        endTime,
      });
      toast.success("Dossier soumis ! En attente de validation.");
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'inscription");
    } finally {
      setSubmitting(false);
    }
  };

  const stepValid = [
    // Step 0: personal info
    form.firstName && form.lastName && form.phone && form.email && form.city && selectedSpecs.length > 0 && form.password,
    // Step 1: documents
    diploma && cin && selfie,
    // Step 2: availability
    availDays.length > 0,
    // Step 3: review
    agreed,
  ];

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  // =========== SUCCESS STATE ===========
  if (submitted) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white px-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-[#EDE5CC] flex items-center justify-center mb-6"
        >
          <CheckCircle2 size={48} className="text-[#0D0870]" />
        </motion.div>
        <h2 className="text-[24px] text-[#1A1A1A] mb-2 text-center" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
          Demande envoyée !
        </h2>
        <p className="text-[14px] text-[#888780] text-center mb-3 leading-relaxed">
          Votre dossier est en cours de vérification par notre équipe. Vous recevrez une notification dans les 24-48h.
        </p>
        <div className="w-full bg-[#F3F3F5] rounded-2xl p-4 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#0D0870]" />
            <span className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>Informations personnelles</span>
            <Check size={14} className="text-[#0D0870] ml-auto" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#0D0870]" />
            <span className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>Documents vérifiés</span>
            <Check size={14} className="text-[#0D0870] ml-auto" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#6BB8C8]" />
            <span className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>Validation admin</span>
            <Clock size={14} className="text-[#6BB8C8] ml-auto" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#D0D0D0]" />
            <span className="text-[13px] text-[#888780]">Activation du compte</span>
          </div>
        </div>
        <button onClick={() => navigate("/")} className="w-full py-4 bg-[#0D0870] text-white rounded-2xl" style={{ fontWeight: 600 }}>
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#EDE5CC]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-[#F0F0F0]">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => step > 0 ? setStep(step - 1) : navigate("/")} className="w-10 h-10 rounded-full bg-[#F3F3F5] flex items-center justify-center">
            <ArrowLeft size={20} className="text-[#1A1A1A]" />
          </button>
          <span className="text-[17px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>Inscription Professionnel</span>
          <span className="text-[13px] text-[#0D0870] px-2.5 py-1 rounded-full bg-[#EDE5CC]" style={{ fontWeight: 600 }}>
            {step + 1}/{totalSteps}
          </span>
        </div>
        {/* Progress bar */}
        <div className="flex gap-1.5">
          {Array(totalSteps).fill(0).map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-[#E0E0E0]">
              <motion.div
                className="h-full bg-[#0D0870] rounded-full"
                animate={{ width: i < step ? "100%" : i === step ? "50%" : "0%" }}
                transition={{ duration: 0.3 }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
        <AnimatePresence mode="wait">
          {/* ========== STEP 0: Personal Info ========== */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-[22px] text-[#1A1A1A] mb-1" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
                Vos informations
              </h2>
              <p className="text-[13px] text-[#888780] mb-5">Renseignez vos coordonnées professionnelles</p>

              {/* Avatar upload */}
              <div className="flex justify-center mb-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-[#EDE5CC] flex items-center justify-center">
                    <User size={32} className="text-[#0D0870]" />
                  </div>
                  <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#0D0870] rounded-full flex items-center justify-center border-2 border-white">
                    <Camera size={12} className="text-white" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {/* Name row */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Prénom</label>
                    <input
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      placeholder="Karim"
                      className="w-full h-[48px] bg-[#F3F3F5] rounded-xl px-4 text-[14px] outline-none focus:ring-2 focus:ring-[#0D0870]/20"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Nom</label>
                    <input
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      placeholder="Benali"
                      className="w-full h-[48px] bg-[#F3F3F5] rounded-xl px-4 text-[14px] outline-none focus:ring-2 focus:ring-[#0D0870]/20"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Téléphone</label>
                  <div className="flex items-center h-[48px] bg-[#F3F3F5] rounded-xl overflow-hidden">
                    <span className="px-3 text-[13px] text-[#888780] border-r border-[#E0E0E0]">+212</span>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="6 12 34 56 78"
                      className="flex-1 h-full px-3 text-[14px] outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Email</label>
                  <div className="flex items-center h-[48px] bg-[#F3F3F5] rounded-xl px-4 gap-2">
                    <Mail size={16} className="text-[#888780]" />
                    <input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="karim@email.com"
                      className="flex-1 h-full text-[14px] outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* City */}
                <div>
                  <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Ville</label>
                  <div className="flex items-center h-[48px] bg-[#F3F3F5] rounded-xl px-4 gap-2">
                    <MapPin size={16} className="text-[#888780]" />
                    <input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Fès"
                      className="flex-1 h-full text-[14px] outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Specialties */}
                <div>
                  <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Spécialités</label>
                  <button
                    onClick={() => setShowSpecMenu(!showSpecMenu)}
                    className="w-full h-[48px] bg-[#F3F3F5] rounded-xl px-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase size={16} className="text-[#888780]" />
                      <span className="text-[14px] text-[#888780]">
                        {selectedSpecs.length > 0 ? `${selectedSpecs.length} sélectionnées` : "Choisir..."}
                      </span>
                    </div>
                    <ChevronDown size={16} className="text-[#888780]" />
                  </button>
                  {showSpecMenu && (
                    <div className="mt-1 bg-white rounded-xl border border-[#E0E0E0] overflow-hidden" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                      {specialties.map((s) => {
                        const active = selectedSpecs.includes(s);
                        return (
                          <button
                            key={s}
                            onClick={() => setSelectedSpecs(active ? selectedSpecs.filter((x) => x !== s) : [...selectedSpecs, s])}
                            className="w-full px-4 py-3 flex items-center justify-between border-b border-[#F5F5F5] last:border-0"
                          >
                            <span className={`text-[13px] ${active ? "text-[#0D0870]" : "text-[#1A1A1A]"}`} style={{ fontWeight: active ? 600 : 400 }}>{s}</span>
                            {active && <Check size={16} className="text-[#0D0870]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedSpecs.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {selectedSpecs.map((s) => (
                        <span key={s} className="text-[10px] px-2.5 py-1 rounded-full bg-[#EDE5CC] text-[#0D0870] flex items-center gap-1" style={{ fontWeight: 500 }}>
                          {s}
                          <button onClick={() => setSelectedSpecs(selectedSpecs.filter((x) => x !== s))}>
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Experience */}
                <div>
                  <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Années d'expérience</label>
                  <input
                    value={form.experience}
                    onChange={(e) => setForm({ ...form, experience: e.target.value })}
                    placeholder="6"
                    type="number"
                    className="w-full h-[48px] bg-[#F3F3F5] rounded-xl px-4 text-[14px] outline-none focus:ring-2 focus:ring-[#0D0870]/20"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="text-[11px] text-[#888780] mb-1 block" style={{ fontWeight: 500 }}>Mot de passe</label>
                  <div className="flex items-center h-[48px] bg-[#F3F3F5] rounded-xl px-4 gap-2">
                    <input
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      type={form.showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="flex-1 h-full text-[14px] outline-none bg-transparent"
                    />
                    <button onClick={() => setForm({ ...form, showPassword: !form.showPassword })}>
                      {form.showPassword ? <EyeOff size={16} className="text-[#888780]" /> : <Eye size={16} className="text-[#888780]" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========== STEP 1: Documents ========== */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-[22px] text-[#1A1A1A] mb-1" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
                Documents officiels
              </h2>
              <p className="text-[13px] text-[#888780] mb-4">Téléchargez vos documents pour la vérification KYC</p>

              {/* Warning */}
              <div className="flex items-start gap-3 bg-[#EDE5CC] rounded-2xl p-4 mb-5">
                <AlertTriangle size={18} className="text-[#6BB8C8] mt-0.5 flex-shrink-0" />
                <p className="text-[12px] text-[#6BB8C8] leading-relaxed">
                  Les informations doivent correspondre entre votre CIN et votre diplôme. Nos algorithmes vérifient automatiquement.
                </p>
              </div>

              {/* Diploma upload */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleUpload("diploma")}
                className={`w-full border-2 border-dashed rounded-2xl p-5 flex items-center gap-4 mb-3 transition-all ${
                  diploma ? "border-[#0D0870] bg-[#EDE5CC]" : "border-[#D0D0D0] bg-white"
                }`}
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${diploma ? "bg-[#0D0870]" : "bg-[#F3F3F5]"}`}>
                  {diploma ? <Check size={24} className="text-white" /> : <FileText size={24} className="text-[#888780]" />}
                </div>
                <div className="text-left flex-1">
                  <p className="text-[15px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                    {diploma ? "Diplôme téléchargé ✓" : "Diplôme d'infirmier"}
                  </p>
                  <p className="text-[11px] text-[#888780]">Recto & verso · PDF ou image · max 5MB</p>
                  {diploma && <p className="text-[10px] text-[#0D0870] mt-1" style={{ fontWeight: 500 }}>diplome_infirmier_2019.pdf</p>}
                </div>
                {!diploma && <Upload size={18} className="text-[#888780]" />}
              </motion.button>

              {/* CIN upload */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleUpload("cin")}
                className={`w-full border-2 border-dashed rounded-2xl p-5 flex items-center gap-4 mb-3 transition-all ${
                  cin ? "border-[#0D0870] bg-[#EDE5CC]" : "border-[#D0D0D0] bg-white"
                }`}
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${cin ? "bg-[#0D0870]" : "bg-[#F3F3F5]"}`}>
                  {cin ? <Check size={24} className="text-white" /> : <CreditCard size={24} className="text-[#888780]" />}
                </div>
                <div className="text-left flex-1">
                  <p className="text-[15px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                    {cin ? "CIN téléchargée ✓" : "Carte d'Identité Nationale"}
                  </p>
                  <p className="text-[11px] text-[#888780]">Recto & verso · PDF ou image · max 5MB</p>
                  {cin && <p className="text-[10px] text-[#0D0870] mt-1" style={{ fontWeight: 500 }}>cin_recto_verso.jpg</p>}
                </div>
                {!cin && <Upload size={18} className="text-[#888780]" />}
              </motion.button>

              {/* Selfie */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleUpload("selfie")}
                className={`w-full border-2 border-dashed rounded-2xl p-5 flex items-center gap-4 mb-5 transition-all ${
                  selfie ? "border-[#0D0870] bg-[#EDE5CC]" : "border-[#D0D0D0] bg-white"
                }`}
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${selfie ? "bg-[#0D0870]" : "bg-[#F3F3F5]"}`}>
                  {selfie ? <Check size={24} className="text-white" /> : <Camera size={24} className="text-[#888780]" />}
                </div>
                <div className="text-left flex-1">
                  <p className="text-[15px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                    {selfie ? "Selfie pris ✓" : "Selfie de vérification"}
                  </p>
                  <p className="text-[11px] text-[#888780]">Photo avec votre CIN visible à côté de votre visage</p>
                </div>
                {!selfie && <Camera size={18} className="text-[#888780]" />}
              </motion.button>

              {/* OCR Results */}
              {ocrRunning && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl p-5 border border-[#E0E0E0] flex items-center gap-4">
                  <Loader2 size={24} className="text-[#0D0870] animate-spin" />
                  <div>
                    <p className="text-[14px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>Analyse en cours...</p>
                    <p className="text-[11px] text-[#888780]">Vérification OCR de vos documents</p>
                  </div>
                </motion.div>
              )}

              {ocrDone && !ocrRunning && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="bg-[#EDE5CC] rounded-2xl p-4 flex items-start gap-3 mb-4">
                    <CheckCircle2 size={18} className="text-[#0D0870] mt-0.5" />
                    <div>
                      <p className="text-[13px] text-[#0D0870]" style={{ fontWeight: 600 }}>Documents vérifiés automatiquement</p>
                      <p className="text-[11px] text-[#0D0870]/70">Les informations correspondent entre CIN et diplôme</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {[
                      { label: "Nom complet", value: form.firstName && form.lastName ? `${form.lastName} ${form.firstName}` : "Benali Karim", match: true },
                      { label: "N° CIN", value: "BE 847291", match: true },
                      { label: "N° Diplôme", value: "INF-2019-4827", match: true },
                      { label: "Date de naissance", value: "15/03/1992", match: true },
                    ].map((f) => (
                      <div key={f.label} className="flex items-center gap-3">
                        <div className="flex-1 bg-[#F3F3F5] rounded-xl px-4 py-3">
                          <p className="text-[10px] text-[#888780]" style={{ fontWeight: 500 }}>{f.label}</p>
                          <p className="text-[14px] text-[#1A1A1A]">{f.value}</p>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-[#0D0870] flex items-center justify-center">
                          <Check size={14} className="text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ========== STEP 2: Availability ========== */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-[22px] text-[#1A1A1A] mb-1" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
                Disponibilité & tarifs
              </h2>
              <p className="text-[13px] text-[#888780] mb-5">Configurez quand et où vous souhaitez travailler</p>

              {/* Days */}
              <p className="text-[14px] text-[#1A1A1A] mb-3" style={{ fontWeight: 600 }}>Jours de disponibilité</p>
              <div className="flex gap-2 mb-5">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => {
                  const active = availDays.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => setAvailDays(active ? availDays.filter((x) => x !== d) : [...availDays, d])}
                      className={`flex-1 py-3 rounded-xl text-[12px] transition-all ${
                        active ? "bg-[#0D0870] text-white" : "bg-[#F3F3F5] text-[#888780]"
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              {/* Hours */}
              <p className="text-[14px] text-[#1A1A1A] mb-3" style={{ fontWeight: 600 }}>Horaires de travail</p>
              <div className="flex gap-3 mb-5">
                <div className="flex-1">
                  <label className="text-[11px] text-[#888780] mb-1 block">De</label>
                  <div className="flex items-center h-[48px] bg-[#F3F3F5] rounded-xl px-4 gap-2">
                    <Clock size={16} className="text-[#888780]" />
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="flex-1 bg-transparent text-[14px] outline-none"
                    >
                      {["06:00", "07:00", "08:00", "09:00", "10:00"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-[#888780] mb-1 block">À</label>
                  <div className="flex items-center h-[48px] bg-[#F3F3F5] rounded-xl px-4 gap-2">
                    <Clock size={16} className="text-[#888780]" />
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="flex-1 bg-transparent text-[14px] outline-none"
                    >
                      {["16:00", "17:00", "18:00", "19:00", "20:00", "22:00"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Min price */}
              <p className="text-[14px] text-[#1A1A1A] mb-3" style={{ fontWeight: 600 }}>Tarif minimum accepté</p>
              <div className="bg-[#F3F3F5] rounded-2xl p-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] text-[#888780]">Minimum</span>
                  <span className="text-[20px] text-[#0D0870]" style={{ fontWeight: 700 }}>{minPrice} MAD</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={300}
                  step={10}
                  value={minPrice}
                  onChange={(e) => setMinPrice(Number(e.target.value))}
                  className="w-full accent-[#0D0870]"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[#888780]">40 MAD</span>
                  <span className="text-[10px] text-[#888780]">300 MAD</span>
                </div>
              </div>

              {/* Max distance */}
              <p className="text-[14px] text-[#1A1A1A] mb-3" style={{ fontWeight: 600 }}>Distance maximale de déplacement</p>
              <div className="bg-[#F3F3F5] rounded-2xl p-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] text-[#888780]">Rayon</span>
                  <span className="text-[20px] text-[#0D0870]" style={{ fontWeight: 700 }}>{maxDistance} km</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={maxDistance}
                  onChange={(e) => setMaxDistance(Number(e.target.value))}
                  className="w-full accent-[#0D0870]"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[#888780]">1 km</span>
                  <span className="text-[10px] text-[#888780]">30 km</span>
                </div>
              </div>

              {/* Zone preview */}
              <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EDE5CC] flex items-center justify-center">
                    <MapPin size={18} className="text-[#0D0870]" />
                  </div>
                  <div>
                    <p className="text-[14px] text-[#1A1A1A]" style={{ fontWeight: 500 }}>Zone de couverture</p>
                    <p className="text-[12px] text-[#888780]">{form.city || "Fès"} — rayon de {maxDistance} km</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========== STEP 3: Review & Submit ========== */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-[22px] text-[#1A1A1A] mb-1" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
                Récapitulatif
              </h2>
              <p className="text-[13px] text-[#888780] mb-5">Vérifiez vos informations avant de soumettre</p>

              {/* Profile summary */}
              <div className="bg-white rounded-2xl p-5 mb-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[#F5F5F5]">
                  <div className="w-14 h-14 rounded-full bg-[#EDE5CC] flex items-center justify-center">
                    <User size={24} className="text-[#0D0870]" />
                  </div>
                  <div>
                    <p className="text-[16px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                      {form.firstName || "Karim"} {form.lastName || "Benali"}
                    </p>
                    <p className="text-[12px] text-[#888780]">{form.email || "karim@email.com"}</p>
                    <p className="text-[12px] text-[#888780]">+212 {form.phone || "6 12 34 56 78"}</p>
                  </div>
                </div>

                {[
                  { label: "Ville", value: form.city || "Fès" },
                  { label: "Expérience", value: `${form.experience || "6"} ans` },
                  { label: "Spécialités", value: selectedSpecs.length > 0 ? selectedSpecs.join(", ") : "Pansement, Injection" },
                  { label: "Disponibilité", value: `${availDays.join(", ")} · ${startTime}–${endTime}` },
                  { label: "Tarif minimum", value: `${minPrice} MAD` },
                  { label: "Zone", value: `${maxDistance} km autour de ${form.city || "Fès"}` },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-[#F5F5F5] last:border-0">
                    <span className="text-[12px] text-[#888780]">{item.label}</span>
                    <span className="text-[13px] text-[#1A1A1A] text-right max-w-[55%]" style={{ fontWeight: 500 }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Documents status */}
              <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <p className="text-[13px] text-[#1A1A1A] mb-3" style={{ fontWeight: 600 }}>Documents</p>
                {[
                  { name: "Diplôme d'infirmier", ok: diploma },
                  { name: "Carte d'identité", ok: cin },
                  { name: "Selfie de vérification", ok: selfie },
                  { name: "Vérification OCR", ok: ocrDone },
                ].map((d) => (
                  <div key={d.name} className="flex items-center gap-3 py-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${d.ok ? "bg-[#0D0870]" : "bg-[#E0E0E0]"}`}>
                      {d.ok ? <Check size={12} className="text-white" /> : <X size={12} className="text-white" />}
                    </div>
                    <span className="text-[13px] text-[#1A1A1A]">{d.name}</span>
                  </div>
                ))}
              </div>

              {/* Terms */}
              <button
                onClick={() => setAgreed(!agreed)}
                className="flex items-start gap-3 bg-white rounded-2xl p-4 mb-3"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${agreed ? "bg-[#0D0870]" : "border-2 border-[#D0D0D0]"}`}>
                  {agreed && <Check size={12} className="text-white" />}
                </div>
                <p className="text-[12px] text-[#888780] text-left leading-relaxed">
                  J'accepte les <span className="text-[#0D0870] underline">conditions générales</span> et la{" "}
                  <span className="text-[#0D0870] underline">politique de confidentialité</span> de CareLink.
                  Je certifie que toutes les informations fournies sont exactes.
                </p>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom */}
      <div className="px-5 py-4 bg-white border-t border-[#F0F0F0]">
        <motion.button
          whileTap={stepValid[step] ? { scale: 0.97 } : {}}
          disabled={!stepValid[step]}
          onClick={() => {
            if (step < 3) setStep(step + 1);
            else handleSubmit();
          }}
          className={`w-full py-4 rounded-2xl text-[15px] flex items-center justify-center gap-2 transition-all ${
            stepValid[step] ? "bg-[#0D0870] text-white" : "bg-[#E0E0E0] text-[#888780]"
          }`}
          style={{ fontWeight: 600 }}
        >
          {submitting ? (
            <><Loader2 size={20} className="animate-spin" /> Envoi en cours...</>
          ) : step < 3 ? (
            <>Continuer <ChevronRight size={18} /></>
          ) : (
            <>Soumettre ma candidature</>
          )}
        </motion.button>
      </div>
    </div>
  );
}
