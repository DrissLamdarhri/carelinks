/**
 * MobileDesignPreview — Design system parity page
 * Shows how the same CareLink tokens map from web (CSS vars) → mobile (NativeWind)
 * and renders live previews of each key screen inside phone frames.
 */

import { useState, type ReactNode } from "react";
import {
  Activity,
  Brain,
  Flower2,
  Heart,
  Bell,
  ChevronRight,
  Syringe,
  MapPin,
  Star,
  User,
  Home,
  BookOpen,
  Check,
  ArrowLeft,
  Send,
  MessageCircle,
  DollarSign,
  TrendingUp,
  Palette,
  Type,
  Smartphone,
  Globe,
} from "lucide-react";

// ─── Design token mapping ─────────────────────────────────────────────────────
const TOKENS = [
  { name: "Primary / Header",  hex: "#0D0870", css: "--color-primary",       nw: "bg-primary",  usage: "Header, CTAs, icônes" },
  { name: "Surface / Warm",    hex: "#EDE5CC", css: "--color-surface-warm",  nw: "bg-surface",  usage: "Fond contenu, cartes" },
  { name: "Mid / Accent",      hex: "#5BB8D4", css: "--color-accent",        nw: "bg-mid",      usage: "Badges, prix, liens" },
  { name: "Footer / Soft",     hex: "#8ECFDF", css: "--color-accent-light",  nw: "bg-accent",   usage: "Footer, highlights" },
  { name: "Text Primary",      hex: "#1A1A1A", css: "--color-text-primary",  nw: "text-gray-900", usage: "Corps de texte" },
  { name: "Text Muted",        hex: "#888780", css: "--color-text-muted",    nw: "text-muted",  usage: "Labels secondaires" },
];

type Screen = "login" | "patient" | "pro" | "chat" | "earnings";

const SCREENS: { id: Screen; label: string; portal: string }[] = [
  { id: "login",    label: "Login",             portal: "Auth"    },
  { id: "patient",  label: "Patient Dashboard", portal: "Patient" },
  { id: "pro",      label: "Pro Dashboard",     portal: "Pro"     },
  { id: "chat",     label: "Chat",              portal: "Patient" },
  { id: "earnings", label: "Revenus",           portal: "Pro"     },
];

// ─── Mock screens ─────────────────────────────────────────────────────────────

function LoginScreen() {
  const [tab, setTab]   = useState<"connexion" | "inscription">("connexion");
  const [role, setRole] = useState<"patient" | "pro">("patient");

  return (
    <div className="flex flex-col h-full" style={{ background: "#0D0870", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <h1 style={{ fontFamily: "'DM Serif Display', serif", color: "#EDE5CC", fontSize: 36, marginBottom: 6 }}>
          CareLink
        </h1>
        <p style={{ color: "#8ECFDF", fontSize: 13, textAlign: "center" }}>
          {role === "patient" ? "Accédez aux soins à domicile" : "Gérez vos consultations"}
        </p>
      </div>

      {/* Portal toggle */}
      <div className="mx-5 mb-6 flex rounded-2xl p-1" style={{ background: "#1A1585" }}>
        {(["patient", "pro"] as const).map((r) => (
          <button key={r} onClick={() => setRole(r)}
            className="flex-1 py-2 rounded-xl text-sm transition-all"
            style={{
              background: role === r ? "#EDE5CC" : "transparent",
              color: role === r ? "#0D0870" : "#8ECFDF",
              fontWeight: 500, border: "none", cursor: "pointer",
            }}>
            {r === "patient" ? "Patient" : "Professionnel"}
          </button>
        ))}
      </div>

      {/* Card */}
      <div className="mx-5 flex-1 rounded-3xl p-5" style={{ background: "#EDE5CC" }}>
        <button className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 mb-5"
          style={{ background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#4285F4" }}>G</span>
          <span style={{ color: "#374151", fontWeight: 500, fontSize: 13 }}>Continuer avec Google</span>
        </button>

        <div className="flex items-center mb-5 gap-3">
          <div className="flex-1 h-px" style={{ background: "#ccc" }} />
          <span style={{ color: "#888780", fontSize: 12 }}>ou</span>
          <div className="flex-1 h-px" style={{ background: "#ccc" }} />
        </div>

        <div className="flex rounded-xl p-0.5 mb-5" style={{ background: "#e5e0d0" }}>
          {(["connexion", "inscription"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-xs transition-all"
              style={{
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "#0D0870" : "#888780",
                fontWeight: 500, border: "none", cursor: "pointer",
              }}>
              {t === "connexion" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>

        {tab === "inscription" && (
          <input readOnly placeholder="Nom complet" className="w-full px-3 py-3 rounded-xl text-sm mb-3"
            style={{ background: "#f3f0e8", border: "none", color: "#1a1a1a", outline: "none" }} />
        )}
        <input readOnly placeholder="Email" className="w-full px-3 py-3 rounded-xl text-sm mb-3"
          style={{ background: "#f3f0e8", border: "none", color: "#1a1a1a", outline: "none" }} />
        <input readOnly type="password" placeholder="Mot de passe" className="w-full px-3 py-3 rounded-xl text-sm mb-5"
          style={{ background: "#f3f0e8", border: "none", color: "#1a1a1a", outline: "none" }} />

        <button className="w-full py-3.5 rounded-2xl text-sm"
          style={{ background: role === "patient" ? "#5BB8D4" : "#8ECFDF", color: "#0D0870", border: "none", cursor: "pointer", fontWeight: 500 }}>
          {tab === "connexion" ? "Se connecter" : "Créer un compte"}
        </button>
      </div>
      <div className="h-6" />
    </div>
  );
}

function PatientScreen() {
  const services = [
    { label: "Infirmier",   Icon: Syringe, color: "#0D0870", bg: "#EDE5CC" },
    { label: "Psychologue", Icon: Brain,   color: "#5BB8D4", bg: "#EFF8FB" },
    { label: "Kiné",        Icon: Heart,   color: "#0D0870", bg: "#EDE5CC" },
    { label: "Yoga",        Icon: Flower2, color: "#5BB8D4", bg: "#EFF8FB" },
  ];
  const bookings = [
    { title: "Infirmier",   status: "open",        statusLabel: "En attente", addr: "Bd Mohamed V, Fès" },
    { title: "Psychologue", status: "in_progress", statusLabel: "En cours",   addr: "En ligne" },
  ];
  const STATUS_COLORS: Record<string, string> = {
    open: "#F59E0B", in_progress: "#10B981", matched: "#5BB8D4",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#EDE5CC", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="px-5 pt-10 pb-6" style={{ background: "#0D0870" }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <p style={{ color: "rgba(237,229,204,0.7)", fontSize: 12 }}>Bonjour,</p>
            <p style={{ fontFamily: "'DM Serif Display', serif", color: "#EDE5CC", fontSize: 20 }}>Fatima</p>
          </div>
          <div className="relative p-2">
            <Bell size={20} color="#EDE5CC" strokeWidth={1.5} />
            <div className="absolute top-1 right-1 w-3 h-3 rounded-full flex items-center justify-center" style={{ background: "#EF4444" }}>
              <span style={{ color: "#fff", fontSize: 8, fontWeight: 700 }}>2</span>
            </div>
          </div>
        </div>
        <p style={{ color: "rgba(237,229,204,0.7)", fontSize: 12, marginBottom: 10 }}>Quel soin recherchez-vous ?</p>
        <div className="grid grid-cols-2 gap-2">
          {services.map((s) => (
            <div key={s.label} className="rounded-2xl p-3 flex flex-col items-center" style={{ background: s.bg }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1.5"
                style={{ background: s.color + "20" }}>
                <s.Icon size={18} color={s.color} strokeWidth={1.5} />
              </div>
              <span style={{ color: s.color, fontSize: 11, fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bookings */}
      <div className="flex-1 px-5 pt-4 overflow-auto">
        <div className="flex justify-between items-center mb-3">
          <span style={{ fontFamily: "'DM Serif Display', serif", color: "#0D0870", fontSize: 16 }}>
            Réservations actives
          </span>
          <span style={{ color: "#5BB8D4", fontSize: 11 }}>Voir tout</span>
        </div>
        {bookings.map((b) => (
          <div key={b.title} className="rounded-2xl p-4 mb-3 flex items-center gap-3"
            style={{ background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <div className="flex-1">
              <p style={{ color: "#0D0870", fontWeight: 500, fontSize: 13 }}>{b.title}</p>
              <p style={{ color: "#888780", fontSize: 11, marginTop: 2 }}>{b.addr}</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs"
              style={{
                background: (STATUS_COLORS[b.status] || "#888") + "20",
                color: STATUS_COLORS[b.status] || "#888",
                fontWeight: 500,
              }}>
              {b.statusLabel}
            </span>
            <ChevronRight size={14} color="#888780" />
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="flex border-t py-2 px-6 justify-around items-center"
        style={{ background: "#8ECFDF", borderColor: "rgba(0,0,0,0.08)" }}>
        {[
          { Icon: Home,          label: "Accueil", active: true  },
          { Icon: BookOpen,      label: "Soins",   active: false },
          { Icon: MessageCircle, label: "Chat",    active: false },
          { Icon: User,          label: "Profil",  active: false },
        ].map((n) => (
          <button key={n.label} className="flex flex-col items-center gap-0.5"
            style={{ background: "none", border: "none", cursor: "pointer" }}>
            <n.Icon size={20} color={n.active ? "#0D0870" : "rgba(13,8,112,0.5)"} strokeWidth={n.active ? 2 : 1.5} />
            <span style={{ fontSize: 9, color: n.active ? "#0D0870" : "rgba(13,8,112,0.5)", fontWeight: n.active ? 600 : 400 }}>
              {n.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProScreen() {
  const bids = [
    { name: "Khaled A.", distance: "1.2 km", price: 150, time: "Il y a 5 min"  },
    { name: "Nadia M.",  distance: "2.8 km", price: 120, time: "Il y a 12 min" },
    { name: "Omar B.",   distance: "0.9 km", price: 180, time: "Il y a 18 min" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#EDE5CC", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="px-5 pt-10 pb-5" style={{ background: "#0D0870" }}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <p style={{ color: "rgba(237,229,204,0.7)", fontSize: 12 }}>Tableau de bord</p>
            <p style={{ fontFamily: "'DM Serif Display', serif", color: "#EDE5CC", fontSize: 20 }}>Youssef, Inf.</p>
          </div>
          <div className="px-3 py-1 rounded-full flex items-center gap-1.5"
            style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)" }}>
            <div className="w-2 h-2 rounded-full" style={{ background: "#10B981" }} />
            <span style={{ color: "#10B981", fontSize: 10, fontWeight: 600 }}>Disponible</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Ce mois", value: "3 200 MAD", Icon: DollarSign },
            { label: "Missions", value: "18",       Icon: Activity   },
            { label: "Note",     value: "4.9 ★",    Icon: Star       },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(237,229,204,0.12)" }}>
              <s.Icon size={14} color="#8ECFDF" style={{ margin: "0 auto 4px" }} />
              <p style={{ color: "#EDE5CC", fontSize: 14, fontWeight: 600 }}>{s.value}</p>
              <p style={{ color: "rgba(237,229,204,0.6)", fontSize: 9 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 pt-4 overflow-auto">
        <p style={{ fontFamily: "'DM Serif Display', serif", color: "#0D0870", fontSize: 15, marginBottom: 10 }}>
          Nouvelles demandes
        </p>
        {bids.map((b, i) => (
          <div key={i} className="rounded-2xl p-4 mb-3"
            style={{ background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p style={{ color: "#0D0870", fontWeight: 500, fontSize: 13 }}>{b.name}</p>
                <p style={{ color: "#888780", fontSize: 11, marginTop: 1, display: "flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={10} />
                  {b.distance} · {b.time}
                </p>
              </div>
              <span style={{ color: "#5BB8D4", fontWeight: 600, fontSize: 15 }}>{b.price} MAD</span>
            </div>
            <button className="w-full py-2 rounded-xl text-xs"
              style={{ background: "#0D0870", color: "#EDE5CC", border: "none", cursor: "pointer", fontWeight: 500 }}>
              Soumettre une offre
            </button>
          </div>
        ))}
      </div>

      <div className="flex border-t py-2 px-6 justify-around items-center"
        style={{ background: "#8ECFDF", borderColor: "rgba(0,0,0,0.08)" }}>
        {[
          { Icon: Home,        label: "Accueil", active: true  },
          { Icon: BookOpen,    label: "Offres",  active: false },
          { Icon: TrendingUp,  label: "Revenus", active: false },
          { Icon: User,        label: "Profil",  active: false },
        ].map((n) => (
          <button key={n.label} className="flex flex-col items-center gap-0.5"
            style={{ background: "none", border: "none", cursor: "pointer" }}>
            <n.Icon size={20} color={n.active ? "#0D0870" : "rgba(13,8,112,0.5)"} strokeWidth={n.active ? 2 : 1.5} />
            <span style={{ fontSize: 9, color: n.active ? "#0D0870" : "rgba(13,8,112,0.5)", fontWeight: n.active ? 600 : 400 }}>
              {n.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatScreenMock() {
  const messages = [
    { from: "pro",     text: "Bonjour, je suis en route. Arrivée dans 15 min.", time: "14:22" },
    { from: "patient", text: "Parfait ! Je vous attends. Sonnez au 3ème étage.",  time: "14:23" },
    { from: "pro",     text: "D'accord, merci. À tout de suite 😊",               time: "14:23" },
    { from: "patient", text: "Est-ce que vous avez tout le matériel ?",            time: "14:25" },
    { from: "pro",     text: "Oui, j'ai tout ce qu'il faut pour la perfusion.",   time: "14:26" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "#EDE5CC", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="px-4 pt-10 pb-4 flex items-center gap-3" style={{ background: "#0D0870" }}>
        <ArrowLeft size={20} color="#EDE5CC" />
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#8ECFDF" }}>
          <User size={18} color="#0D0870" />
        </div>
        <div className="flex-1">
          <p style={{ color: "#EDE5CC", fontWeight: 500, fontSize: 14 }}>Youssef — Infirmier</p>
          <p style={{ color: "#8ECFDF", fontSize: 11 }}>En route · 15 min</p>
        </div>
        <div className="px-2.5 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.2)" }}>
          <span style={{ color: "#10B981", fontSize: 10, fontWeight: 600 }}>En cours</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-auto flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "patient" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[78%] rounded-2xl px-3 py-2.5"
              style={{
                background: m.from === "patient" ? "#0D0870" : "#fff",
                color: m.from === "patient" ? "#EDE5CC" : "#1a1a1a",
                fontSize: 12,
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              }}>
              <p>{m.text}</p>
              <p style={{ fontSize: 9, color: m.from === "patient" ? "rgba(237,229,204,0.6)" : "#888780", marginTop: 3, textAlign: "right" }}>
                {m.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 flex gap-2 items-center border-t" style={{ background: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
        <input readOnly placeholder="Votre message…" className="flex-1 px-3 py-2.5 rounded-2xl text-sm"
          style={{ background: "#f3f0e8", border: "none", outline: "none", color: "#1a1a1a" }} />
        <button className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "#0D0870", border: "none", cursor: "pointer" }}>
          <Send size={16} color="#EDE5CC" />
        </button>
      </div>
    </div>
  );
}

function EarningsScreen() {
  const months = [
    { m: "Jan", v: 2100 }, { m: "Fév", v: 2800 }, { m: "Mar", v: 2400 },
    { m: "Avr", v: 3200 }, { m: "Mai", v: 2900 }, { m: "Juin", v: 3600 },
  ];
  const maxV = Math.max(...months.map((x) => x.v));

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#EDE5CC", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="px-5 pt-10 pb-6" style={{ background: "#0D0870" }}>
        <p style={{ color: "rgba(237,229,204,0.7)", fontSize: 12, marginBottom: 4 }}>Revenus totaux</p>
        <p style={{ fontFamily: "'DM Serif Display', serif", color: "#EDE5CC", fontSize: 34, marginBottom: 2 }}>
          16 800 <span style={{ fontSize: 16 }}>MAD</span>
        </p>
        <p style={{ color: "#8ECFDF", fontSize: 12 }}>↑ +18% vs semestre précédent</p>
      </div>

      <div className="mx-5 mt-4 rounded-2xl p-4" style={{ background: "#fff" }}>
        <p style={{ color: "#0D0870", fontWeight: 500, fontSize: 13, marginBottom: 12 }}>Évolution mensuelle</p>
        <div className="flex items-end gap-2" style={{ height: 80 }}>
          {months.map((m) => (
            <div key={m.m} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-lg"
                style={{
                  height: (m.v / maxV) * 68,
                  background: m.m === "Juin" ? "#0D0870" : "#8ECFDF",
                  minHeight: 8,
                }} />
              <span style={{ fontSize: 9, color: "#888780" }}>{m.m}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-5 mt-4 rounded-2xl p-4 overflow-auto flex-1" style={{ background: "#fff" }}>
        <p style={{ color: "#0D0870", fontWeight: 500, fontSize: 13, marginBottom: 10 }}>Dernières missions</p>
        {[
          { name: "Khaled A.", type: "Perfusion", date: "Aujourd'hui", amount: 180 },
          { name: "Aicha B.",  type: "Pansement", date: "Hier",        amount: 120 },
          { name: "Omar R.",   type: "Injection",  date: "02/05",       amount: 90  },
        ].map((t, i) => (
          <div key={i} className="flex justify-between items-center py-2.5 border-b" style={{ borderColor: "#f3f0e8" }}>
            <div>
              <p style={{ color: "#1a1a1a", fontSize: 12, fontWeight: 500 }}>{t.name} — {t.type}</p>
              <p style={{ color: "#888780", fontSize: 10 }}>{t.date}</p>
            </div>
            <span style={{ color: "#10B981", fontSize: 14, fontWeight: 600 }}>+{t.amount} MAD</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Phone frame ──────────────────────────────────────────────────────────────
function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div style={{
        width: 240, height: 500,
        borderRadius: 36,
        border: "6px solid #1a1a1a",
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 10px 30px rgba(91,184,212,0.15)",
        background: "#EDE5CC",
        position: "relative",
      }}>
        {/* Notch */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 80, height: 18, borderRadius: "0 0 12px 12px",
          background: "#1a1a1a", zIndex: 50,
        }} />
        <div style={{ height: "100%", overflow: "hidden" }}>{children}</div>
      </div>
      <p className="mt-3 text-sm" style={{ color: "#EDE5CC", fontWeight: 500 }}>{label}</p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function MobileDesignPreview() {
  const [activeScreen, setActiveScreen] = useState<Screen>("login");
  const [activeTab, setActiveTab] = useState<"screens" | "tokens" | "typography">("screens");

  const screenMap: Record<Screen, ReactNode> = {
    login:    <LoginScreen />,
    patient:  <PatientScreen />,
    pro:      <ProScreen />,
    chat:     <ChatScreenMock />,
    earnings: <EarningsScreen />,
  };

  return (
    <div className="min-h-screen" style={{
      background: "linear-gradient(145deg, #050318 0%, #0D0870 50%, #0a2a5e 100%)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <Smartphone size={20} color="#8ECFDF" />
          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: "#EDE5CC", fontSize: 24 }}>
            CareLink — Design System
          </h1>
        </div>
        <p style={{ color: "rgba(237,229,204,0.6)", fontSize: 13 }}>
          Web (CSS vars) ↔ Mobile (NativeWind) — même palette, même typographie, même border-radius
        </p>
      </div>

      {/* Parity banner */}
      <div className="mx-8 mb-6 rounded-2xl p-4 flex items-start gap-4"
        style={{ background: "rgba(91,184,212,0.12)", border: "1px solid rgba(91,184,212,0.25)" }}>
        <Check size={20} color="#10B981" style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ color: "#EDE5CC", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Oui — design 100 % identique sur web et mobile
          </p>
          <p style={{ color: "rgba(237,229,204,0.7)", fontSize: 12, lineHeight: 1.7 }}>
            Les tokens de la palette (
            <code style={{ color: "#8ECFDF" }}>#0D0870</code>,{" "}
            <code style={{ color: "#8ECFDF" }}>#EDE5CC</code>,{" "}
            <code style={{ color: "#8ECFDF" }}>#5BB8D4</code>,{" "}
            <code style={{ color: "#8ECFDF" }}>#8ECFDF</code>
            ) sont définis en CSS vars dans <code style={{ color: "#8ECFDF" }}>theme.css</code> (web)
            et traduits en classes NativeWind dans <code style={{ color: "#8ECFDF" }}>mobile/tailwind.config.js</code>.
            La typographie DM Sans / DM Serif Display et le border-radius 16 px sont également partagés.
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mx-8 mb-6 flex gap-2 flex-wrap">
        {([
          { id: "screens"    as const, label: "Aperçus écrans", Icon: Smartphone },
          { id: "tokens"     as const, label: "Tokens couleur", Icon: Palette    },
          { id: "typography" as const, label: "Typographie",    Icon: Type       },
        ]).map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
            style={{
              background: activeTab === t.id ? "#EDE5CC" : "rgba(237,229,204,0.1)",
              color: activeTab === t.id ? "#0D0870" : "#EDE5CC",
              border: "none", cursor: "pointer", fontWeight: 500,
            }}>
            <t.Icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SCREENS ── */}
      {activeTab === "screens" && (
        <div className="px-8">
          {/* Screen selector */}
          <div className="flex gap-2 mb-8 flex-wrap">
            {SCREENS.map((s) => (
              <button key={s.id} onClick={() => setActiveScreen(s.id)}
                className="px-4 py-2 rounded-xl text-sm transition-all"
                style={{
                  background: activeScreen === s.id ? "#5BB8D4" : "rgba(237,229,204,0.1)",
                  color: activeScreen === s.id ? "#0D0870" : "#EDE5CC",
                  border: "none", cursor: "pointer", fontWeight: activeScreen === s.id ? 600 : 400,
                }}>
                <span style={{ opacity: 0.7, fontSize: 10, marginRight: 6 }}>[{s.portal}]</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Phone + tokens side-by-side */}
          <div className="flex gap-8 items-start flex-wrap">
            <PhoneFrame label={SCREENS.find((s) => s.id === activeScreen)?.label || ""}>
              {screenMap[activeScreen]}
            </PhoneFrame>

            <div className="flex-1" style={{ minWidth: 280 }}>
              <h3 style={{ color: "#8ECFDF", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                Tokens utilisés dans cet écran
              </h3>
              <div className="flex flex-col gap-3">
                {[
                  { role: "Header / fond",     web: "#0D0870",  native: "bg-primary",  hex: "#0D0870" },
                  { role: "Fond contenu",       web: "#EDE5CC",  native: "bg-surface",  hex: "#EDE5CC" },
                  { role: "Badges / prix",      web: "#5BB8D4",  native: "bg-mid",      hex: "#5BB8D4" },
                  { role: "Footer / nav",       web: "#8ECFDF",  native: "bg-accent",   hex: "#8ECFDF" },
                  { role: "Texte secondaire",   web: "#888780",  native: "text-muted",  hex: "#888780" },
                ].map((t, i) => (
                  <div key={i} className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: "rgba(237,229,204,0.06)", border: "1px solid rgba(237,229,204,0.1)" }}>
                    <div className="w-8 h-8 rounded-lg flex-shrink-0"
                      style={{ background: t.hex, border: "1px solid rgba(255,255,255,0.1)" }} />
                    <div className="flex-1">
                      <p style={{ color: "#EDE5CC", fontSize: 12, fontWeight: 500 }}>{t.role}</p>
                      <p style={{ color: "rgba(237,229,204,0.5)", fontSize: 10, marginTop: 2 }}>
                        Web: <code style={{ color: "#8ECFDF" }}>{t.web}</code>
                      </p>
                      <p style={{ color: "rgba(237,229,204,0.5)", fontSize: 10 }}>
                        Native: <code style={{ color: "#5BB8D4" }}>{t.native}</code>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* NativeWind snippet */}
              <div className="mt-6 rounded-xl p-4" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(91,184,212,0.2)" }}>
                <p style={{ color: "#8ECFDF", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  mobile/tailwind.config.js
                </p>
                <pre style={{ color: "#EDE5CC", fontSize: 11, lineHeight: 1.7, margin: 0, overflow: "auto" }}>{`colors: {
  primary: { DEFAULT: "#0D0870" },
  surface: "#EDE5CC",
  mid:     "#5BB8D4",
  accent:  { DEFAULT: "#8ECFDF" },
  muted:   "#888780",
}`}</pre>
              </div>
            </div>
          </div>

          {/* All screens gallery */}
          <div className="mt-12 mb-8">
            <h3 style={{ color: "#8ECFDF", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>
              Galerie — tous les écrans
            </h3>
            <div className="flex gap-6 overflow-x-auto pb-6">
              {SCREENS.map((s) => (
                <div key={s.id} onClick={() => setActiveScreen(s.id)} style={{ cursor: "pointer" }}>
                  <PhoneFrame label={s.label}>
                    {screenMap[s.id]}
                  </PhoneFrame>
                  {activeScreen === s.id && (
                    <div className="flex justify-center mt-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#5BB8D4" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TOKENS ── */}
      {activeTab === "tokens" && (
        <div className="px-8 pb-12">
          <h3 style={{ color: "#8ECFDF", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>
            Palette CareLink — Correspondance Web ↔ Mobile
          </h3>
          <div className="flex flex-col gap-4" style={{ maxWidth: 700 }}>
            {TOKENS.map((t) => (
              <div key={t.name} className="rounded-2xl overflow-hidden flex"
                style={{ border: "1px solid rgba(237,229,204,0.12)" }}>
                <div style={{ width: 96, background: t.hex, flexShrink: 0 }} />
                <div className="flex-1 p-4" style={{ background: "rgba(237,229,204,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p style={{ color: "#EDE5CC", fontWeight: 600, fontSize: 14 }}>{t.name}</p>
                    <code style={{ color: "#8ECFDF", fontSize: 12 }}>{t.hex}</code>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-2.5" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <p style={{ color: "rgba(237,229,204,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        <Globe size={8} style={{ display: "inline", marginRight: 3 }} />Web (CSS var)
                      </p>
                      <code style={{ color: "#EDE5CC", fontSize: 11 }}>{t.css}</code>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <p style={{ color: "rgba(237,229,204,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        <Smartphone size={8} style={{ display: "inline", marginRight: 3 }} />Mobile (NativeWind)
                      </p>
                      <code style={{ color: "#5BB8D4", fontSize: 11 }}>{t.nw}</code>
                    </div>
                  </div>
                  <p style={{ color: "rgba(237,229,204,0.4)", fontSize: 11, marginTop: 8 }}>Usage : {t.usage}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Shared architecture */}
          <div className="mt-10 rounded-2xl p-6" style={{ background: "rgba(237,229,204,0.06)", border: "1px solid rgba(237,229,204,0.12)", maxWidth: 700 }}>
            <p style={{ color: "#8ECFDF", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
              Architecture partagée
            </p>
            {[
              { file: "shared/db/types.ts",       desc: "Types TypeScript unifiés (Booking, Profile, Bid…)",   dot: "#5BB8D4" },
              { file: "shared/db/dal.ts",          desc: "Data Access Layer — même Supabase client",            dot: "#5BB8D4" },
              { file: "shared/auth-context.tsx",   desc: "AuthContext React — partagé web + native",            dot: "#5BB8D4" },
              { file: "shared/i18n.ts",            desc: "Traductions FR/AR partagées",                         dot: "#5BB8D4" },
              { file: "src/styles/theme.css",      desc: "Tokens CSS vars (web uniquement)",                    dot: "#8ECFDF" },
              { file: "mobile/tailwind.config.js", desc: "Même tokens → NativeWind classes (mobile uniquement)", dot: "#0D0870" },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor: "rgba(237,229,204,0.08)" }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.dot }} />
                <code style={{ color: "#8ECFDF", fontSize: 11, width: 220, flexShrink: 0 }}>{l.file}</code>
                <span style={{ color: "rgba(237,229,204,0.6)", fontSize: 12 }}>{l.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ���─ TYPOGRAPHY ── */}
      {activeTab === "typography" && (
        <div className="px-8 pb-12" style={{ maxWidth: 700 }}>
          <h3 style={{ color: "#8ECFDF", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>
            Typographie partagée
          </h3>

          <div className="rounded-2xl p-6 mb-4" style={{ background: "rgba(237,229,204,0.06)", border: "1px solid rgba(237,229,204,0.12)" }}>
            <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
              <div>
                <p style={{ color: "#EDE5CC", fontWeight: 600 }}>DM Serif Display</p>
                <p style={{ color: "rgba(237,229,204,0.5)", fontSize: 12 }}>Titres, noms, headers principaux</p>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(91,184,212,0.2)", color: "#5BB8D4" }}>Web: Google Fonts</span>
                <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(91,184,212,0.2)", color: "#5BB8D4" }}>Native: expo-font</span>
              </div>
            </div>
            {[
              { size: 36, label: "H1 — 36px", text: "Soins à domicile" },
              { size: 24, label: "H2 — 24px", text: "Vos réservations"  },
              { size: 20, label: "H3 — 20px", text: "Fatima Zahra"      },
            ].map((t) => (
              <div key={t.size} className="py-3 border-b flex items-baseline gap-4" style={{ borderColor: "rgba(237,229,204,0.08)" }}>
                <span style={{ color: "rgba(237,229,204,0.4)", fontSize: 10, width: 80, flexShrink: 0 }}>{t.label}</span>
                <span style={{ fontFamily: "'DM Serif Display', serif", color: "#EDE5CC", fontSize: t.size / 1.5 }}>{t.text}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-6" style={{ background: "rgba(237,229,204,0.06)", border: "1px solid rgba(237,229,204,0.12)" }}>
            <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
              <div>
                <p style={{ color: "#EDE5CC", fontWeight: 600 }}>DM Sans</p>
                <p style={{ color: "rgba(237,229,204,0.5)", fontSize: 12 }}>Corps, labels, boutons, inputs</p>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(91,184,212,0.2)", color: "#5BB8D4" }}>400 Regular</span>
                <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(91,184,212,0.2)", color: "#5BB8D4" }}>500 Medium</span>
              </div>
            </div>
            {[
              { weight: 400, label: "Regular 400",  text: "Votre infirmier arrive dans 15 minutes." },
              { weight: 500, label: "Medium 500",   text: "Continuer avec Google"                   },
              { weight: 600, label: "SemiBold 600", text: "180 MAD · Payé"                          },
            ].map((t) => (
              <div key={t.weight} className="py-3 border-b flex items-center gap-4" style={{ borderColor: "rgba(237,229,204,0.08)" }}>
                <span style={{ color: "rgba(237,229,204,0.4)", fontSize: 10, width: 110, flexShrink: 0 }}>{t.label}</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", color: "#EDE5CC", fontSize: 14, fontWeight: t.weight }}>{t.text}</span>
              </div>
            ))}

            <div className="mt-6">
              <p style={{ color: "#8ECFDF", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                Border Radius
              </p>
              <div className="flex gap-4 flex-wrap">
                {[
                  { r: 8,  label: "8px",  nw: "rounded-lg"  },
                  { r: 12, label: "12px", nw: "rounded-xl"  },
                  { r: 16, label: "16px", nw: "rounded-2xl" },
                  { r: 24, label: "24px", nw: "rounded-3xl" },
                ].map((b) => (
                  <div key={b.r} className="flex flex-col items-center gap-2">
                    <div style={{ width: 56, height: 40, background: "#5BB8D4", borderRadius: b.r }} />
                    <p style={{ color: "rgba(237,229,204,0.6)", fontSize: 10, textAlign: "center" }}>{b.label}</p>
                    <code style={{ color: "#8ECFDF", fontSize: 9 }}>{b.nw}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 60 }} />
    </div>
  );
}
