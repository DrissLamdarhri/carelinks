import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { getAdminStats, getPendingPros, approvePro, rejectPro } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { KycModerationQueue } from "./KycModerationQueue";
import { NotificationBell } from "./NotificationBell";
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
type AdminTab = "dashboard" | "users" | "professionals" | "services" | "yoga" | "bookings" | "settings";

type ServiceCategory = "Infirmier" | "Psychologue" | "Yoga" | "Pédiatrie" | "Urgences" | "Autre";
type Service = {
  id: number; name: string; category: ServiceCategory; icon: string;
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
  const [notifOpen, setNotifOpen] = useState(false);
  const [adminNotifs, setAdminNotifs] = useState<any[]>([]);
  const [adminNotifUnread, setAdminNotifUnread] = useState(0);
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
  const [liveYoga, setLiveYoga] = useState<any[]>([]);

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
      setLiveUsers((profilesPlus ?? []).map((u: any) => ({
        id: u.id,
        name: u.full_name ?? u.id.slice(0, 8),
        email: u.phone ?? "",
        type: "Patient",
        status: "Actif",
        bookings: 0,
        joined: new Date(u.created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
        city: u.city ?? "—",
        avatar: (u.full_name ?? "P").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
      })));

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
      
      // Fetch patient names
      const patientIds = [...new Set((bookingsAll ?? []).map((b: any) => b.patient_id))];
      const { data: patientProfiles } = patientIds.length > 0 ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", patientIds) : { data: [] };
      const patientMap = Object.fromEntries((patientProfiles ?? []).map((p: any) => [p.id, p.full_name]));
      
      // Fetch professional names
      const proIds = [...new Set((bookingsAll ?? []).map((b: any) => b.professional_id).filter(Boolean))];
      const { data: proProfiles } = proIds.length > 0 ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", proIds) : { data: [] };
      const proMap = Object.fromEntries((proProfiles ?? []).map((p: any) => [p.id, p.full_name]));
      
      const statusFr: Record<string, string> = {
        open: "En attente", matched: "Confirmé", in_progress: "Confirmé",
        completed: "Terminé", cancelled: "Annulé",
      };
      setLiveAllBookings((bookingsAll ?? []).map((b: any) => ({
        id: "#" + b.booking_id.slice(0, 6).toUpperCase(),
        patient: patientMap[b.patient_id] ?? "—",
        pro: b.professional_id ? (proMap[b.professional_id] ?? "—") : "—",
        service: labelMap[b.specialty] ?? b.specialty,
        date: new Date(b.scheduled_at ?? b.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        price: (b.price ?? 0) + " MAD",
        status: statusFr[b.status] ?? b.status,
        alertLevel: b.alert_level,
        urgency: b.urgency,
      })));

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
  const saveService = () => {
    if (!serviceForm.name.trim()) return;
    if (editingService) {
      setServices(services.map((s) => s.id === editingService.id ? { ...serviceForm, id: editingService.id } : s));
    } else {
      setServices([...services, { ...serviceForm, id: Date.now() }]);
    }
    setShowServiceModal(false);
  };
  const deleteService = (id: number) => setServices(services.filter((s) => s.id !== id));
  const toggleServiceActive = (id: number) => setServices(services.map((s) => s.id === id ? { ...s, active: !s.active } : s));
  const filteredServices = services.filter((s) => serviceCatFilter === "Tous" || s.category === serviceCatFilter);

  // Pending pros — REAL API
  const approveNurse = async (proId: string) => {
    try {
      await approvePro(proId);
      setPending((prev) => prev.filter((n) => n.id !== proId));
      toast.success("Professionnel approuvé !");
    } catch (err: any) { toast.error(err.message || "Erreur"); }
  };
  const rejectNurse = async (proId: string) => {
    try {
      await rejectPro(proId);
      setPending((prev) => prev.filter((n) => n.id !== proId));
      toast.info("Professionnel refusé");
    } catch (err: any) { toast.error(err.message || "Erreur"); }
  };

  // Yoga
  const addYogaSession = () => {
    if (newSession.title && newSession.instructor) {
      setSessions([...sessions, { id: Date.now(), ...newSession, spots: 0, status: "Brouillon" }]);
      setShowYogaModal(false);
      setNewSession({ title: "", instructor: "", date: "", maxSpots: 10, price: 120 });
    }
  };
  const deleteSession = (id: number) => setSessions(sessions.filter((s) => s.id !== id));
  const toggleSessionStatus = (id: number) =>
    setSessions(sessions.map((s) => s.id === id ? { ...s, status: s.status === "Publié" ? "Brouillon" : "Publié" } : s));

  const navItems: { key: AdminTab; icon: typeof LayoutDashboard; label: string; badge?: number }[] = [
    { key: "dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
    { key: "users", icon: Users, label: "Patients", badge: 0 },
    { key: "professionals", icon: UserCheck, label: "Professionnels", badge: pending.length },
    { key: "services", icon: Briefcase, label: "Services" },
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

          {/* Legacy KYC counter */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="w-10 h-10 rounded-xl flex items-center justify-center relative"
              style={{ background: "#F3F3F5" }}
            >
              <Bell size={18} className="text-[#888780]" />
              {pending.length > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white flex items-center justify-center"
                  style={{ background: "#E24B4A", fontSize: 9, fontWeight: 700 }}
                >
                  {pending.length}
                </span>
              )}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl z-50"
                  style={{ border: "1px solid #E8EAF0" }}
                >
                  <div className="p-4 border-b border-[#F0F0F0]">
                    <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                      Notifications ({pending.length})
                    </p>
                  </div>
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {pending.map((n) => (
                      <div key={n.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F8F8FC] cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-[#EDE5CC] flex items-center justify-center text-[#0D0870] text-xs" style={{ fontWeight: 700 }}>
                          {(n.name || "P").split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#1A1A1A] truncate" style={{ fontWeight: 500 }}>{n.name}</p>
                          <p className="text-xs text-[#888780]">Nouvelle inscription pro</p>
                        </div>
                        <span className="text-xs text-[#B0B0B0]">{n.submittedAt}</span>
                      </div>
                    ))}
                    {pending.length === 0 && (
                      <p className="text-center text-sm text-[#888780] py-6">Aucune notification</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#888780]" style={{ background: "#F3F3F5" }}>
                    <Filter size={14} /> Filtrer
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#888780]" style={{ background: "#F3F3F5" }}>
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
                        .filter((u) => u.name.toLowerCase().includes(searchQ.toLowerCase()) || u.email.toLowerCase().includes(searchQ.toLowerCase()))
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
                                <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F3F5] transition-colors">
                                  <Eye size={15} className="text-[#888780]" />
                                </button>
                                <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#FDE8E8] transition-colors">
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
          {tab === "professionals" && (
            <div>
              {/* Live KYC moderation queue (Supabase) */}
              <div className="mb-6">
                <h3 className="text-[16px] text-[#1A1A1A] mb-3" style={{ fontWeight: 700 }}>
                  Modération KYC (live)
                </h3>
                <KycModerationQueue />
              </div>

              {/* Pending queue */}
              {pending.length > 0 && (
                <div className="mb-6">
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4"
                    style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}
                  >
                    <AlertTriangle size={16} className="text-amber-600" />
                    <p className="text-sm text-amber-700" style={{ fontWeight: 600 }}>
                      {pending.length} inscription(s) professionnelle(s) en attente de vérification
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pending.map((n) => (
                      <div
                        key={n.id}
                        className="bg-white rounded-2xl p-5"
                        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                      >
                        {!n.ocrMatch && (
                          <div
                            className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
                            style={{ background: "#FEF3C7" }}
                          >
                            <AlertTriangle size={13} className="text-amber-500" />
                            <span className="text-xs text-amber-700" style={{ fontWeight: 600 }}>
                              Discordance OCR détectée
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mb-4">
                          <img src={n.img} alt={n.name} className="w-14 h-14 rounded-2xl object-cover" />
                          <div>
                            <p className="text-base text-[#1A1A1A]" style={{ fontWeight: 700 }}>{n.name}</p>
                            <p className="text-sm text-[#888780]">{n.email}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin size={12} className="text-[#888780]" />
                              <span className="text-xs text-[#888780]">{n.city}</span>
                              <span className="text-xs text-[#B0B0B0] ml-2">{n.experience}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {(n.specialties ?? []).map((s) => (
                            <span key={s} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#EDE5CC", color: "#0D0870", fontWeight: 500 }}>
                              {s}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 mb-4 text-xs">
                          <span className="flex items-center gap-1.5" style={{ color: n.docsOk ? "#16A34A" : "#E24B4A" }}>
                            {n.docsOk ? <Check size={13} /> : <X size={13} />} Documents
                          </span>
                          <span className="flex items-center gap-1.5" style={{ color: n.ocrMatch ? "#16A34A" : "#E24B4A" }}>
                            {n.ocrMatch ? <Check size={13} /> : <X size={13} />} OCR
                          </span>
                          <span className="flex items-center gap-1 text-[#888780]">
                            <Clock size={12} /> {n.submittedAt}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => approveNurse(n.id)}
                            className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-1.5"
                            style={{ background: "#0D0870", fontWeight: 600 }}
                          >
                            <UserCheck size={15} /> Approuver
                          </motion.button>
                          <button className="flex-1 py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5" style={{ background: "#F3F3F5", color: "#888780" }}>
                            <Eye size={15} /> Voir dossier
                          </button>
                          <button
                            onClick={() => rejectNurse(n.id)}
                            className="w-10 py-2.5 rounded-xl flex items-center justify-center"
                            style={{ background: "#FDE8E8", color: "#E24B4A" }}
                          >
                            <UserX size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All pros table */}
              <div
                className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center justify-between">
                  <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>
                    Tous les professionnels ({(liveAllPros).length})
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "#F8F8FC" }}>
                        {["Professionnel", "Type", "Ville", "RDV", "Note", "Revenus", "Statut", "Actions"].map((h) => (
                          <th key={h} className="text-left text-xs text-[#888780] px-5 py-3" style={{ fontWeight: 500 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(liveAllPros ?? []).map((p) => (
                        <tr key={p.id} className="border-t border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {p.img ? (
                                <img src={p.img} alt={p.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                                  style={{ background: "#5BB8D4", fontWeight: 700 }}
                                >
                                  {(p.name || "P").split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 500 }}>{p.name}</p>
                                <p className="text-xs text-[#888780]">{p.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#EDE5CC", color: "#0D0870", fontWeight: 500 }}>
                              {p.type}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-[#888780]">{p.city}</td>
                          <td className="px-5 py-4 text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>{p.bookings}</td>
                          <td className="px-5 py-4">
                            {p.rating > 0 ? (
                              <div className="flex items-center gap-1">
                                <Star size={13} className="text-amber-400" fill="#FBBF24" />
                                <span className="text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>{p.rating}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-[#888780]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#1A1A1A]" style={{ fontWeight: 500 }}>{p.revenue}</td>
                          <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
                          <td className="px-5 py-4">
                            <div className="flex gap-1">
                              <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F3F5]"><Eye size={14} className="text-[#888780]" /></button>
                              <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#FDE8E8]"><Trash2 size={14} className="text-[#E24B4A]" /></button>
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

          {/* ======= SERVICES ======= */}
          {tab === "services" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-[#888780]">
                  {services.length} services · {services.filter(s => s.active).length} actifs
                </p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={openAddService}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm"
                  style={{ background: "#0D0870", fontWeight: 600 }}
                >
                  <Plus size={16} /> Ajouter un service
                </motion.button>
              </div>

              {/* Category filter */}
              <div className="flex gap-2 mb-5 flex-wrap">
                {(["Tous", ...categories.map(c => c.key)] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setServiceCatFilter(f as typeof serviceCatFilter)}
                    className="px-4 py-1.5 rounded-full text-sm border transition-all"
                    style={{
                      background: serviceCatFilter === f ? "#0D0870" : "white",
                      color: serviceCatFilter === f ? "white" : "#888780",
                      borderColor: serviceCatFilter === f ? "#0D0870" : "#E0E0E0",
                      fontWeight: serviceCatFilter === f ? 600 : 400,
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Service cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredServices.map((s) => {
                  const Icon = iconMap[s.icon] || Stethoscope;
                  const colors = categoryColors[s.category];
                  return (
                    <motion.div
                      key={s.id}
                      layout
                      className="bg-white rounded-2xl p-5"
                      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center"
                          style={{ background: colors.bg }}
                        >
                          <Icon size={20} style={{ color: colors.text }} />
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Toggle active */}
                          <button
                            onClick={() => toggleServiceActive(s.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                            style={{ background: s.active ? "#DCFCE7" : "#F3F3F5" }}
                          >
                            {s.active
                              ? <CheckCircle2 size={15} className="text-[#16A34A]" />
                              : <XCircle size={15} className="text-[#888780]" />
                            }
                          </button>
                          <button
                            onClick={() => openEditService(s)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#EDE5CC] transition-all"
                          >
                            <Edit3 size={14} className="text-[#0D0870]" />
                          </button>
                          <button
                            onClick={() => deleteService(s.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#FDE8E8] transition-all"
                          >
                            <Trash2 size={14} className="text-[#E24B4A]" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-[#1A1A1A] mb-1" style={{ fontWeight: 600 }}>
                        {s.name}
                      </p>
                      <p className="text-xs text-[#888780] mb-3 leading-relaxed">{s.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: colors.bg, color: colors.text, fontWeight: 500 }}
                          >
                            {s.category}
                          </span>
                          <span className="text-xs text-[#888780]">
                            <Clock size={11} className="inline mr-0.5" />{s.duration} min
                          </span>
                        </div>
                        <p className="text-sm text-[#1A1A1A]" style={{ fontWeight: 700 }}>
                          {s.basePrice} MAD
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======= BOOKINGS ======= */}
          {tab === "bookings" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-[#888780]">{(liveAllBookings).length} réservations</p>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#888780]" style={{ background: "#F3F3F5" }}>
                    <Filter size={14} /> Filtrer
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[#888780]" style={{ background: "#F3F3F5" }}>
                    <Download size={14} /> Exporter CSV
                  </button>
                </div>
              </div>
              <div
                className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "#F8F8FC" }}>
                        {["ID", "Patient", "Professionnel", "Service", "Date", "Prix", "Priorité", "Statut", "Actions"].map((h) => (
                          <th key={h} className="text-left text-xs text-[#888780] px-5 py-3" style={{ fontWeight: 500 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(liveAllBookings ?? []).map((b) => {
                        const alertColors: Record<string, { bg: string; color: string }> = {
                          critical: { bg: "#FCA5A5", color: "#991B1B" },
                          high: { bg: "#FEF08A", color: "#9A3412" },
                          normal: { bg: "#F3F4F6", color: "#6B7280" },
                        };
                        const alertColor = alertColors[b.alertLevel] || alertColors.normal;
                        const alertLabels: Record<string, string> = {
                          critical: "🚨 CRITIQUE",
                          high: "⚠️ ÉLEVÉE",
                          normal: "ℹ️ NORMAL",
                        };
                        return (
                          <tr key={b.id} className="border-t border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors">
                            <td className="px-5 py-4 text-xs text-[#888780]" style={{ fontFamily: "monospace" }}>{b.id}</td>
                            <td className="px-5 py-4 text-sm text-[#1A1A1A]" style={{ fontWeight: 500 }}>{b.patient}</td>
                            <td className="px-5 py-4 text-sm text-[#888780]">{b.pro}</td>
                            <td className="px-5 py-4 text-sm text-[#888780]">{b.service}</td>
                            <td className="px-5 py-4 text-sm text-[#888780]">{b.date}</td>
                            <td className="px-5 py-4 text-sm text-[#1A1A1A]" style={{ fontWeight: 600 }}>{b.price}</td>
                            <td className="px-5 py-4">
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs"
                                style={{ background: alertColor.bg, color: alertColor.color, fontWeight: 600 }}
                              >
                                {alertLabels[b.alertLevel] || "—"}
                              </span>
                            </td>
                            <td className="px-5 py-4"><StatusBadge status={b.status} /></td>
                            <td className="px-5 py-4">
                              <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F3F3F5]">
                                <Eye size={14} className="text-[#888780]" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
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
                    { label: "Authentification 2 facteurs", on: true },
                    { label: "Alertes de connexion", on: true },
                    { label: "Session auto-expiration (24h)", on: false },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between py-2">
                      <span className="text-sm text-[#1A1A1A]">{s.label}</span>
                      <button
                        className="w-11 h-6 rounded-full transition-colors relative"
                        style={{ background: s.on ? "#0D0870" : "#D0D0D0" }}
                      >
                        <div
                          className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                          style={{ left: s.on ? 26 : 4 }}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button
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
                  { label: "Date & Heure", key: "date", type: "text", placeholder: "ex: 25 Avr. 10h00" },
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
    </div>
  );
}
