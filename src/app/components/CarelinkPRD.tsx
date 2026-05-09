/**
 * CareLink — Product Requirements Document (PRD) + Implementation Roadmap
 * This screen is accessible at /admin/prd for internal reference.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, ChevronDown, ChevronRight,
  Database, Shield, Zap, Smartphone, Globe, Activity, Users, ArrowLeft,
  Code, Server, Wifi, Star, Bell, Map
} from "lucide-react";

type Status = "done" | "in_progress" | "todo" | "blocked";

const statusConfig: Record<Status, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  done:        { icon: CheckCircle2, color: "#16A34A", bg: "#DCFCE7", label: "Fait" },
  in_progress: { icon: Clock,        color: "#D97706", bg: "#FEF3C7", label: "En cours" },
  todo:        { icon: Circle,        color: "#888780", bg: "#F3F3F5", label: "À faire" },
  blocked:     { icon: AlertTriangle, color: "#E24B4A", bg: "#FDE8E8", label: "Bloqué" },
};

function Badge({ status }: { status: Status }) {
  const s = statusConfig[status];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
      style={{ background: s.bg, color: s.color, fontWeight: 600 }}>
      <s.icon size={11} />
      {s.label}
    </span>
  );
}

const PHASES = [
  {
    phase: "Phase 0 — Infrastructure & Auth",
    emoji: "🏗️",
    color: "#0D0870",
    bg: "#EDE5CC",
    status: "done" as Status,
    tasks: [
      { task: "Supabase project créé + clés configurées", status: "done" as Status },
      { task: "Schéma SQL documenté (12 tables: users, pros, requests, offers, bookings, reviews, etc.)", status: "done" as Status },
      { task: "Client Supabase singleton (/src/lib/supabase.ts)", status: "done" as Status },
      { task: "AuthContext multi-rôles (patient / pro / admin)", status: "done" as Status },
      { task: "API helpers frontend (/src/lib/api.ts)", status: "done" as Status },
      { task: "Hono server avec routes complètes (/supabase/functions/server/index.tsx)", status: "done" as Status },
      { task: "KV Store structure pour toutes les entités", status: "done" as Status },
      { task: "CORS + logger + auth middleware serveur", status: "done" as Status },
    ],
  },
  {
    phase: "Phase 1 — Portail Patient (MVP)",
    emoji: "📱",
    color: "#0891B2",
    bg: "#D8F0F4",
    status: "done" as Status,
    tasks: [
      { task: "Écran Onboarding (CTA patient/pro)", status: "done" as Status },
      { task: "PatientAuth: signup + login réels Supabase Auth", status: "done" as Status },
      { task: "PatientDashboard: données réelles (pros, booking à venir)", status: "done" as Status },
      { task: "NurseBooking: création de demande réelle + InDrive price picker", status: "done" as Status },
      { task: "WaitingOffers: polling 5s + Realtime broadcast + compteur offres", status: "done" as Status },
      { task: "NurseOffers: accepter/refuser offres réelles", status: "done" as Status },
      { task: "MyBookings: historique réel (confirmé / terminé / annulé)", status: "done" as Status },
      { task: "ProfileScreen: données réelles + déconnexion", status: "done" as Status },
      { task: "AppLayout: garde d'auth + redirection", status: "done" as Status },
    ],
  },
  {
    phase: "Phase 2 — Portail Professionnel",
    emoji: "🏥",
    color: "#5B21B6",
    bg: "#EDE9FE",
    status: "done" as Status,
    tasks: [
      { task: "ProLogin: connexion réelle Supabase Auth", status: "done" as Status },
      { task: "NurseRegistration: inscription réelle (KYC multi-étapes)", status: "done" as Status },
      { task: "NurseDashboard: demandes en temps réel (polling + Realtime)", status: "done" as Status },
      { task: "Accepter/Contre-offre/Refuser demandes patient", status: "done" as Status },
      { task: "Toggle Online/Offline avec persistance", status: "done" as Status },
      { task: "Planning: mes RDV confirmés", status: "done" as Status },
      { task: "NurseEarnings: revenus calculés depuis bookings réels", status: "in_progress" as Status },
      { task: "NurseProfile: édition profil + spécialités", status: "in_progress" as Status },
      { task: "NurseLayout: garde d'auth", status: "done" as Status },
    ],
  },
  {
    phase: "Phase 3 — Admin Dashboard",
    emoji: "⚙️",
    color: "#0D0870",
    bg: "#EDE5CC",
    status: "in_progress" as Status,
    tasks: [
      { task: "AdminLogin: auth sécurisée (email admin + clé API)", status: "done" as Status },
      { task: "Stats dashboard: KPIs réels (patients, pros, bookings, revenue)", status: "done" as Status },
      { task: "Approbation pros en attente (liste réelle + approve/reject API)", status: "done" as Status },
      { task: "Gestion services/catalogue (CRUD local, persistance KV en cours)", status: "in_progress" as Status },
      { task: "Liste réservations récentes (API endpoint)", status: "in_progress" as Status },
      { task: "Gestion utilisateurs patients (liste + suspension)", status: "todo" as Status },
      { task: "Tableau de bord Yoga (sessions + inscriptions)", status: "todo" as Status },
    ],
  },
  {
    phase: "Phase 4 — Realtime & Notifications",
    emoji: "⚡",
    color: "#D97706",
    bg: "#FEF3C7",
    status: "in_progress" as Status,
    tasks: [
      { task: "Supabase Realtime broadcast: nouvelle offre → patient notifié", status: "done" as Status },
      { task: "Supabase Realtime broadcast: nouvelle demande → pro notifié", status: "done" as Status },
      { task: "Polling fallback 5-10s si Realtime indisponible", status: "done" as Status },
      { task: "Push notifications web (service worker)", status: "todo" as Status },
      { task: "SMS OTP via Twilio (+212 format E.164)", status: "todo" as Status },
      { task: "WhatsApp Business API pour notifications", status: "todo" as Status },
      { task: "Système de notifications in-app (badge + liste)", status: "todo" as Status },
    ],
  },
  {
    phase: "Phase 5 — Paiement & Financier",
    emoji: "💳",
    color: "#059669",
    bg: "#DCFCE7",
    status: "todo" as Status,
    tasks: [
      { task: "Intégration CMI (Centre Monétique Interbancaire Maroc)", status: "todo" as Status },
      { task: "Intégration Stripe (cartes Visa/Mastercard)", status: "todo" as Status },
      { task: "Portefeuille numérique patient (solde + recharger)", status: "todo" as Status },
      { task: "Paiement espèces à la livraison (COD flow)", status: "todo" as Status },
      { task: "Factures PDF automatiques par email", status: "todo" as Status },
      { task: "Virement automatique pro (Virement bancaire MAD)", status: "todo" as Status },
      { task: "Commission plateforme 15% (prélèvement automatique)", status: "todo" as Status },
    ],
  },
  {
    phase: "Phase 6 — Géolocalisation & Carte",
    emoji: "🗺️",
    color: "#0891B2",
    bg: "#D8F0F4",
    status: "todo" as Status,
    tasks: [
      { task: "Intégration Google Maps JS SDK", status: "todo" as Status },
      { task: "Localisation GPS du patient (navigator.geolocation)", status: "todo" as Status },
      { task: "Afficher pros sur carte (markers custom)", status: "todo" as Status },
      { task: "Calcul distance patient ↔ pro (Google Distance Matrix)", status: "todo" as Status },
      { task: "Suivi en temps réel du pro vers patient (Realtime positions)", status: "todo" as Status },
      { task: "Rayon de recherche configurable (5/10/20 km)", status: "todo" as Status },
      { task: "PostGIS sur Supabase pour requêtes spatiales (ST_DWithin)", status: "todo" as Status },
    ],
  },
  {
    phase: "Phase 7 — Chat & Téléconsultation",
    emoji: "💬",
    color: "#7C3AED",
    bg: "#EDE9FE",
    status: "todo" as Status,
    tasks: [
      { task: "Chat texte patient ↔ pro (Supabase Realtime channels)", status: "todo" as Status },
      { task: "Partage de photos/documents dans le chat", status: "todo" as Status },
      { task: "Appel téléphonique via `tel:+212...` (V1 - natif)", status: "done" as Status },
      { task: "Bouton WhatsApp `https://wa.me/212...` (V1)", status: "done" as Status },
      { task: "Vidéo consultation (WebRTC / Twilio Video)", status: "todo" as Status },
      { task: "Archivage conversations (chiffrement E2E)", status: "todo" as Status },
    ],
  },
  {
    phase: "Phase 8 — Qualité & Production",
    emoji: "🚀",
    color: "#E24B4A",
    bg: "#FDE8E8",
    status: "todo" as Status,
    tasks: [
      { task: "Tests unitaires (Vitest) sur composants critiques", status: "todo" as Status },
      { task: "Tests E2E (Playwright) : flux complet patient + pro", status: "todo" as Status },
      { task: "Row Level Security (RLS) sur toutes les tables Supabase", status: "todo" as Status },
      { task: "Rate limiting API (Hono middleware)", status: "todo" as Status },
      { task: "Monitoring erreurs (Sentry)", status: "todo" as Status },
      { task: "Analytics utilisateurs (Mixpanel / PostHog)", status: "todo" as Status },
      { task: "RGPD / Loi 09-08 Maroc : bannière cookies + export données", status: "todo" as Status },
      { task: "App mobile React Native (Expo) iOS + Android", status: "todo" as Status },
      { task: "Déploiement CDN (Cloudflare Pages / Vercel)", status: "todo" as Status },
    ],
  },
];

const TECH_STACK = [
  { icon: Smartphone, label: "Frontend", value: "React 18 + TypeScript + Vite", color: "#0891B2" },
  { icon: Globe, label: "Routing", value: "React Router v7 (Data Mode)", color: "#7C3AED" },
  { icon: Activity, label: "UI", value: "Tailwind CSS v4 + Motion (Framer)", color: "#059669" },
  { icon: Server, label: "Backend", value: "Supabase Edge Functions (Hono / Deno)", color: "#0D0870" },
  { icon: Database, label: "Base de données", value: "KV Store (PostgreSQL via Supabase)", color: "#D97706" },
  { icon: Shield, label: "Auth", value: "Supabase Auth (email + social)", color: "#E24B4A" },
  { icon: Wifi, label: "Realtime", value: "Supabase Realtime (broadcast channels)", color: "#6BB8C8" },
  { icon: Bell, label: "Notifications", value: "Sonner toasts + Web Push (à venir)", color: "#8B5CF6" },
  { icon: Map, label: "Cartes", value: "CSS stylisé V1 → Google Maps V2", color: "#16A34A" },
  { icon: Star, label: "Système enchères", value: "InDrive reverse-bidding (KV store)", color: "#F59E0B" },
];

const KPIS = [
  { label: "Temps de réponse pro", target: "< 5 min", current: "Objectif V1" },
  { label: "Taux de conversion demande→booking", target: "> 70%", current: "À mesurer" },
  { label: "Note moyenne pros", target: "> 4.5/5", current: "À mesurer" },
  { label: "Temps chargement page", target: "< 2s (3G)", current: "~1.2s (WiFi)" },
  { label: "Uptime serveur", target: "99.9%", current: "Supabase SLA" },
  { label: "Villes couvertes Maroc V1", target: "12 villes", current: "Configuré" },
];

export function CarelinePRD() {
  const navigate = useNavigate();
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([0, 1, 2, 3]));

  const togglePhase = (i: number) => {
    const s = new Set(expandedPhases);
    s.has(i) ? s.delete(i) : s.add(i);
    setExpandedPhases(s);
  };

  const totalTasks = PHASES.flatMap((p) => p.tasks).length;
  const doneTasks = PHASES.flatMap((p) => p.tasks).filter((t) => t.status === "done").length;
  const inProgressTasks = PHASES.flatMap((p) => p.tasks).filter((t) => t.status === "in_progress").length;
  const progress = Math.round((doneTasks / totalTasks) * 100);

  return (
    <div className="min-h-screen bg-[#F4F6FB]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#0D0870] px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/admin/dashboard")}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="text-white text-2xl" style={{ fontFamily: "'DM Serif Display', serif" }}>
              CareLink PRD & Roadmap
            </h1>
            <p className="text-white/50 text-sm">Product Requirements Document · v1.2 · Avril 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-white text-2xl font-bold">{progress}%</p>
            <p className="text-white/50 text-xs">complété</p>
          </div>
          <div className="w-20 h-20 relative">
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#5BB8D4" strokeWidth="3"
                strokeDasharray={`${progress} ${100 - progress}`} strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Tâches totales", value: totalTasks, color: "#0D0870", bg: "#EDE5CC" },
            { label: "Complétées", value: doneTasks, color: "#16A34A", bg: "#DCFCE7" },
            { label: "En cours", value: inProgressTasks, color: "#D97706", bg: "#FEF3C7" },
            { label: "Phases", value: PHASES.length, color: "#7C3AED", bg: "#EDE9FE" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <p className="text-3xl mb-1" style={{ color: s.color, fontWeight: 800 }}>{s.value}</p>
              <p className="text-sm text-[#888780]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tech stack */}
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <h2 className="text-lg text-[#1A1A1A] mb-4 flex items-center gap-2" style={{ fontWeight: 700 }}>
            <Code size={20} className="text-[#0D0870]" />
            Stack Technique
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {TECH_STACK.map((t) => (
              <div key={t.label} className="flex flex-col gap-1 p-3 rounded-xl" style={{ background: `${t.color}10` }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <t.icon size={14} style={{ color: t.color }} />
                  <span className="text-[11px] text-[#888780]">{t.label}</span>
                </div>
                <p className="text-[12px] text-[#1A1A1A]" style={{ fontWeight: 600, lineHeight: 1.4 }}>{t.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <h2 className="text-lg text-[#1A1A1A] mb-4 flex items-center gap-2" style={{ fontWeight: 700 }}>
            <Activity size={20} className="text-[#0D0870]" />
            KPIs Cibles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {KPIS.map((k) => (
              <div key={k.label} className="flex items-start justify-between p-3 rounded-xl bg-[#F8F8FC]">
                <div>
                  <p className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>{k.label}</p>
                  <p className="text-[12px] text-[#888780]">{k.current}</p>
                </div>
                <span className="text-[12px] px-2 py-0.5 rounded-full bg-[#EDE5CC] text-[#0D0870]"
                  style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{k.target}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Phases */}
        <div className="flex flex-col gap-4">
          {PHASES.map((phase, i) => {
            const done = phase.tasks.filter((t) => t.status === "done").length;
            const expanded = expandedPhases.has(i);
            return (
              <div key={i} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                <button onClick={() => togglePhase(i)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F8F8FC] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: phase.bg }}>{phase.emoji}</div>
                    <div className="text-left">
                      <p className="text-[15px] text-[#1A1A1A]" style={{ fontWeight: 700 }}>{phase.phase}</p>
                      <p className="text-[12px] text-[#888780]">{done}/{phase.tasks.length} tâches complétées</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Mini progress */}
                    <div className="w-20 h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(done / phase.tasks.length) * 100}%`, background: phase.color }} />
                    </div>
                    <Badge status={phase.status} />
                    {expanded ? <ChevronDown size={18} className="text-[#888780]" /> : <ChevronRight size={18} className="text-[#888780]" />}
                  </div>
                </button>

                {expanded && (
                  <div className="px-6 pb-4 border-t border-[#F0F0F0]">
                    <div className="flex flex-col gap-2 pt-3">
                      {phase.tasks.map((task, j) => {
                        const s = statusConfig[task.status];
                        return (
                          <div key={j} className="flex items-start gap-3 py-1.5">
                            <s.icon size={16} style={{ color: s.color, flexShrink: 0, marginTop: 2 }} />
                            <p className="text-[13px] text-[#1A1A1A] flex-1">{task.task}</p>
                            <Badge status={task.status} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Architecture note */}
        <div className="bg-[#EDE5CC] rounded-2xl p-6 mt-6">
          <h2 className="text-[#0D0870] text-lg mb-3 flex items-center gap-2" style={{ fontWeight: 700 }}>
            <Database size={20} />
            Note sur la Base de Données
          </h2>
          <p className="text-[#0D0870]/80 text-sm leading-relaxed">
            L'architecture actuelle utilise le <strong>KV Store de Supabase</strong> (table kv_store_aa5d1aa6) 
            comme couche de persistance flexible, idéale pour le prototypage rapide. Le schéma SQL complet 
            avec 12 tables PostgreSQL (PostGIS, RLS, triggers, vues matérialisées) a été généré dans 
            <code className="mx-1 px-1.5 py-0.5 rounded bg-[#0D0870]/10 text-[#0D0870] font-mono text-xs">/supabase/schema.sql</code>
            et doit être exécuté manuellement dans le <strong>Supabase SQL Editor</strong> pour migrer vers 
            la base relationnelle complète avant la mise en production.
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            {["users", "professionals", "requests", "offers", "bookings", "reviews", "notifications", "services", "yoga_sessions", "availability", "audit_log", "kyc_documents"].map((t) => (
              <span key={t} className="px-2 py-0.5 rounded bg-[#0D0870]/10 text-[#0D0870] text-xs font-mono" style={{ fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        </div>

        <p className="text-center text-[12px] text-[#B0B0B0] mt-6 mb-2">
          CareLink PRD v1.2 · Maroc 🇲🇦 · Plateforme de soins à domicile · Avril 2026
        </p>
      </div>
    </div>
  );
}
