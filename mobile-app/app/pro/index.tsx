import { useCallback, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Activity,
  Banknote,
  Bell,
  ChevronRight,
  FileText,
  MapPin,
  Navigation,
  Star,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { Colors, Gradients, DEFAULT_AVATAR } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { showToast } from "@/lib/toast";
import { mockProProfile } from "@/lib/mock-data";
import { LiveBookingsFeed } from "@/components/LiveBookingsFeed";
import { useProDemandNotifications } from "@/lib/hooks/useProDemandNotifications";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import { useOpenBookingsBySpecialty } from "@/lib/db/realtime";
import type { Booking, ProSpecialty } from "@/lib/db/types";

const NAVY = "#0D0870";

export default function ProHomeScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [tab, setTab] = useState<"requests" | "schedule">("requests");
  const [specialty, setSpecialty] = useState<ProSpecialty | null>(null);
  const [appointments, setAppointments] = useState<Booking[]>([]);
  const [rating, setRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      let cancelled = false;
      void (async () => {
        if (!user?.id) return;
        try {
          const pro = await db.pros.get(user.id);
          if (!cancelled) {
            setSpecialty(pro?.specialty ?? null);
            setIsOnline(!!pro?.is_available);
            setRating({ avg: Number(pro?.rating_avg ?? 0), count: Number(pro?.rating_count ?? 0) });
          }
          const list = await db.bookings.listForPro(user.id);
          if (!cancelled) setAppointments(list.filter((b) => b.status !== "open"));
          const un = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .is("read_at", null);
          if (!cancelled) setUnread(un.count ?? 0);
        } catch {
          /* pro may not be set up yet */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id, refreshProfile])
  );

  const { bookings: openReqs } = useOpenBookingsBySpecialty(specialty);
  // Fires a local push + a bell notification row on every new matching demand.
  // (This screen already resolves `specialty`, so we only take the callback.)
  const { onNewDemand } = useProDemandNotifications();

  const displayName =
    profile?.firstName || profile?.lastName
      ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
      : mockProProfile.name;
  const avatar = profile?.avatar || DEFAULT_AVATAR;
  const activeMission =
    appointments.find((b) => b.status === "matched" || b.status === "in_progress") ?? null;

  // ── Real stats ──────────────────────────────────────────────────────────────
  const now = new Date();
  const completed = appointments.filter((b) => b.status === "completed");
  const todayEarnings = completed
    .filter((b) => b.completed_at && new Date(b.completed_at).toDateString() === now.toDateString())
    .reduce((sum, b) => sum + Number(b.final_price_mad ?? 0), 0);
  const monthMissions = completed.filter((b) => {
    const d = b.completed_at ? new Date(b.completed_at) : null;
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const toggleOnline = async () => {
    if (!user?.id || busy) return;
    if (!specialty) {
      showToast(t("choose_specialty_first"));
      router.push("/pro/bids");
      return;
    }
    const next = !isOnline;
    setBusy(true);
    try {
      if (next) {
        const coords = await geo.getCurrentPosition();
        await db.pros.upsert({ id: user.id, specialty, is_available: true });
        await geo.setProLocation(user.id, coords.lat, coords.lng);
        showToast(t("you_online_visible"));
      } else {
        await db.pros.upsert({ id: user.id, specialty, is_available: false });
      }
      setIsOnline(next);
    } catch {
      showToast(t("action_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <LinearGradient colors={Gradients.nurse} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userWrap}>
            <Image key={avatar} source={typeof avatar === "string" ? { uri: avatar } : avatar} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{t("hello")}</Text>
              <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bell} onPress={() => router.push("/pro/notifications")}>
            <Bell size={20} color="#FFFFFF" />
            {unread > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeTxt}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Online switch — big + clear */}
        <TouchableOpacity onPress={toggleOnline} disabled={busy} activeOpacity={0.9} style={[styles.onlineCard, isOnline && styles.onlineCardOn]}>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? "#4ADE80" : "rgba(255,255,255,0.4)" }]} />
          {isOnline ? <Wifi size={18} color="#4ADE80" /> : <WifiOff size={18} color="rgba(255,255,255,0.7)" />}
          <View style={{ flex: 1 }}>
            <Text style={styles.onlineTitle}>{isOnline ? "En ligne" : "Hors ligne"}</Text>
            <Text style={styles.onlineSub}>
              {isOnline ? t("you_receive_nearby") : "Activez pour recevoir des demandes"}
            </Text>
          </View>
          <View style={[styles.switchTrack, isOnline && styles.switchTrackOn]}>
            <View style={[styles.switchThumb, isOnline && styles.switchThumbOn]} />
          </View>
        </TouchableOpacity>

        {/* Real stats */}
        <View style={styles.statsRow}>
          <Stat icon={Banknote} value={`${todayEarnings}`} unit="MAD" label={t("today")} />
          <Stat icon={Star} value={rating.avg > 0 ? rating.avg.toFixed(1) : "—"} label={rating.count > 0 ? `${rating.count} avis` : "Note"} />
          <Stat icon={Activity} value={`${monthMissions}`} label={t("this_month")} />
        </View>
      </LinearGradient>

      {/* ── Active mission — always visible when present ── */}
      {activeMission ? (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push(`/pro/tracking/${activeMission.id}`)}
          style={styles.missionShadow}
        >
          <LinearGradient colors={["#0D0870", "#241C9E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.missionCard}>
            <View style={styles.missionTop}>
              <View style={styles.missionBadge}>
                <Navigation size={12} color="#FFFFFF" strokeWidth={2.6} />
                <Text style={styles.missionBadgeTxt}>
                  {activeMission.status === "in_progress" ? "Mission en cours" : "Mission acceptée"}
                </Text>
              </View>
              <View style={styles.missionGo}>
                <Text style={styles.missionGoTxt}>{t("view_map")}</Text>
                <ChevronRight size={16} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.missionPatient}>Patient · {(activeMission.specialty ?? "").replaceAll("_", " ")}</Text>
            {activeMission.address ? (
              <View style={styles.missionAddrRow}>
                <MapPin size={13} color="rgba(255,255,255,0.85)" />
                <Text style={styles.missionAddr} numberOfLines={1}>{activeMission.address}</Text>
              </View>
            ) : null}
            <View style={styles.missionActions}>
              <View style={styles.missionBtn}>
                <Navigation size={14} color={NAVY} strokeWidth={2.4} />
                <Text style={styles.missionBtnTxt}>{t("directions")}</Text>
              </View>
              <Text style={styles.missionPrice}>{activeMission.final_price_mad ?? activeMission.budget_max_mad ?? "—"} MAD</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/pro/bids")}>
          <Banknote size={16} color={Colors.primary} />
          <Text style={styles.quickTxt}>{t("nearby_requests")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/pro/kyc")}>
          <FileText size={16} color={Colors.primary} />
          <Text style={styles.quickTxt}>{t("kyc_documents")}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tabBtn, tab === "requests" && styles.tabBtnActive]} onPress={() => setTab("requests")}>
          <Text style={[styles.tabTxt, tab === "requests" && styles.tabTxtActive]}>Demandes ({openReqs.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === "schedule" && styles.tabBtnActive]} onPress={() => setTab("schedule")}>
          <Text style={[styles.tabTxt, tab === "schedule" && styles.tabTxtActive]}>Mon planning ({appointments.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {tab === "requests" ? (
          specialty ? (
            <LiveBookingsFeed specialty={specialty} onNewDemand={onNewDemand} />
          ) : (
            <View style={styles.setupCard}>
              <Text style={styles.setupText}>{t("setup_specialty_hint")}</Text>
              <TouchableOpacity style={styles.setupBtn} onPress={() => router.push("/pro/bids")}>
                <Text style={styles.setupBtnTxt}>{t("configure")}</Text>
              </TouchableOpacity>
            </View>
          )
        ) : appointments.length === 0 ? (
          <View style={styles.setupCard}>
            <Text style={styles.setupText}>{t("no_appointments")}</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {appointments.map((b) => {
              const d = b.scheduled_at ? new Date(b.scheduled_at) : null;
              const done = b.status === "completed";
              return (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/pro/tracking/${b.id}`)}
                  style={styles.jobCard}
                >
                  <View style={styles.jobRow}>
                    <View style={styles.jobTime}>
                      <Text style={styles.jobHour}>{d ? d.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</Text>
                      <Text style={styles.jobDate}>{d ? d.toLocaleDateString("fr-MA", { day: "numeric", month: "short" }) : ""}</Text>
                    </View>
                    <View style={styles.jobSep} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jobPatient}>{t("patient")}</Text>
                      <Text style={styles.jobCare}>{(b.specialty ?? "").replaceAll("_", " ")}</Text>
                      {b.address ? (
                        <View style={styles.jobAddrRow}>
                          <MapPin size={11} color={Colors.textMuted} />
                          <Text style={styles.jobAddr} numberOfLines={1}>{b.address}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.pill, done ? styles.pillDone : styles.pillLive]}>
                        {done ? "Terminé" : b.status === "in_progress" ? "En cours" : "À venir"}
                      </Text>
                      <Text style={styles.jobPrice}>{b.final_price_mad ?? b.budget_max_mad ?? 0} MAD</Text>
                    </View>
                  </View>
                  {!done ? (
                    <TouchableOpacity style={styles.navBtn} onPress={() => router.push(`/pro/tracking/${b.id}`)}>
                      <Navigation size={15} color="#FFFFFF" strokeWidth={2.2} />
                      <Text style={styles.navBtnTxt}>{t("navigate_to_patient")}</Text>
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({
  icon: Icon,
  value,
  unit,
  label,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  value: string;
  unit?: string;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      <Icon size={15} color="rgba(255,255,255,0.7)" />
      <View style={styles.statValRow}>
        <Text style={styles.statVal}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },

  header: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 18, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  userWrap: { flexDirection: "row", alignItems: "center", gap: 11, flex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" },
  greeting: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  userName: { color: "white", fontSize: 18, fontWeight: "700" },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  bellBadge: { position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#E24B4A", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  bellBadgeTxt: { color: "white", fontSize: 9, fontWeight: "800" },

  onlineCard: {
    flexDirection: "row", alignItems: "center", gap: 11,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, padding: 13, marginBottom: 14,
  },
  onlineCardOn: { backgroundColor: "rgba(74,222,128,0.16)" },
  onlineDot: { width: 9, height: 9, borderRadius: 5 },
  onlineTitle: { color: "white", fontSize: 15, fontWeight: "700" },
  onlineSub: { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 1 },
  switchTrack: { width: 42, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.25)", padding: 3, justifyContent: "center" },
  switchTrackOn: { backgroundColor: "#4ADE80" },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "white" },
  switchThumbOn: { alignSelf: "flex-end" },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, padding: 11 },
  statValRow: { flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 5 },
  statVal: { color: "white", fontSize: 17, fontWeight: "800" },
  statUnit: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700" },
  statLabel: { color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 2 },

  missionShadow: {
    marginHorizontal: 16, marginTop: 14, borderRadius: 20,
    shadowColor: NAVY, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 10,
  },
  missionCard: { borderRadius: 20, padding: 16 },
  missionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  missionBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.16)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  missionBadgeTxt: { color: "white", fontSize: 11, fontWeight: "800" },
  missionGo: { flexDirection: "row", alignItems: "center", gap: 2 },
  missionGoTxt: { color: "white", fontSize: 12, fontWeight: "700" },
  missionPatient: { color: "white", fontSize: 17, fontWeight: "800", textTransform: "capitalize" },
  missionAddrRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  missionAddr: { flex: 1, color: "rgba(255,255,255,0.9)", fontSize: 12 },
  missionActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  missionBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "white", paddingHorizontal: 14, height: 38, borderRadius: 12, justifyContent: "center" },
  missionBtnTxt: { color: NAVY, fontSize: 13, fontWeight: "800" },
  missionPrice: { color: "white", fontSize: 20, fontWeight: "800" },

  quickActions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  quickBtn: { flex: 1, height: 44, borderRadius: 13, backgroundColor: "white", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  quickTxt: { color: Colors.primary, fontSize: 13, fontWeight: "700" },

  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  tabBtn: { flex: 1, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "white" },
  tabBtnActive: { backgroundColor: NAVY },
  tabTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: "700" },
  tabTxtActive: { color: "white" },

  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  setupCard: { backgroundColor: "white", borderRadius: 16, padding: 18, alignItems: "center", gap: 12 },
  setupText: { color: Colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  setupBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 20, height: 42, alignItems: "center", justifyContent: "center" },
  setupBtnTxt: { color: "white", fontSize: 13, fontWeight: "700" },

  jobCard: { backgroundColor: "white", borderRadius: 16, padding: 12, gap: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  jobRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  jobTime: { minWidth: 56, alignItems: "center" },
  jobHour: { color: Colors.primary, fontSize: 15, fontWeight: "800" },
  jobDate: { color: Colors.textMuted, fontSize: 10 },
  jobSep: { width: 1, height: 40, backgroundColor: Colors.border },
  jobPatient: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  jobCare: { color: Colors.textMuted, fontSize: 12, textTransform: "capitalize" },
  jobAddrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  jobAddr: { flex: 1, color: Colors.textMuted, fontSize: 11 },
  pill: { fontSize: 11, fontWeight: "700", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: "hidden", marginBottom: 6 },
  pillDone: { backgroundColor: "#F3F3F5", color: Colors.textMuted },
  pillLive: { backgroundColor: Colors.surfaceWarm, color: Colors.primary },
  jobPrice: { color: Colors.primary, fontSize: 14, fontWeight: "800" },
  navBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 42, borderRadius: 12, backgroundColor: Colors.primary },
  navBtnTxt: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
