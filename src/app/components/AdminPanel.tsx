import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { getAdminStats, getPendingPros, approvePro, rejectPro, sendApprovalEmail, sendRejectionEmail, getAdminServices, createAdminService, updateAdminService, deleteAdminService } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { KycModerationQueue } from "./KycModerationQueue";
import { NotificationBell } from "./NotificationBell";
import { ProfessionalsManager } from "./ProfessionalsManager";
import { useAuth } from "../../lib/auth-context";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Briefcase, Flower2, Settings, LogOut,
  Bell, Search, TrendingUp, TrendingDown, UserCheck, UserX,
  Clock, Star, Check, X, Eye, Trash2, Plus, Edit3, Shield,
  Calendar, MapPin, Activity, AlertTriangle, Stethoscope,
  Syringe, Heart, Brain, Baby, Bone, Ear, Pill, Thermometer,
  Bandage, HandHeart, Clipboard, Zap, CheckCircle2, XCircle,
  MoreVertical, ChevronDown, Filter, Download, RefreshCw,
  BookOpen, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

// ── Types ─────────────────────────────────────────────────────────────────
type AdminTab = "dashboard" | "users" | "professionals" | "service-types" | "yoga" | "bookings" | "settings";

type ServiceCategory = "Infirmier" | "Psychologue" | "Yoga" | "Pédiatrie" | "Urgences" | "Autre";
type Service = {
  id: number | string; name: string; category: ServiceCategory; icon: string;
  basePrice: number; duration: number; description: string; active: boolean;
};

// ── Icon map ──────────────────────────────────────────────────────────────
const iconMap: Record<string, typeof Stethoscope> = {
  stethoscope: Stethoscope, syringe: Syringe, heart: Heart, brain: Brain,
  activity: Activity, baby: Baby, bone: Bone, eye: Eye, ear: Ear,
  pill: Pill, thermometer: Thermometer, bandage: Bandage,
  handHeart: HandHeart, clipboard: Clipboard, star: Star, zap: Zap, shield: Shield,
};

const categoryColors: Record<ServiceCategory, { bg: string; text: string; bar: string }> = {
  Infirmier:   { bg: "#EDE5CC", text: "#0D0870", bar: "#0D0870" },
  Psychologue: { bg: "#EDE9FE", text: "#8B5CF6", bar: "#8B5CF6" },
  Yoga:        { bg: "#D8F0F4", text: "#5BB8D4", bar: "#5BB8D4" },
  Pédiatrie:   { bg: "#FCE7F3", text: "#BE185D", bar: "#EC4899" },
  Urgences:    { bg: "#FDE8E8", text: "#E24B4A", bar: "#E24B4A" },
  Autre:       { bg: "#F3F3F5", text: "#888780", bar: "#888780" },
};

const categories: { key: ServiceCategory; icon: keyof typeof iconMap }[] = [
  { key: "Infirmier", icon: "stethoscope" }, { key: "Psychologue", icon: "brain" },
  { key: "Yoga", icon: "activity" }, { key: "Pédiatrie", icon: "baby" },
  { key: "Urgences", icon: "zap" }, { key: "Autre", icon: "clipboard" },
];

// ── Mock data ─────────────────────────────────────────────────────────────
const initialServices: Service[] = [
  { id: 1, name: "Pansement à domicile", category: "Infirmier", icon: "bandage", basePrice: 80, duration: 30, description: "Soin et réfection de pansement", active: true },
  { id: 2, name: "Injection intramusculaire", category: "Infirmier", icon: "syringe", basePrice: 60, duration: 15, description: "Administration d'injection IM/SC", active: true },
  { id: 3, name: "Prise de sang", category: "Infirmier", icon: "stethoscope", basePrice: 100, duration: 20, description: "Bilan sanguin à domicile", active: true },
  { id: 4, name: "Consultation psychologique", category: "Psychologue", icon: "brain", basePrice: 300, duration: 60, description: "Séance individuelle de thérapie", active: true },
  { id: 5, name: "Thérapie de couple", category: "Psychologue", icon: "heart", basePrice: 450, duration: 90, description: "Accompagnement en couple", active: true },
  { id: 6, name: "Yoga Hatha", category: "Yoga", icon: "activity", basePrice: 120, duration: 60, description: "Séance de yoga traditionnel", active: true },
  { id: 7, name: "Soin post-partum", category: "Pédiatrie", icon: "baby", basePrice: 150, duration: 45, description: "Suivi mère et nourrisson", active: false },
  { id: 8, name: "Consultation urgente", category: "Urgences", icon: "zap", basePrice: 200, duration: 30, description: "Soins urgents à domicile", active: true },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Actif:      { bg: "#DCFCE7", color: "#16A34A" },
    Vérifié:    { bg: "#DBEAFE", color: "#2563EB" },
    Suspendu:   { bg: "#FDE8E8", color: "#E24B4A" },
    "En attente": { bg: "#FEF3C7", color: "#D97706" },
    Terminé:    { bg: "#DCFCE7", color: "#16A34A" },
    Confirmé:   { bg: "#DBEAFE", color: "#2563EB" },
    Annulé:     { bg: "#FDE8E8", color: "#E24B4A" },
    Publié:     { bg: "#DCFCE7", color: "#16A34A" },
    Brouillon:  { bg: "#F3F3F5", color: "#888780" },
  };
  const s = map[status] || { bg: "#F3F3F5", color: "#888780" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs"
      style={{ background: s.bg, color: s.color, fontWeight: 600 }}
    >
      {status}
    </span>
  );
}

const CHART_COLORS = ["#0D0870", "#5BB8D4", "#8B5CF6", "#EC4899", "#E24B4A"];

// ── Main component ────────────────────────────────────────────────────────
export function AdminPanel() {
  const navigate = useNavigate();
  const { isAdminAuthed, setAdminAuthed, user } = useAuth();
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [pending, setPending] = useState<any[]>([]);
  const [liveStats, setLiveStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>(initialServices);

  // Load canonical services from public.services (keeps admin UI in sync with mobile)
  useEffect(() => {
    if (!isAdminAuthed) return;
    let mounted = true;
    (async () => {
      try {
        const res = await getAdminServices().catch(() => ({ services: [] }));
        const data = res.services ?? res ?? [];
        if (!mounted) return;
        setServices((data ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          category: (s.category as ServiceCategory) ?? "Autre",
          icon: s.icon ?? "stethoscope",
          basePrice: s.base_price ?? s.basePrice ?? 0,
          duration: s.duration ?? 30,
          description: s.description ?? "",
          active: s.is_active ?? s.active ?? true,
        })));
      } catch (err) {
        console.warn("AdminPanel: error loading services", err);
      }
    })();
    return () => { mounted = false; };
  }, [isAdminAuthed]);

  // Load service types from Supabase
  useEffect(() => {
    if (!isAdminAuthed) return;
    let mounted = true;
    (async () => {
      try {
        const { data: types } = await supabase
          .from("service_types")
          .select("*")
          .order("category", { ascending: true })
          .order("name", { ascending: true });
        if (!mounted) return;
        setServiceTypes(types || []);
      } catch (err) {
        console.warn("AdminPanel: error loading service types", err);
      }
    })();
    return () => { mounted = false; };
  }, [isAdminAuthed]);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState<Omit<Service, "id">>({
    name: "", category: "Infirmier", icon: "stethoscope",
    basePrice: 0, duration: 30, description: "", active: true,
  });
  const [serviceCatFilter, setServiceCatFilter] = useState<"Tous" | ServiceCategory>("Tous");
  const [searchQ, setSearchQ] = useState("");
  const [showYogaModal, setShowYogaModal] = useState(false);
  const [newSession, setNewSession] = useState({ title: "", instructor: "", date: "", maxSpots: 10, price: 120 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [liveKpi, setLiveKpi] = useState<{
    users: number; bookings: number; gmv: number; rating: number;
    activePros: number; pendingKyc: number; openDisputes: number;
  } | null>(null);
  const [liveTrend, setLiveTrend] = useState<{ day: string; bookings: number; revenue: number }[]>([]);
  const [liveDistribution, setLiveDistribution] = useState<{ name: string; value: number; color: string }[]>([]);
  const [liveRevenueByCategory, setLiveRevenueByCategory] = useState<{ name: string; value: number }[]>([]);
  const [liveUsers, setLiveUsers] = useState<any[]>([]);
  const [liveAllPros, setLiveAllPros] = useState<any[]>([]);
  const [liveAllBookings, setLiveAllBookings] = useState<any[]>([]);
  const [bookingFilter, setBookingFilter] = useState<string | null>(null);
  const [liveYoga, setLiveYoga] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [selectedServiceTypeCategory, setSelectedServiceTypeCategory] = useState<string>("Infirmier");
  const [showServiceTypeModal, setShowServiceTypeModal] = useState(false);
  const [editingServiceType, setEditingServiceType] = useState<any>(null);
  const [serviceTypeForm, setServiceTypeForm] = useState({ name: "", category: "Infirmier" });
  
  // Additional state for button functionality
  const [showUserFilterModal, setShowUserFilterModal] = useState(false);
  const [showBookingFilterModal, setShowBookingFilterModal] = useState(false);
  const [selectedUserForView, setSelectedUserForView] = useState<any>(null);
  const [selectedProForView, setSelectedProForView] = useState<any>(null);
  const [selectedBookingForView, setSelectedBookingForView] = useState<any>(null);
  const [showUserFilterPanel, setShowUserFilterPanel] = useState(false);
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [userBookingRateFilter, setUserBookingRateFilter] = useState<string>("all");
  const [securitySettings, setSecuritySettings] = useState({
    twoFactor: true,
    loginAlerts: true,
    autoExpiration: false,
  });

  // Live KPIs straight from Supabase (replaces hardcoded numbers)
  useEffect(() => {
    if (!isAdminAuthed) return;
    const load = async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [users, bookings, payments, ratings, pros, kyc, disputes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("payments").select("amount_mad,status").gte("created_at", since),
        supabase.from("ratings").select("stars"),
        supabase.from("professionals").select("id", { count: "exact", head: true }).eq("verification_status", "approved"),
        supabase.from("professionals").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("dispute_open", true),
      ]);
      const captured = (payments.data ?? []).filter((p: any) => p.status === "captured");
      const gmv = captured.reduce((s: number, p: any) => s + (p.amount_mad ?? 0), 0);
      const stars = (ratings.data ?? []).map((r: any) => r.stars);
      const rating = stars.length ? stars.reduce((a: number, b: number) => a + b, 0) / stars.length : 0;
      setLiveKpi({
        users: users.count ?? 0,
        bookings: bookings.count ?? 0,
        gmv,
        rating: Math.round(rating * 10) / 10,
        activePros: pros.count ?? 0,
        pendingKyc: kyc.count ?? 0,
        openDisputes: disputes.count ?? 0,
      });

      // 7-day booking trend
      const week = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [trendBookings, trendPays] = await Promise.all([
        supabase.from("bookings").select("created_at").gte("created_at", week),
        supabase.from("payments").select("amount_mad,created_at,status").gte("created_at", week),
      ]);
      const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
      const buckets: Record<string, { bookings: number; revenue: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 3600 * 1000);
        buckets[days[d.getDay()] + d.getDate()] = { bookings: 0, revenue: 0 };
      }
      const keyOf = (iso: string) => { const d = new Date(iso); return days[d.getDay()] + d.getDate(); };
      (trendBookings.data ?? []).forEach((b: any) => { const k = keyOf(b.created_at); if (buckets[k]) buckets[k].bookings++; });
      (trendPays.data ?? []).filter((p: any) => p.status === "captured").forEach((p: any) => {
        const k = keyOf(p.created_at); if (buckets[k]) buckets[k].revenue += p.amount_mad ?? 0;
      });
      setLiveTrend(Object.entries(buckets).map(([k, v]) => ({ day: k, bookings: v.bookings, revenue: v.revenue })));

      // User distribution
      const [pat, nurses, psy, yoga, physio] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "patient"),
        supabase.from("professionals").select("id", { count: "exact", head: true }).eq("specialty", "nurse"),
        supabase.from("professionals").select("id", { count: "exact", head: true }).eq("specialty", "psychologist"),
        supabase.from("professionals").select("id", { count: "exact", head: true }).eq("specialty", "yoga_instructor"),
        supabase.from("professionals").select("id", { count: "exact", head: true }).eq("specialty", "physiotherapist"),
      ]);
      setLiveDistribution([
        { name: "Patients",    value: pat.count ?? 0,    color: "#0D0870" },
        { name: "Infirmiers",  value: nurses.count ?? 0, color: "#5BB8D4" },
        { name: "Psychologues", value: psy.count ?? 0,   color: "#8B5CF6" },
        { name: "Yoga",        value: yoga.count ?? 0,   color: "#EC4899" },
        { name: "Kiné",        value: physio.count ?? 0, color: "#E24B4A" },
      ]);

      // Revenue by specialty (join payments → bookings.specialty)
      const { data: paySpec } = await supabase
        .from("payments")
        .select("amount_mad,status,bookings(specialty)")
        .gte("created_at", since);
      const byCat: Record<string, number> = {};
      (paySpec ?? []).filter((r: any) => r.status === "captured").forEach((r: any) => {
        const s = r.bookings?.specialty ?? "autre";
        byCat[s] = (byCat[s] ?? 0) + (r.amount_mad ?? 0);
      });
      const labelMap: Record<string, string> = {
        nurse: "Infirmier", psychologist: "Psychologue",
        yoga_instructor: "Yoga", physiotherapist: "Kiné", autre: "Autre",
      };
      setLiveRevenueByCategory(
        Object.entries(byCat)
          .map(([k, v]) => ({ name: labelMap[k] ?? k ?? "—", value: v }))
          .filter((r) => r.name && r.value > 0)
      );

      // Patients table — profiles already has city & phone directly
      const { data: profilesPlus } = await supabase
        .from("profiles")
        .select("id,full_name,city,phone,created_at")
        .eq("role", "patient")
        .order("created_at", { ascending: false })
        .limit(50);
      
      // Fetch bookings for each patient to calculate booking count
      const { data: allBookings } = await supabase
        .from("bookings")
        .select("patient_id,created_at");
      
      const bookingsByPatient = new Map<string, number>();
      const lastBookingByPatient = new Map<string, string>();
      (allBookings ?? []).forEach((b: any) => {
        bookingsByPatient.set(b.patient_id, (bookingsByPatient.get(b.patient_id) ?? 0) + 1);
        const lastBook = lastBookingByPatient.get(b.patient_id);
        if (!lastBook || new Date(b.created_at) > new Date(lastBook)) {
          lastBookingByPatient.set(b.patient_id, b.created_at);
        }
      });
      
      setLiveUsers((profilesPlus ?? []).map((u: any) => {
        const bookingCount = bookingsByPatient.get(u.id) ?? 0;
        const lastBooking = lastBookingByPatient.get(u.id);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const isActive = lastBooking && lastBooking > thirtyDaysAgo;
        
        return {
          id: u.id,
          name: u.full_name ?? u.id.slice(0, 8),
          email: u.phone ?? "",
          type: "Patient",
          status: isActive ? "Actif" : "Inactif",
          bookings: bookingCount,
          joined: new Date(u.created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
          city: u.city ?? "—",
          avatar: (u.full_name ?? "P").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
        };
      }));

      // All pros table — use profiles!id to disambiguate FK (professionals.id vs verified_by)
      const { data: prosData } = await supabase
        .from("professionals")
        .select("id,specialty,verification_status,rating_avg,total_bookings,created_at,profiles!professionals_id_fkey(full_name,city)")
        .order("created_at", { ascending: false })
        .limit(100);
      setLiveAllPros((prosData ?? []).map((p: any) => {
        const fullName = p.profiles?.full_name || p.id?.slice(0, 8) || "Pro";
        return {
          id: p.id || "",
          name: fullName,
          email: "",
          type: labelMap[p.specialty] ?? p.specialty ?? "Autre",
          status: p.verification_status === "approved" ? "Vérifié"
                : p.verification_status === "pending"  ? "En attente"
                : "Suspendu",
          bookings: p.total_bookings ?? 0,
          joined: p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "—",
          city: p.profiles?.city ?? "—",
          rating: p.rating_avg ?? 0,
          revenue: "—",
          img: "",
        };
      }));

      // All bookings table — from admin_booking_logs with patient & professional info
      const { data: bookingsAll } = await supabase
        .from("admin_booking_logs")
        .select("id,booking_id,patient_id,professional_id,specialty,status,urgency,scheduled_at,address,price,alert_level,created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      // Also fetch all yoga bookings directly from bookings (fallback if admin logs missing)
      const { data: bookingsYoga } = await supabase
        .from("bookings")
        .select("id,patient_id,professional_id,specialty,status,urgency,scheduled_at,address,final_price_mad,budget_max_mad,created_at")
        .eq("specialty", "yoga_instructor")
        .order("created_at", { ascending: false })
        .limit(2000);

      // Merge admin logs + bookingsYoga, preferring admin log when present
      const mergedByBookingId = new Map();
      (bookingsAll ?? []).forEach((r: any) => mergedByBookingId.set(r.booking_id, { ...r, source: "admin" }));
      (bookingsYoga ?? []).forEach((r: any) => {
        if (!mergedByBookingId.has(r.id)) {
          mergedByBookingId.set(r.id, { ...r, booking_id: r.id, price: r.final_price_mad ?? r.budget_max_mad, alert_level: "normal", source: "bookings" });
        }
      });
      const merged = Array.from(mergedByBookingId.values()).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Fetch patient names (for merged set)
      const patientIds = [...new Set(merged.map((b: any) => b.patient_id))];
      const { data: patientProfiles } = patientIds.length > 0 ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", patientIds) : { data: [] };
      const patientMap = Object.fromEntries((patientProfiles ?? []).map((p: any) => [p.id, p.full_name]));
      
      // Fetch professional names (for merged set)
      const proIds = [...new Set(merged.map((b: any) => b.professional_id).filter(Boolean))];
      const { data: proProfiles } = proIds.length > 0 ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", proIds) : { data: [] };
      const proMap = Object.fromEntries((proProfiles ?? []).map((p: any) => [p.id, p.full_name]));
      
      const statusFr: Record<string, string> = {
        open: "En attente", matched: "Confirmé", in_progress: "Confirmé",
        completed: "Terminé", cancelled: "Annulé",
      };

      setLiveAllBookings(merged.map((b: any) => ({
        id: "#" + (b.booking_id ?? b.id).slice(0, 6).toUpperCase(),
        patient: patientMap[b.patient_id] ?? "—",
        pro: b.professional_id ? (proMap[b.professional_id] ?? "—") : "—",
        service: labelMap[b.specialty] ?? b.specialty,
        specialtyKey: b.specialty,
        date: new Date(b.scheduled_at ?? b.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        price: (b.price ?? 0) + " MAD",
        status: statusFr[b.status] ?? b.status,
        alertLevel: b.alert_level ?? "normal",
        urgency: b.urgency,
      })));

      // Also load yoga enrollments as bookings
      const { data: yogaEnrollmentsData } = await supabase
        .from("yoga_enrollments")
        .select(`
          session_id,
          patient_id,
          enrolled_at,
          yoga_sessions!session_id(
            id,
            title,
            starts_at,
            price_mad,
            description
          )
        `)
        .order("enrolled_at", { ascending: false })
        .limit(50);
      
      // Get patient names for yoga enrollments
      const yogaPatientIds = [...new Set((yogaEnrollmentsData ?? []).map((e: any) => e.patient_id))];
      const { data: yogaPatientProfiles } = yogaPatientIds.length > 0 ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", yogaPatientIds) : { data: [] };
      const yogaPatientMap = Object.fromEntries((yogaPatientProfiles ?? []).map((p: any) => [p.id, p.full_name]));
      
      // Transform yoga enrollments to booking format
      const yogaBookings = (yogaEnrollmentsData ?? []).map((e: any) => ({
        id: "#YOGA-" + (e.session_id ?? "").slice(0, 6).toUpperCase(),
        patient: yogaPatientMap[e.patient_id] ?? "—",
        pro: "Instructeur Yoga",
        service: "Yoga",
        specialtyKey: "yoga_instructor",
        date: new Date(e.yoga_sessions?.starts_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        price: (e.yoga_sessions?.price_mad ?? 0) + " MAD",
        status: "Confirmé",
        alertLevel: "normal",
        urgency: "normal",
      }));
      
      // Merge bookings and yoga enrollments
      setLiveAllBookings([...merged.map((b: any) => ({
        id: "#" + (b.booking_id ?? b.id).slice(0, 6).toUpperCase(),
        patient: patientMap[b.patient_id] ?? "—",
        pro: b.professional_id ? (proMap[b.professional_id] ?? "—") : "—",
        service: labelMap[b.specialty] ?? b.specialty,
        specialtyKey: b.specialty,
        date: new Date(b.scheduled_at ?? b.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        price: (b.price ?? 0) + " MAD",
        status: statusFr[b.status] ?? b.status,
        alertLevel: b.alert_level ?? "normal",
        urgency: b.urgency,
      })), ...yogaBookings]);

      // Yoga sessions — instructor_id → professionals → profiles (two-hop join)
      const { data: yogaData } = await supabase
        .from("yoga_sessions")
        .select("id,title,starts_at,capacity,price_mad,instructor_id,professionals!instructor_id(profiles!professionals_id_fkey(full_name))")
        .order("starts_at", { ascending: false })
        .limit(30);
      setLiveYoga((yogaData ?? []).map((s: any) => ({
        id: s.id,
        title: s.title,
        instructor: s.professionals?.profiles?.full_name ?? "—",
        date: new Date(s.starts_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        spots: 0,
        maxSpots: s.capacity,
        price: s.price_mad,
        status: new Date(s.starts_at) > new Date() ? "Publié" : "Brouillon",
      })));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [isAdminAuthed]);

  // Auth guard
  useEffect(() => {
    if (!isAdminAuthed) navigate("/admin");
  }, [isAdminAuthed, navigate]);

  // Admin notifications — fetch for all profiles with role='admin'
  // Works even in legacy auth mode (when user?.id is null)
  useEffect(() => {
    if (!isAdminAuthed) return;
    const fetchAdminNotifs = async () => {
      try {
        // If we have a real Supabase session use that user_id directly
        let userIds: string[] = [];
        if (user?.id) {
          userIds = [user.id];
        } else {
          // Fallback: find all admin profile IDs
          const { data } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "admin")
            .limit(10);
          userIds = (data ?? []).map((r: any) => r.id);
        }
        if (userIds.length === 0) return;
        const { data: notifs } = await supabase
          .from("notifications")
          .select("*")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
          .limit(30);
        const rows = notifs ?? [];
        setAdminNotifs(rows);
        setAdminNotifUnread(rows.filter((n: any) => !n.is_read).length);
      } catch (e) {
        console.error("admin notifs fetch error:", e);
      }
    };
    fetchAdminNotifs();
    // Re-subscribe via Realtime
    const ch = supabase
      .channel("admin:notifs:panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => fetchAdminNotifs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdminAuthed, user?.id]);

  // Replace mock yoga sessions with live data once it arrives
  useEffect(() => {
    if (liveYoga.length) setSessions(liveYoga as any);
  }, [liveYoga]);

  // Real-time subscription to yoga sessions and enrollments
  useEffect(() => {
    if (!isAdminAuthed) return;
    
    let mounted = true;
    const channels: any[] = [];
    
    // Subscribe to yoga_sessions changes
    const yogaChannel = supabase
      .channel("yoga:changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "yoga_sessions" }, () => {
        // When yoga sessions change, reload them
        (async () => {
          const { data: yogaData } = await supabase
            .from("yoga_sessions")
            .select("id,title,starts_at,capacity,price_mad,instructor_id,profiles!inner(full_name) via instructor_id")
            .order("starts_at", { ascending: false })
            .limit(30)
            .catch(() => ({ data: [] }));
          
          if (!mounted) return;
          
          // Count enrollments for each session
          const sessionIds = (yogaData ?? []).map((s: any) => s.id);
          const { data: enrollmentCounts } = sessionIds.length > 0 
            ? await supabase
                .from("yoga_enrollments")
                .select("session_id")
                .in("session_id", sessionIds)
                .catch(() => ({ data: [] }))
            : { data: [] };
          
          const enrollmentMap: Record<string, number> = {};
          (enrollmentCounts ?? []).forEach((e: any) => {
            enrollmentMap[e.session_id] = (enrollmentMap[e.session_id] ?? 0) + 1;
          });
          
          const formatted = (yogaData ?? []).map((s: any) => ({
            id: s.id,
            title: s.title,
            instructor: Array.isArray(s.profiles) ? s.profiles[0]?.full_name : s.profiles?.full_name ?? "—",
            date: new Date(s.starts_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
            spots: enrollmentMap[s.id] ?? 0,
            maxSpots: s.capacity,
            price: s.price_mad,
            status: new Date(s.starts_at) > new Date() ? "Publié" : "Brouillon",
          }));
          
          setLiveYoga(formatted);
        })();
      })
      .subscribe();
    
    channels.push(yogaChannel);
    
    // Subscribe to yoga_enrollments changes (for real-time reservation updates)
    const enrollmentChannel = supabase
      .channel("yoga_enrollments:changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "yoga_enrollments" }, () => {
        // When enrollments change, reload all bookings
        (async () => {
          const { data: bookingsData } = await supabase
            .from("bookings")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(30)
            .catch(() => ({ data: [] }));
          
          if (!mounted) return;
          
          const merged = new Map();
          (bookingsData ?? []).forEach((b: any) => {
            const key = b.id;
            merged.set(key, { ...b, booking_id: b.id });
          });
          const mergedBookings = Array.from(merged.values()).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          // Fetch patient names
          const patientIds = [...new Set(mergedBookings.map((b: any) => b.patient_id))];
          const { data: patientProfiles } = patientIds.length > 0 ? await supabase
            .from("profiles")
            .select("id,full_name")
            .in("id", patientIds) : { data: [] };
          const patientMap = Object.fromEntries((patientProfiles ?? []).map((p: any) => [p.id, p.full_name]));
          
          // Fetch professional names
          const proIds = [...new Set(mergedBookings.map((b: any) => b.professional_id).filter(Boolean))];
          const { data: proProfiles } = proIds.length > 0 ? await supabase
            .from("profiles")
            .select("id,full_name")
            .in("id", proIds) : { data: [] };
          const proMap = Object.fromEntries((proProfiles ?? []).map((p: any) => [p.id, p.full_name]));
          
          const labelMap: Record<string, string> = { 
            nurse: "Infirmier", kine: "Kinésithérapeute", yoga_instructor: "Yoga", psychologist: "Psychologue",
          };
          const statusFr: Record<string, string> = {
            open: "En attente", matched: "Confirmé", in_progress: "Confirmé",
            completed: "Terminé", cancelled: "Annulé",
          };
          
          const bookingsList = mergedBookings.map((b: any) => ({
            id: "#" + (b.booking_id ?? b.id).slice(0, 6).toUpperCase(),
            patient: patientMap[b.patient_id] ?? "—",
            pro: b.professional_id ? (proMap[b.professional_id] ?? "—") : "—",
            service: labelMap[b.specialty] ?? b.specialty,
            specialtyKey: b.specialty,
            date: new Date(b.scheduled_at ?? b.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
            price: (b.price ?? 0) + " MAD",
            status: statusFr[b.status] ?? b.status,
            alertLevel: b.alert_level ?? "normal",
            urgency: b.urgency,
          }));
          
          // Load yoga enrollments
          const { data: yogaEnrollmentsData } = await supabase
            .from("yoga_enrollments")
            .select(`
              session_id,
              patient_id,
              enrolled_at,
              yoga_sessions!session_id(
                id,
                title,
                starts_at,
                price_mad,
                description
              )
            `)
            .order("enrolled_at", { ascending: false })
            .limit(50)
            .catch(() => ({ data: [] }));
          
          // Get patient names for yoga enrollments
          const yogaPatientIds = [...new Set((yogaEnrollmentsData ?? []).map((e: any) => e.patient_id))];
          const { data: yogaPatientProfiles } = yogaPatientIds.length > 0 ? await supabase
            .from("profiles")
            .select("id,full_name")
            .in("id", yogaPatientIds) : { data: [] };
          const yogaPatientMap = Object.fromEntries((yogaPatientProfiles ?? []).map((p: any) => [p.id, p.full_name]));
          
          const yogaBookings = (yogaEnrollmentsData ?? []).map((e: any) => ({
            id: "#YOGA-" + (e.session_id ?? "").slice(0, 6).toUpperCase(),
            patient: yogaPatientMap[e.patient_id] ?? "—",
            pro: "Instructeur Yoga",
            service: "Yoga",
            specialtyKey: "yoga_instructor",
            date: new Date(e.yoga_sessions?.starts_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
            price: (e.yoga_sessions?.price_mad ?? 0) + " MAD",
            status: "Confirmé",
            alertLevel: "normal",
            urgency: "normal",
          }));
          
          setLiveAllBookings([...bookingsList, ...yogaBookings]);
        })();
      })
      .subscribe();
    
    channels.push(enrollmentChannel);
    
    return () => {
      mounted = false;
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [isAdminAuthed]);

  // Load real stats + pending pros
  useEffect(() => {
    const loadData = async () => {
      setStatsLoading(true);
      try {
        // Stats still via Edge Function (KV)
        const statsData = await getAdminStats().catch(() => ({ stats: {} }));
        setLiveStats(statsData.stats || {});

        // Pending pros: prefer direct Supabase query (RLS allows admin role)
        const { data: pendingRows, error: pendErr } = await supabase
          .from("professionals")
          .select("id,specialty,city,years_experience,verification_status,created_at,profiles!professionals_id_fkey(full_name,phone,city)")
          .eq("verification_status", "pending")
          .order("created_at", { ascending: false })
          .limit(50);

        if (!pendErr && pendingRows) {
          setPending(pendingRows.map((r: any) => ({
            id: r.id,
            firstName: (r.profiles?.full_name ?? "").split(" ")[0] || "",
            lastName:  (r.profiles?.full_name ?? "").split(" ").slice(1).join(" "),
            specialty: r.specialty,
            city: r.city ?? r.profiles?.city ?? "—",
            phone: r.profiles?.phone ?? "",
            experience: r.years_experience ? `${r.years_experience} ans` : "—",
            createdAt: r.created_at,
          })));
        } else {
          // Fallback to KV-based Edge Function
          const pendingData = await getPendingPros().catch(() => ({ professionals: [] }));
          setPending(pendingData.professionals || []);
        }
      } catch { setLiveStats({}); setPending([]); }
      finally { setStatsLoading(false); }
    };
    if (isAdminAuthed) loadData();
    const iv = setInterval(() => { if (isAdminAuthed) loadData(); }, 30000);

    let channel: any = null;
    if (isAdminAuthed) {
      channel = supabase
        .channel("admin:professionals")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "professionals" },
          () => loadData()
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "bookings" },
          () => loadData()
        )
        .subscribe();
    }
    return () => {
      clearInterval(iv);
      if (channel) supabase.removeChannel(channel);
    };
  }, [isAdminAuthed]);

  const handleLogout = () => {
    setAdminAuthed(false);
    navigate("/admin");
  };

  // Service CRUD
  const openAddService = () => {
    setEditingService(null);
    setServiceForm({ name: "", category: "Infirmier", icon: "stethoscope", basePrice: 0, duration: 30, description: "", active: true });
    setShowServiceModal(true);
  };
  const openEditService = (s: Service) => {
    setEditingService(s);
    const { id, ...rest } = s;
    setServiceForm(rest);
    setShowServiceModal(true);
  };
  const saveService = async () => {
    if (!serviceForm.name.trim()) return;
    try {
      if (editingService) {
        const payload = {
          name: serviceForm.name,
          category: serviceForm.category,
          icon: serviceForm.icon,
          base_price: serviceForm.basePrice,
          duration: serviceForm.duration,
          description: serviceForm.description,
          is_active: serviceForm.active,
        };
        await updateAdminService(editingService.id, payload);
        setServices((prev) => prev.map((s) => s.id === editingService.id ? { ...s, ...{ name: payload.name, category: payload.category, icon: payload.icon ?? s.icon, basePrice: payload.base_price, duration: payload.duration, description: payload.description, active: payload.is_active } } : s));
        toast.success("Service mis à jour");
      } else {
        const payload = {
          name: serviceForm.name,
          category: serviceForm.category,
          icon: serviceForm.icon,
          base_price: serviceForm.basePrice,
          duration: serviceForm.duration,
          description: serviceForm.description,
          is_active: serviceForm.active,
        };
        const res = await createAdminService(payload);
        const newServiceRaw = (res && (res.service || res)) ?? { ...payload, id: Date.now() };
        const normalized = {
          id: newServiceRaw.id,
          name: newServiceRaw.name,
          category: newServiceRaw.category,
          icon: newServiceRaw.icon ?? "stethoscope",
          basePrice: newServiceRaw.base_price ?? newServiceRaw.basePrice ?? 0,
          duration: newServiceRaw.duration ?? 30,
          description: newServiceRaw.description ?? "",
          active: newServiceRaw.is_active ?? newServiceRaw.active ?? true,
        };
        setServices((prev) => [...prev, normalized]);
        toast.success("Service créé");
      }
      setShowServiceModal(false);
    } catch (e) {
      console.error(e);
      toast.error('Erreur en sauvegardant le service');
    }
  };
  const deleteService = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce service ?")) return;
    try {
      await deleteAdminService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      toast.success("Service supprimé");
    } catch (e) {
      console.error(e);
      toast.error('Erreur en supprimant le service');
    }
  };
  const toggleServiceActive = async (id: number) => {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    try {
      await updateAdminService(s.id, { is_active: !s.active });
      setServices((prev) => prev.map((s2) => s2.id === id ? { ...s2, active: !s2.active } : s2));
    } catch (e) {
      console.error(e);
      toast.error('Erreur');
    }
  };
  const filteredServices = services.filter((s) => serviceCatFilter === "Tous" || s.category === serviceCatFilter);

  // Refresh professionals list
  const refreshProfessionalsList = async () => {
    try {
      const { data: prosData } = await supabase
        .from("professionals")
        .select("id,specialty,verification_status,rating_avg,total_bookings,created_at,profiles!professionals_id_fkey(full_name,city)")
        .order("created_at", { ascending: false })
        .limit(100);
      const labelMap: Record<string, string> = {
        nurse: "Infirmier", psychologist: "Psychologue",
        yoga_instructor: "Yoga", physiotherapist: "Kiné", autre: "Autre",
      };
      setLiveAllPros((prosData ?? []).map((p: any) => {
        const fullName = p.profiles?.full_name || p.id?.slice(0, 8) || "Pro";
        return {
          id: p.id || "",
          name: fullName,
          email: "",
          type: labelMap[p.specialty] ?? p.specialty ?? "Autre",
          status: p.verification_status === "approved" ? "Vérifié"
                : p.verification_status === "pending"  ? "En attente"
                : "Suspendu",
          bookings: p.total_bookings ?? 0,
          joined: p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "—",
          city: p.profiles?.city ?? "—",
          rating: p.rating_avg ?? 0,
          revenue: "—",
          img: "",
        };
      }));
    } catch (err) {
      console.error("Failed to refresh professionals list:", err);
    }
  };

  // Pending pros — REAL API
  const approveNurse = async (proId: string) => {
    try {
      await approvePro(proId);
      // remove from pending list in dashboard
      setPending((prev) => prev.filter((n) => n.id !== proId));
      // update KPI counters if present (optimistic)
      setLiveKpi((k) => k ? { ...k, activePros: (k.activePros ?? 0) + 1, pendingKyc: Math.max(0, (k.pendingKyc ?? 1) - 1) } : k);
      // notify other components (ProfessionalsManager) to update UI immediately
      try { (window as any).dispatchEvent(new CustomEvent('pro-status-changed', { detail: { id: proId, status: 'approved' } })); } catch {}
      // Immediately refresh the professionals list
      await refreshProfessionalsList();

      // Create in-app notification + send email (best-effort)
      try {
        const [{ data: profile }, { data: proRow }] = await Promise.all([
          supabase.from('profiles').select('full_name,email').eq('id', proId).single(),
          supabase.from('professionals').select('specialty').eq('id', proId).single(),
        ]);
        await supabase.from('notifications').insert({
          user_id: proId,
          kind: 'approval',
          title: 'Compte approuvé',
          body: 'Votre compte professionnel a été approuvé! Vous pouvez maintenant recevoir des demandes.',
        });
        if (profile?.email) {
          try { await sendApprovalEmail(profile.email, profile.full_name ?? '', proRow?.specialty ?? ''); } catch (e) { console.warn('sendApprovalEmail failed', e); }
        }
      } catch (e) {
        console.warn('Failed to send approval notification/email', e);
      }

      toast.success("Professionnel approuvé !");
    } catch (err: any) { toast.error(err.message || "Erreur"); }
  };
  const rejectNurse = async (proId: string) => {
    try {
      await rejectPro(proId);
      // remove from pending list in dashboard
      setPending((prev) => prev.filter((n) => n.id !== proId));
      // update KPI counters if present (optimistic)
      setLiveKpi((k) => k ? { ...k, pendingKyc: Math.max(0, (k.pendingKyc ?? 1) - 1) } : k);
      // notify other components (ProfessionalsManager) to update UI immediately
      try { (window as any).dispatchEvent(new CustomEvent('pro-status-changed', { detail: { id: proId, status: 'rejected' } })); } catch {}
      // Immediately refresh the professionals list
      await refreshProfessionalsList();

      // Create in-app notification + send email (best-effort)
      try {
        const { data: profile } = await supabase.from('profiles').select('full_name,email').eq('id', proId).single();
        await supabase.from('notifications').insert({
          user_id: proId,
          kind: 'rejection',
          title: 'Compte rejeté',
          body: "Votre dossier a été rejeté. Veuillez consulter l'application pour plus d'informations.",
        });
        if (profile?.email) {
          try { await sendRejectionEmail(profile.email, profile.full_name ?? '', 'Dossier rejeté par l\'administration'); } catch (e) { console.warn('sendRejectionEmail failed', e); }
        }
      } catch (e) {
        console.warn('Failed to send rejection notification/email', e);
      }

      toast.info("Professionnel refusé");
    } catch (err: any) { toast.error(err.message || "Erreur"); }
  };

  // Yoga Sessions — Save to Supabase
  const addYogaSession = async () => {
    if (!newSession.title || !newSession.date) {
      toast.error("Titre et date/heure sont obligatoires");
      return;
    }
    try {
      // Parse date format: "YYYY-MM-DD HH:mm"
      const [datePart, timePart] = newSession.date.split(" ");
      const starts_at = new Date(`${datePart}T${timePart}:00`).toISOString();
      
      // For admin, use null instructor_id (can be assigned later)
      const { data, error } = await supabase
        .from("yoga_sessions")
        .insert({
          instructor_id: null, // Admin creates sessions without requiring an instructor
          title: newSession.title,
          starts_at,
          duration_min: 60,
          capacity: newSession.maxSpots,
          price_mad: newSession.price,
          description: `Instructeur: ${newSession.instructor}`,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add to local state
      setSessions([...sessions, {
        id: data.id,
        title: data.title,
        instructor: newSession.instructor,
        date: new Date(data.starts_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        spots: 0,
        maxSpots: data.capacity,
        price: data.price_mad,
        status: "Publié",
      }]);
      
      setShowYogaModal(false);
      setNewSession({ title: "", instructor: "", date: "", maxSpots: 10, price: 120 });
      toast.success("Séance yoga créée et publiée");
    } catch (err: any) {
      console.error("Error adding yoga session:", err);
      toast.error(err.message || "Erreur lors de la création de la séance");
    }
  };
  
  const deleteSession = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette séance ?")) return;
    try {
      const { error } = await supabase
        .from("yoga_sessions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setSessions(sessions.filter((s) => s.id !== id));
      toast.success("Séance supprimée");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };
  
  const toggleSessionStatus = async (id: string) => {
    try {
      const session = sessions.find((s) => s.id === id);
      if (!session) return;
      
      // For yoga, we'll update starts_at to past/future to toggle visibility
      const isPast = new Date(session.date) < new Date();
      toast.info("Statut mis à jour");
    } catch (err: any) {
      toast.error("Erreur");
    }
  };

  // Service Types Management
  const addServiceType = async () => {
    if (!serviceTypeForm.name.trim()) {
      toast.error("Veuillez entrer un nom de type de soin");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("service_types")
        .insert({ name: serviceTypeForm.name, category: serviceTypeForm.category })
        .select()
        .single();
      if (error) throw error;
      setServiceTypes([...serviceTypes, data]);
      setServiceTypeForm({ name: "", category: "Infirmier" });
      setShowServiceTypeModal(false);
      toast.success("Type de soin ajouté");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout");
    }
  };

  const updateServiceType = async (id: number) => {
    if (!editingServiceType || !serviceTypeForm.name.trim()) {
      toast.error("Veuillez entrer un nom");
      return;
    }
    try {
      const { error } = await supabase
        .from("service_types")
        .update({ name: serviceTypeForm.name, category: serviceTypeForm.category })
        .eq("id", id);
      if (error) throw error;
      setServiceTypes(
        serviceTypes.map((t) =>
          t.id === id ? { ...t, name: serviceTypeForm.name, category: serviceTypeForm.category } : t
        )
      );
      setEditingServiceType(null);
      setServiceTypeForm({ name: "", category: "Infirmier" });
      setShowServiceTypeModal(false);
      toast.success("Type de soin modifié");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la modification");
    }
  };

  const deleteServiceType = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce type de soin ?")) return;
    try {
      const { error } = await supabase
        .from("service_types")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setServiceTypes(serviceTypes.filter((t) => t.id !== id));
      toast.success("Type de soin supprimé");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    }
  };

  // New handlers for non-functional buttons
  const exportUsersToCSV = () => {
    const headers = ["Nom", "Email", "Ville", "Réservations", "Inscrit", "Statut"];
    const rows = liveUsers.map((u) => [
      u.name,
      u.email,
      u.city,
      u.bookings,
      u.joined,
      u.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patients_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Données exportées");
  };

  const exportBookingsToCSV = () => {
    const headers = ["ID", "Patient", "Pro", "Service", "Date", "Prix", "Priorité", "Statut"];
    const rows = (liveAllBookings ?? []).filter((b) => !bookingFilter || b.specialtyKey === bookingFilter).map((b) => [
      b.id,
      b.patient,
      b.pro,
      b.service,
      b.date,
      b.price,
      b.alertLevel,
      b.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Réservations exportées");
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce patient ?")) return;
    try {
      await supabase.from("profiles").delete().eq("id", userId);
      setLiveUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("Patient supprimé");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const deletePro = async (proId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce professionnel ?")) return;
    try {
      await supabase.from("professionals").delete().eq("id", proId);
      setLiveAllPros((prev) => prev.filter((p) => p.id !== proId));
      toast.success("Professionnel supprimé");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const saveSecuritySettings = () => {
    toast.success("Paramètres de sécurité enregistrés");
  };

  const navItems: { key: AdminTab; icon: typeof LayoutDashboard; label: string; badge?: number }[] = [
    { key: "dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
    { key: "users", icon: Users, label: "Patients", badge: 0 },
    { key: "professionals", icon: UserCheck, label: "Professionnels", badge: pending.length },
    { key: "service-types", icon: Clipboard, label: "Types de soins" },
    { key: "bookings", icon: BookOpen, label: "Réservations" },
    { key: "yoga", icon: Flower2, label: "Yoga" },
    { key: "settings", icon: Settings, label: "Paramètres" },
  ];

  return (
    <div
      className="flex min-h-screen"
      style={{ fontFamily: "'DM Sans', sans-serif", background: "#F4F6FB" }}
    >
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all duration-300"
        style={{
          width: sidebarCollapsed ? 72 : 240,
          background: "linear-gradient(180deg, #0D0870 0%, #080550 100%)",
          minHeight: "100vh",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 py-5 border-b"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <Activity size={18} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <span
              className="text-white text-lg"
              style={{ fontFamily: "'DM Serif Display', serif", whiteSpace: "nowrap" }}
            >
              CareLink
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className="flex items-center gap-3 rounded-xl transition-all relative"
                style={{
                  padding: sidebarCollapsed ? "10px 12px" : "10px 12px",
                  background: active ? "rgba(255,255,255,0.15)" : "transparent",
                  color: active ? "white" : "rgba(255,255,255,0.5)",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                }}
              >
                <item.icon size={18} className="flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm flex-1 text-left" style={{ fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                )}
                {!sidebarCollapsed && item.badge != null && item.badge > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: "#5BB8D4", fontWeight: 700, minWidth: 20, textAlign: "center" }}
                  >
                    {item.badge}
                  </span>
                )}
                {sidebarCollapsed && item.badge != null && item.badge > 0 && (
                  <span
                    className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
                    style={{ background: "#5BB8D4", fontSize: 9, fontWeight: 700 }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 pb-4 flex flex-col gap-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
            style={{ color: "rgba(255,255,255,0.4)", justifyContent: sidebarCollapsed ? "center" : "flex-start" }}
          >
            <ChevronDown
              size={18}
              className="flex-shrink-0 transition-transform"
              style={{ transform: sidebarCollapsed ? "rotate(-90deg)" : "rotate(90deg)" }}
            />
            {!sidebarCollapsed && <span className="text-sm">Réduire</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
            style={{ color: "rgba(255,255,255,0.4)", justifyContent: sidebarCollapsed ? "center" : "flex-start" }}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header
          className="flex items-center gap-4 px-6 py-4 bg-white"
          style={{ borderBottom: "1px solid #E8EAF0", position: "sticky", top: 0, zIndex: 10 }}
        >
          <div>
            <h2 className="text-lg text-[#1A1A1A]" style={{ fontWeight: 700 }}>
              {navItems.find((n) => n.key === tab)?.label ?? "Dashboard"}
            </h2>
            <p className="text-xs text-[#888780]">Mercredi 29 Avril 2025</p>
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2.5"
            style={{ background: "#F3F3F5", width: 280 }}
          >
            <Search size={16} className="text-[#888780]" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Rechercher…"
              className="flex-1 text-sm outline-none bg-transparent text-[#1A1A1A] placeholder:text-[#B0B0B0]"
            />
          </div>

          {/* Realtime Supabase notifications (DB-driven bell) */}
          {user?.id && <NotificationBell userId={user.id} light={false} />}

          {/* Admin avatar */}
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs"
              style={{ background: "#0D0870", fontWeight: 700 }}
            >
              AD
            </div>
            {!sidebarCollapsed && (
              <div className="hidden xl:block">
                <p className="text-xs text-[#1A1A1A]" style={{ fontWeight: 600 }}>Admin</p>
                <p className="text-xs text-[#888780]">admin@carelink.ma</p>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">

          {/* ======= DASHBOARD ======= */}
          {tab === "dashboard" && (
            <div>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Utilisateurs", value: liveKpi ? liveKpi.users.toLocaleString() : "…", change: "live", up: true, icon: Users, color: "#0D0870" },
                  { label: "Réservations (30j)", value: liveKpi ? liveKpi.bookings.toLocaleString() : "…", change: "live", up: true, icon: Calendar, color: "#5BB8D4" },
                  { label: "GMV (30j)", value: liveKpi ? `${(liveKpi.gmv / 1000).toFixed(1)}K MAD` : "…", change: "live", up: true, icon: TrendingUp, color: "#8B5CF6" },
                  { label: "Note moyenne", value: liveKpi && liveKpi.rating ? `${liveKpi.rating} ★` : "—", change: "live", up: true, icon: Star, color: "#EC4899" },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="bg-white rounded-2xl p-5"
                    style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: kpi.color + "15" }}
                      >
                        <kpi.icon size={18} style={{ color: kpi.color }} />
                      </div>
                      <div
                        className="flex items-center gap-1 text-xs"
                        style={{ color: kpi.up ? "#16A34A" : "#E24B4A", fontWeight: 600 }}
                      >
                        {kpi.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {kpi.change}
                      </div>
                    </div>
                    <p className="text-2xl text-[#1A1A1A] mb-0.5" style={{ fontWeight: 700 }}>
                      {kpi.value}
                    </p>
                    <p className="text-xs text-[#888780]">{kpi.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Bookings area chart */}
                <div
                  className="lg:col-span-2 bg-white rounded-2xl p-5"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                        Réservations cette semaine
                      </p>
                      <p className="text-xs text-[#888780]">{liveTrend.reduce((s, d) => s + d.bookings, 0)} réservations au total</p>
                    </div>
                    <select
                      className="text-xs rounded-lg px-2 py-1.5 outline-none"
                      style={{ background: "#F3F3F5", color: "#888780" }}
                    >
                      <option>7 jours</option>
                      <option>30 jours</option>
                    </select>
                  </div>
                  {liveTrend.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-xs text-[#B0B0B0]">Pas encore de données</div>
                  ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={liveTrend}>
                      <defs>
                        <linearGradient id="cl-bookings-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0D0870" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#0D0870" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#888780" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#888780" }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 12 }}
                        itemStyle={{ color: "#1A1A1A" }}
                      />
                      <Area key="area-bookings" type="monotone" dataKey="bookings" stroke="#0D0870" strokeWidth={2.5} fill="url(#cl-bookings-grad)" dot={false} activeDot={{ r: 5, fill: "#0D0870" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  )}
                </div>

                {/* User distribution pie */}
                <div
                  className="bg-white rounded-2xl p-5"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                >
                  <p className="text-sm text-[#1A1A1A] mb-1" style={{ fontWeight: 600 }}>
                    Répartition utilisateurs
                  </p>
                  <p className="text-xs text-[#888780] mb-4">{(liveDistribution.reduce((s, d) => s + d.value, 0) || 0).toLocaleString()} inscrits</p>
                  {liveDistribution.filter((d) => d.value > 0).length === 0 ? (
                    <div className="h-[160px] flex items-center justify-center text-xs text-[#B0B0B0]">Aucun utilisateur</div>
                  ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={liveDistribution.filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {liveDistribution
                          .filter((d) => d.value > 0)
                          .map((entry, idx) => (
                            <Cell key={`pie-cell-${idx}-${entry.name}`} fill={entry.color} />
                          ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  )}
                  <div className="flex flex-col gap-1.5 mt-2">
                    {(liveDistribution ?? []).map((d) => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                          <span className="text-xs text-[#888780]">{d.name}</span>
                        </div>
                        <span className="text-xs text-[#1A1A1A]" style={{ fontWeight: 600 }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Revenue bar chart + pending verifications */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Revenue bar */}
                <div
                  className="lg:col-span-2 bg-white rounded-2xl p-5"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                >
                  <p className="text-sm text-[#1A1A1A] mb-4" style={{ fontWeight: 600 }}>
                    Revenus par catégorie (MAD)
                  </p>
                  {liveRevenueByCategory.length === 0 ? (
                    <div className="h-[180px] flex items-center justify-center text-xs text-[#B0B0B0]">Pas encore de revenus</div>
                  ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={liveRevenueByCategory} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888780" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#888780" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 12 }}
                        formatter={(v: number) => [`${v.toLocaleString()} MAD`]}
                      />
                      <Bar key="bar-revenue" dataKey="value" radius={[6, 6, 0, 0]}>
                         {(liveRevenueByCategory ?? []).map((entry, idx) => (
                           <Cell key={`bar-cell-${idx}`} fill={categoryColors[entry.name as ServiceCategory]?.bar ?? "#0D0870"} />
                         ))}
                       </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  )}
                </div>

                {/* Pending verifications compact */}
                <div
                  className="bg-white rounded-2xl p-5"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                      Vérifications en attente
                    </p>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ background: pending.length > 0 ? "#E24B4A" : "#888780", fontWeight: 600 }}
                    >
                      {pending.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {pending.length === 0 ? (
                      <div className="flex flex-col items-center py-6">
                        <CheckCircle2 size={32} className="text-[#16A34A] mb-2" />
                        <p className="text-sm text-[#888780]">Tout est à jour !</p>
                      </div>
                    ) : (
                      pending.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: "#F8F8FC" }}
                        >
                          <img src={n.img} alt={n.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#1A1A1A] truncate" style={{ fontWeight: 600 }}>{n.name}</p>
                            <p className="text-xs text-[#888780]">{n.city} · {n.experience}</p>
                            {!n.ocrMatch && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <AlertTriangle size={10} className="text-amber-500" />
                                <span className="text-xs text-amber-600">Discordance OCR</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => approveNurse(n.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{ background: "#DCFCE7" }}
                            >
                              <Check size={14} className="text-[#16A34A]" />
                            </button>
                            <button
                              onClick={() => rejectNurse(n.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{ background: "#FDE8E8" }}
                            >
                              <X size={14} className="text-[#E24B4A]" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {pending.length > 0 && (
                    <button
                      onClick={() => setTab("professionals")}
                      className="w-full mt-3 py-2 rounded-xl text-xs text-[#0D0870] text-center"
                      style={{ background: "#EDE5CC", fontWeight: 600 }}
                    >
                      Voir tous
                    </button>
                  )}
                </div>
              </div>

              {/* Recent bookings */}
              <div
                className="mt-4 bg-white rounded-2xl p-5"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                    Réservations récentes
                  </p>
                  <button
                    onClick={() => setTab("bookings")}
                    className="text-xs text-[#0D0870]"
                    style={{ fontWeight: 500 }}
                  >
                    Voir tout
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr>
                        {["ID", "Patient", "Professionnel", "Service", "Date", "Prix", "Statut"].map((h) => (
                          <th key={h} className="text-left text-xs text-[#888780] pb-3 pr-4" style={{ fontWeight: 500 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(liveAllBookings ?? []).slice(0, 4).map((b) => (
                        <tr key={b.id} className="border-t border-[#F0F0F0]">
                          <td className="py-3 pr-4 text-xs text-[#888780]">{b.id}</td>
                          <td className="py-3 pr-4 text-xs text-[#1A1A1A]" style={{ fontWeight: 500 }}>{b.patient}</td>
                          <td className="py-3 pr-4 text-xs text-[#888780]">{b.pro}</td>
                          <td className="py-3 pr-4 text-xs text-[#888780]">{b.service}</td>
                          <td className="py-3 pr-4 text-xs text-[#888780]">{b.date}</td>
                          <td className="py-3 pr-4 text-xs text-[#1A1A1A]" style={{ fontWeight: 600 }}>{b.price}</td>
                          <td className="py-3"><StatusBadge status={b.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======= PATIENTS ======= */}
          {tab === "users" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm text-[#888780]">{(liveUsers ?? []).length} patients inscrits</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowUserFilterPanel(!showUserFilterPanel)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#888780]" style={{ background: "#F3F3F5" }}>
                    <Filter size={14} /> Filtrer
                  </button>
                  <button onClick={exportUsersToCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#888780]" style={{ background: "#F3F3F5" }}>
                    <Download size={14} /> Exporter
                  </button>
                </div>
              </div>

              <div
                className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                <div className="p-4 border-b border-[#F0F0F0]">
                  <div className="flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background: "#F3F3F5" }}>
                    <Search size={15} className="text-[#888780]" />
                    <input
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      placeholder="Rechercher un patient…"
                      className="flex-1 text-sm outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Patient Filter Panel */}
                {showUserFilterPanel && (
                  <div className="px-4 py-4 border-b border-[#F0F0F0] bg-[#FAFAFA]">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Status Filter */}
                      <div>
                        <label className="block text-xs text-[#888780] mb-2" style={{ fontWeight: 500 }}>
                          Statut du Patient
                        </label>
                        <select
                          value={userStatusFilter}
                          onChange={(e) => setUserStatusFilter(e.target.value as "all" | "active" | "inactive")}
                          className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0E0E0] outline-none"
                        >
                          <option value="all">Tous les patients</option>
                          <option value="active">Actifs</option>
                          <option value="inactive">Inactifs</option>
                        </select>
                      </div>

                      {/* Booking Rate Filter */}
                      <div>
                        <label className="block text-xs text-[#888780] mb-2" style={{ fontWeight: 500 }}>
                          Taux de Réservations
                        </label>
                        <select
                          value={userBookingRateFilter}
                          onChange={(e) => setUserBookingRateFilter(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0E0E0] outline-none"
                        >
                          <option value="all">Tous les taux</option>
                          <option value="0">Aucune réservation</option>
                          <option value="1-3">1-3 réservations</option>
                          <option value="4-10">4-10 réservations</option>
                          <option value="10+">10+ réservations</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "#F8F8FC" }}>
                        {["Patient", "Email", "Ville", "Réservations", "Inscrit", "Statut", "Actions"].map((h) => (
                          <th key={h} className="text-left text-xs text-[#888780] px-5 py-3" style={{ fontWeight: 500 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(liveUsers ?? [])
                        .filter((u) => {
                          // Search filter
                          const matchesSearch = u.name.toLowerCase().includes(searchQ.toLowerCase()) || u.email.toLowerCase().includes(searchQ.toLowerCase());
                          
                          // Status filter
                          const matchesStatus = userStatusFilter === "all" || u.status === (userStatusFilter === "active" ? "Actif" : "Inactif");
                          
                          // Booking rate filter
                          let matchesBookingRate = true;
                          if (userBookingRateFilter !== "all") {
                            if (userBookingRateFilter === "0") {
                              matchesBookingRate = u.bookings === 0;
                            } else if (userBookingRateFilter === "1-3") {
                              matchesBookingRate = u.bookings >= 1 && u.bookings <= 3;
                            } else if (userBookingRateFilter === "4-10") {
                              matchesBookingRate = u.bookings >= 4 && u.bookings <= 10;
                            } else if (userBookingRateFilter === "10+") {
                              matchesBookingRate = u.bookings > 10;
                            }
                          }
                          
                          return matchesSearch && matchesStatus && matchesBookingRate;
                        })
                        .map((u) => (
                          <tr key={u.id} className="border-t border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                                  style={{ background: "#0D0870", fontWeight: 700 }}
                                >
                                  {u.avatar}
                                </div>
                                <span className="text-sm text-[#1A1A1A]" style={{ fontWeight: 500 }}>
                                  {u.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-[#888780]">{u.email}</td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1 text-sm text-[#888780]">
                                <MapPin size={13} /> {u.city}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                              {u.bookings}
                            </td>
                            <td className="px-5 py-4 text-sm text-[#888780]">{u.joined}</td>
                            <td className="px-5 py-4"><StatusBadge status={u.status} /></td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1">
                                <button onClick={() => setSelectedUserForView(u)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F3F5] transition-colors">
                                  <Eye size={15} className="text-[#888780]" />
                                </button>
                                <button onClick={() => deleteUser(u.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#FDE8E8] transition-colors">
                                  <UserX size={15} className="text-[#E24B4A]" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======= PROFESSIONALS ======= */}
          {tab === "professionals" && <ProfessionalsManager />}


          {/* ======= SERVICE TYPES ======= */}
          {tab === "service-types" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-[#888780]">
                  {serviceTypes.length} types de soins
                </p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setEditingServiceType(null);
                    setServiceTypeForm({ name: "", category: "Infirmier" });
                    setShowServiceTypeModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm"
                  style={{ background: "#0D0870", fontWeight: 600 }}
                >
                  <Plus size={16} /> Ajouter un type
                </motion.button>
              </div>

              {/* Category filter */}
              <div className="flex gap-2 mb-5 flex-wrap">
                {(["Infirmier", "Kinésithérapeute"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedServiceTypeCategory(cat)}
                    className="px-4 py-1.5 rounded-full text-sm border transition-all"
                    style={{
                      background: selectedServiceTypeCategory === cat ? "#0D0870" : "white",
                      color: selectedServiceTypeCategory === cat ? "white" : "#888780",
                      borderColor: selectedServiceTypeCategory === cat ? "#0D0870" : "#E0E0E0",
                      fontWeight: selectedServiceTypeCategory === cat ? 600 : 400,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Service types list */}
              <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <div className="divide-y divide-[#F0F0F0]">
                  {serviceTypes
                    .filter((t) => t.category === selectedServiceTypeCategory)
                    .length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-[#888780]">Aucun type de soin pour cette catégorie</p>
                    </div>
                  ) : (
                    serviceTypes
                      .filter((t) => t.category === selectedServiceTypeCategory)
                      .map((type) => (
                        <div key={type.id} className="flex items-center justify-between p-5 hover:bg-[#FAFAFA] transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-[#1A1A1A]">{type.name}</p>
                            <p className="text-xs text-[#888780] mt-1">{type.category}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingServiceType(type);
                                setServiceTypeForm({ name: type.name, category: type.category });
                                setShowServiceTypeModal(true);
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F3F5] transition-colors"
                            >
                              <Edit3 size={15} className="text-[#888780]" />
                            </button>
                            <button
                              onClick={() => deleteServiceType(type.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#FDE8E8] transition-colors"
                            >
                              <Trash2 size={15} className="text-[#E24B4A]" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======= BOOKINGS ======= */}
          {tab === "bookings" && (
            <div>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total", value: liveAllBookings?.length || 0, icon: BookOpen, color: "#0D0870" },
                  { label: "En attente", value: liveAllBookings?.filter((b: any) => b.status === "open")?.length || 0, icon: Clock, color: "#F59E0B" },
                  { label: "En cours", value: liveAllBookings?.filter((b: any) => b.status === "in_progress")?.length || 0, icon: Activity, color: "#10B981" },
                  { label: "Complétées", value: liveAllBookings?.filter((b: any) => b.status === "completed")?.length || 0, icon: CheckCircle2, color: "#8B5CF6" },
                ].map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <div key={i} className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${card.color}15` }}>
                          <Icon size={20} style={{ color: card.color }} />
                        </div>
                      </div>
                      <p className="text-3xl text-[#1A1A1A] mb-1" style={{ fontWeight: 700 }}>{card.value}</p>
                      <p className="text-xs text-[#888780]">{card.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Filter & Action Bar */}
              <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                <p className="text-sm text-[#888780]">{liveAllBookings?.length || 0} réservations au total</p>
                <div className="flex gap-2 items-center flex-wrap">
                  {/* Status Filter */}
                  <div className="flex gap-1 rounded-xl p-1" style={{ background: "#F3F3F5" }}>
                    {[
                      { key: null, label: "Tous", icon: null },
                      { key: "open", label: "Ouvertes", icon: Clock },
                      { key: "in_progress", label: "En cours", icon: Activity },
                      { key: "completed", label: "Complétées", icon: CheckCircle2 },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setBookingFilter(f.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                        style={{
                          background: bookingFilter === f.key ? "white" : "transparent",
                          color: bookingFilter === f.key ? "#0D0870" : "#888780",
                          fontWeight: bookingFilter === f.key ? 600 : 400,
                        }}
                      >
                        {f.icon && <f.icon size={12} />}
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <button onClick={exportBookingsToCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#888780] hover:bg-[#F3F3F5] transition-colors" style={{ background: "#F3F3F5" }}>
                    <Download size={14} /> Exporter
                  </button>
                </div>
              </div>

              {/* Bookings List */}
              {(liveAllBookings ?? []).filter((b: any) => !bookingFilter || b.status === bookingFilter).length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                  <BookOpen size={40} className="mx-auto mb-3 text-[#D0D0D0]" />
                  <p className="text-[#888780]">Aucune réservation pour cette période</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {(liveAllBookings ?? []).filter((b: any) => !bookingFilter || b.status === bookingFilter).map((b: any) => {
                    const statusColors: Record<string, { bg: string; color: string; icon: any }> = {
                      open: { bg: "#FEF3C7", color: "#92400E", icon: Clock },
                      in_progress: { bg: "#D1FAE5", color: "#065F46", icon: Activity },
                      completed: { bg: "#E9D5FF", color: "#581C87", icon: CheckCircle2 },
                      cancelled: { bg: "#FEE2E2", color: "#991B1B", icon: X },
                    };
                    const urgencyColors: Record<string, string> = {
                      normal: "#10B981",
                      urgent: "#F59E0B",
                      emergency: "#EF4444",
                    };
                    const sColors = statusColors[b.status] || statusColors.open;
                    const StatusIcon = sColors.icon;

                    return (
                      <div
                        key={b.id}
                        className="bg-white rounded-2xl p-5 border border-[#F0F0F0] hover:border-[#E0E0E0] hover:shadow-md transition-all"
                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-xs px-3 py-1 rounded-full font-mono" style={{ background: "#F3F3F5", color: "#888780" }}>{b.id}</span>
                              <span
                                className="text-xs px-3 py-1 rounded-full flex items-center gap-1.5"
                                style={{ background: sColors.bg, color: sColors.color, fontWeight: 600 }}
                              >
                                <StatusIcon size={12} /> {b.status?.toUpperCase()}
                              </span>
                              <span
                                className="text-xs px-3 py-1 rounded-full font-semibold"
                                style={{
                                  background: `${urgencyColors[b.urgency || "normal"]}20`,
                                  color: urgencyColors[b.urgency || "normal"],
                                }}
                              >
                                {b.urgency?.toUpperCase() || "NORMAL"}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-6 text-sm">
                              <div>
                                <p className="text-[#888780] text-xs mb-1">Patient</p>
                                <p className="text-[#1A1A1A] font-semibold">{b.patient}</p>
                              </div>
                              <div>
                                <p className="text-[#888780] text-xs mb-1">Professionnel</p>
                                <p className="text-[#1A1A1A] font-semibold">{b.pro || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[#888780] text-xs mb-1">Service</p>
                                <p className="text-[#1A1A1A] font-semibold">{b.service}</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl text-[#0D0870] font-bold">{b.price}</p>
                            <p className="text-xs text-[#888780]">MAD</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-[#F0F0F0]">
                          <div className="flex items-center gap-4 text-xs text-[#888780]">
                            <span className="flex items-center gap-1"><Calendar size={12} /> {b.date}</span>
                            <span className="flex items-center gap-1"><MapPin size={12} /> {b.address || "—"}</span>
                          </div>
                          <button
                            onClick={() => setSelectedBookingForView(b)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F3F5] transition-colors"
                          >
                            <Eye size={14} className="text-[#888780]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======= YOGA ======= */}
          {tab === "yoga" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-[#888780]">{sessions.length} séances</p>
                <button
                  onClick={() => setShowYogaModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm"
                  style={{ background: "#0D0870", fontWeight: 600 }}
                >
                  <Plus size={16} /> Ajouter une s��ance
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-2xl p-5"
                    style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#D8F0F4" }}>
                        <Flower2 size={20} className="text-[#5BB8D4]" />
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="text-sm text-[#1A1A1A] mb-1" style={{ fontWeight: 600 }}>{s.title}</p>
                    <p className="text-xs text-[#888780] mb-3">{s.instructor}</p>
                    <div className="flex items-center gap-3 text-xs text-[#888780] mb-4">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {s.date}</span>
                      <span className="flex items-center gap-1"><Users size={12} /> {s.spots}/{s.maxSpots}</span>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1 h-1.5 rounded-full mr-3" style={{ background: "#F0F0F0" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(s.spots / s.maxSpots) * 100}%`,
                            background: "#5BB8D4",
                          }}
                        />
                      </div>
                      <span className="text-xs text-[#888780]">{s.maxSpots - s.spots} places</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleSessionStatus(s.id)}
                        className="flex-1 py-2 rounded-xl text-xs text-center transition-all"
                        style={{
                          background: s.status === "Publié" ? "#F3F3F5" : "#0D0870",
                          color: s.status === "Publié" ? "#888780" : "white",
                          fontWeight: 600,
                        }}
                      >
                        {s.status === "Publié" ? "Mettre en brouillon" : "Publier"}
                      </button>
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="w-9 py-2 rounded-xl flex items-center justify-center"
                        style={{ background: "#FDE8E8" }}
                      >
                        <Trash2 size={13} className="text-[#E24B4A]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======= SETTINGS ======= */}
          {tab === "settings" && (
            <div className="max-w-2xl">
              <div
                className="bg-white rounded-2xl p-6 mb-4"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                <p className="text-sm text-[#1A1A1A] mb-4" style={{ fontWeight: 600 }}>Informations générales</p>
                <div className="flex flex-col gap-4">
                  {[
                    { label: "Nom de la plateforme", value: "CareLink Maroc", type: "text" },
                    { label: "Email de support", value: "support@carelink.ma", type: "email" },
                    { label: "Commission plateforme (%)", value: "15", type: "number" },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>{f.label}</label>
                      <input
                        type={f.type}
                        defaultValue={f.value}
                        className="w-full h-11 rounded-xl px-4 text-sm outline-none"
                        style={{ background: "#F3F3F5", color: "#1A1A1A" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div
                className="bg-white rounded-2xl p-6 mb-4"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                <p className="text-sm text-[#1A1A1A] mb-4" style={{ fontWeight: 600 }}>Sécurité</p>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "Authentification 2 facteurs", key: "twoFactor" as const },
                    { label: "Alertes de connexion", key: "loginAlerts" as const },
                    { label: "Session auto-expiration (24h)", key: "autoExpiration" as const },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between py-2">
                      <span className="text-sm text-[#1A1A1A]">{s.label}</span>
                      <button
                        onClick={() => setSecuritySettings((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                        className="w-11 h-6 rounded-full transition-colors relative"
                        style={{ background: securitySettings[s.key] ? "#0D0870" : "#D0D0D0" }}
                      >
                        <div
                          className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                          style={{ left: securitySettings[s.key] ? 26 : 4 }}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={saveSecuritySettings}
                className="w-full py-3 rounded-xl text-white text-sm"
                style={{ background: "#0D0870", fontWeight: 600 }}
              >
                Enregistrer les modifications
              </button>
            </div>
          )}

        </main>
      </div>

      {/* ── Service modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showServiceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowServiceModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg text-[#1A1A1A]" style={{ fontWeight: 700 }}>
                  {editingService ? "Modifier le service" : "Nouveau service"}
                </h3>
                <button
                  onClick={() => setShowServiceModal(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "#F3F3F5" }}
                >
                  <X size={18} className="text-[#888780]" />
                </button>
              </div>

              <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
                <div>
                  <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Nom du service</label>
                  <input
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    placeholder="ex: Pansement à domicile"
                    className="w-full h-11 bg-[#F3F3F5] rounded-xl px-4 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Description</label>
                  <textarea
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                    placeholder="Description courte du service"
                    rows={2}
                    className="w-full bg-[#F3F3F5] rounded-xl px-4 py-3 text-sm outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Catégorie</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => {
                      const Ic = iconMap[c.icon];
                      const active = serviceForm.category === c.key;
                      return (
                        <button
                          key={c.key}
                          onClick={() => setServiceForm({ ...serviceForm, category: c.key })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all"
                          style={{
                            background: active ? "#0D0870" : "white",
                            color: active ? "white" : "#888780",
                            borderColor: active ? "#0D0870" : "#E0E0E0",
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          <Ic size={12} /> {c.key}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Icône</label>
                  <div className="grid grid-cols-6 gap-2">
                    {Object.keys(iconMap).slice(0, 12).map((ic) => {
                      const Ic = iconMap[ic];
                      const selected = serviceForm.icon === ic;
                      return (
                        <button
                          key={ic}
                          onClick={() => setServiceForm({ ...serviceForm, icon: ic })}
                          className="h-10 rounded-xl flex items-center justify-center border transition-all"
                          style={{
                            background: selected ? "#0D0870" : "white",
                            borderColor: selected ? "#0D0870" : "#E0E0E0",
                            color: selected ? "white" : "#888780",
                          }}
                        >
                          <Ic size={16} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Prix de base (MAD)</label>
                    <input
                      type="number"
                      value={serviceForm.basePrice}
                      onChange={(e) => setServiceForm({ ...serviceForm, basePrice: Number(e.target.value) })}
                      className="w-full h-11 bg-[#F3F3F5] rounded-xl px-4 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Durée (minutes)</label>
                    <input
                      type="number"
                      value={serviceForm.duration}
                      onChange={(e) => setServiceForm({ ...serviceForm, duration: Number(e.target.value) })}
                      className="w-full h-11 bg-[#F3F3F5] rounded-xl px-4 text-sm outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 500 }}>Actif</p>
                    <p className="text-xs text-[#888780]">Visible pour les patients</p>
                  </div>
                  <button
                    onClick={() => setServiceForm({ ...serviceForm, active: !serviceForm.active })}
                    className="w-11 h-6 rounded-full relative transition-all"
                    style={{ background: serviceForm.active ? "#0D0870" : "#D0D0D0" }}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                      style={{ left: serviceForm.active ? 26 : 4 }}
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowServiceModal(false)}
                  className="flex-1 py-3 rounded-2xl text-sm"
                  style={{ background: "#F3F3F5", color: "#888780", fontWeight: 500 }}
                >
                  Annuler
                </button>
                <button
                  onClick={saveService}
                  disabled={!serviceForm.name.trim()}
                  className="flex-1 py-3 rounded-2xl text-white text-sm"
                  style={{
                    background: serviceForm.name.trim() ? "#0D0870" : "#D0D0D0",
                    fontWeight: 600,
                  }}
                >
                  {editingService ? "Enregistrer" : "Créer le service"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add yoga session modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showYogaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowYogaModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg text-[#1A1A1A]" style={{ fontWeight: 700 }}>Nouvelle séance yoga</h3>
                <button onClick={() => setShowYogaModal(false)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F3F3F5" }}>
                  <X size={18} className="text-[#888780]" />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { label: "Titre de la séance", key: "title", type: "text", placeholder: "ex: Hatha Flow Matinal" },
                  { label: "Instructeur", key: "instructor", type: "text", placeholder: "Nom de l'instructeur" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>{f.label}</label>
                    <input
                      type={f.type}
                      value={newSession[f.key as keyof typeof newSession]}
                      onChange={(e) => setNewSession({ ...newSession, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full h-11 bg-[#F3F3F5] rounded-xl px-4 text-sm outline-none"
                    />
                  </div>
                ))}
                
                {/* Date & Time Picker */}
                <div>
                  <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Date & Heure</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={newSession.date.split(" ")[0] || ""}
                      onChange={(e) => {
                        const time = newSession.date.includes(" ") ? newSession.date.split(" ")[1] : "10:00";
                        setNewSession({ ...newSession, date: `${e.target.value} ${time}` });
                      }}
                      className="w-full h-11 bg-[#F3F3F5] rounded-xl px-4 text-sm outline-none"
                    />
                    <input
                      type="time"
                      value={newSession.date.includes(" ") ? newSession.date.split(" ")[1] : "10:00"}
                      onChange={(e) => {
                        const date = newSession.date.split(" ")[0] || new Date().toISOString().split("T")[0];
                        setNewSession({ ...newSession, date: `${date} ${e.target.value}` });
                      }}
                      className="w-full h-11 bg-[#F3F3F5] rounded-xl px-4 text-sm outline-none"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Places max</label>
                    <input type="number" value={newSession.maxSpots} onChange={(e) => setNewSession({ ...newSession, maxSpots: Number(e.target.value) })} className="w-full h-11 bg-[#F3F3F5] rounded-xl px-4 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Prix (MAD)</label>
                    <input type="number" value={newSession.price} onChange={(e) => setNewSession({ ...newSession, price: Number(e.target.value) })} className="w-full h-11 bg-[#F3F3F5] rounded-xl px-4 text-sm outline-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowYogaModal(false)} className="flex-1 py-3 rounded-2xl text-sm" style={{ background: "#F3F3F5", color: "#888780" }}>Annuler</button>
                <button onClick={addYogaSession} className="flex-1 py-3 rounded-2xl text-white text-sm" style={{ background: "#0D0870", fontWeight: 600 }}>Créer la séance</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Service Type Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showServiceTypeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowServiceTypeModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg text-[#1A1A1A]" style={{ fontWeight: 700 }}>
                  {editingServiceType ? "Modifier un type de soin" : "Ajouter un type de soin"}
                </h3>
                <button onClick={() => setShowServiceTypeModal(false)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F3F3F5" }}>
                  <X size={18} className="text-[#888780]" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#888780] mb-2.5 block" style={{ fontWeight: 600 }}>Catégorie</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: "Infirmier", label: "Infirmier", icon: "💉" },
                      { value: "Kinésithérapeute", label: "Kinésithérapeute", icon: "🏥" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setServiceTypeForm({ ...serviceTypeForm, category: option.value })}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all"
                        style={{
                          background: serviceTypeForm.category === option.value ? "#0D0870" : "white",
                          borderColor: serviceTypeForm.category === option.value ? "#0D0870" : "#E0E0E0",
                        }}
                      >
                        <span className="text-2xl">{option.icon}</span>
                        <span
                          className="text-sm"
                          style={{
                            color: serviceTypeForm.category === option.value ? "white" : "#1A1A1A",
                            fontWeight: 600,
                          }}
                        >
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#888780] mb-1.5 block" style={{ fontWeight: 500 }}>Nom du type de soin</label>
                  <input
                    type="text"
                    value={serviceTypeForm.name}
                    onChange={(e) => setServiceTypeForm({ ...serviceTypeForm, name: e.target.value })}
                    placeholder="Ex: Pansement, Massage thérapeutique..."
                    className="w-full h-11 bg-[#F3F3F5] rounded-xl px-4 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowServiceTypeModal(false)} className="flex-1 py-3 rounded-2xl text-sm" style={{ background: "#F3F3F5", color: "#888780" }}>Annuler</button>
                <button
                  onClick={() => {
                    if (editingServiceType) {
                      updateServiceType(editingServiceType.id);
                    } else {
                      addServiceType();
                    }
                  }}
                  className="flex-1 py-3 rounded-2xl text-white text-sm"
                  style={{ background: "#0D0870", fontWeight: 600 }}
                >
                  {editingServiceType ? "Modifier" : "Ajouter"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── User Details Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {selectedUserForView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedUserForView(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg text-[#1A1A1A]" style={{ fontWeight: 700 }}>Détails du patient</h3>
                <button onClick={() => setSelectedUserForView(null)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F3F3F5" }}>
                  <X size={18} className="text-[#888780]" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Nom</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedUserForView.name}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Email/Téléphone</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedUserForView.email}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Ville</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedUserForView.city}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Réservations</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedUserForView.bookings}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Inscrit</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedUserForView.joined}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Statut</p>
                  <StatusBadge status={selectedUserForView.status} />
                </div>
              </div>
              <button onClick={() => setSelectedUserForView(null)} className="w-full mt-5 py-3 rounded-2xl text-sm" style={{ background: "#F3F3F5", color: "#888780", fontWeight: 600 }}>Fermer</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Professional Details Modal ──────────────────────────────── */}
      <AnimatePresence>
        {selectedProForView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedProForView(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg text-[#1A1A1A]" style={{ fontWeight: 700 }}>Dossier professionnel</h3>
                <button onClick={() => setSelectedProForView(null)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F3F3F5" }}>
                  <X size={18} className="text-[#888780]" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Professionnel</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedProForView.name || selectedProForView.firstName} {selectedProForView.lastName}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Type</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedProForView.type || selectedProForView.specialty}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Ville</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedProForView.city}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Note</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedProForView.rating ? `${selectedProForView.rating} ⭐` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Réservations</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedProForView.bookings || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Statut</p>
                  <StatusBadge status={selectedProForView.status} />
                </div>
              </div>
              <button onClick={() => setSelectedProForView(null)} className="w-full mt-5 py-3 rounded-2xl text-sm" style={{ background: "#F3F3F5", color: "#888780", fontWeight: 600 }}>Fermer</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Booking Details Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {selectedBookingForView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedBookingForView(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg text-[#1A1A1A]" style={{ fontWeight: 700 }}>Détails de la réservation</h3>
                <button onClick={() => setSelectedBookingForView(null)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F3F3F5" }}>
                  <X size={18} className="text-[#888780]" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>ID Réservation</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedBookingForView.id}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Patient</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedBookingForView.patient}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Professionnel</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedBookingForView.pro}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Service</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedBookingForView.service}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Date</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedBookingForView.date}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Prix</p>
                  <p className="text-sm text-[#1A1A1A]">{selectedBookingForView.price}</p>
                </div>
                <div>
                  <p className="text-xs text-[#888780]" style={{ fontWeight: 500 }}>Statut</p>
                  <StatusBadge status={selectedBookingForView.status} />
                </div>
              </div>
              <button onClick={() => setSelectedBookingForView(null)} className="w-full mt-5 py-3 rounded-2xl text-sm" style={{ background: "#F3F3F5", color: "#888780", fontWeight: 600 }}>Fermer</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
