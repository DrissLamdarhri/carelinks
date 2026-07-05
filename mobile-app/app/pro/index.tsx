import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Wifi,
  WifiOff,
  TrendingUp,
  Star,
  Activity,
  Banknote,
  FileText,
  Navigation,
  MapPin,
} from "lucide-react-native";
import { Colors, Gradients, DEFAULT_AVATAR } from "@/lib/colors";
import { openNavigation } from "@/lib/nav";
import { showToast } from "@/lib/toast";
import { mockProProfile, mockCompletedStats } from "@/lib/mock-data";
import { NotificationBell } from "@/components/NotificationBell";
import { LiveBookingsFeed } from "@/components/LiveBookingsFeed";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import { useOpenBookingsBySpecialty } from "@/lib/db/realtime";
import type { Booking, ProSpecialty } from "@/lib/db/types";

export default function ProHomeScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [tab, setTab] = useState<"requests" | "schedule">("requests");
  const [specialty, setSpecialty] = useState<ProSpecialty | null>(null);
  const [appointments, setAppointments] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(false);

  // On focus: refresh profile + load the pro's specialty, availability, and
  // matched appointments (everything that isn't an open request).
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
          }
          const list = await db.bookings.listForPro(user.id);
          if (!cancelled) setAppointments(list.filter((b) => b.status !== "open"));
        } catch {
          /* ignore — pro may not be set up yet */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id, refreshProfile])
  );

  // Live open requests for the pro's specialty (realtime → bid from the card).
  const { bookings: openReqs } = useOpenBookingsBySpecialty(specialty);

  const displayName =
    profile?.firstName || profile?.lastName
      ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
      : mockProProfile.name;
  const avatar = profile?.avatar || DEFAULT_AVATAR;

  // Go online = become available + publish current GPS so patients see you on
  // their map. Needs a specialty first (set it in "Demandes proches").
  const toggleOnline = async () => {
    if (!user?.id || busy) return;
    if (!specialty) {
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
      } else {
        await db.pros.upsert({ id: user.id, specialty, is_available: false });
      }
      setIsOnline(next);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={Gradients.nurse} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userWrap}>
            <Image 
              key={avatar}
              source={typeof avatar === 'string' ? { uri: avatar } : avatar}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.greeting}>Bonjour 👋</Text>
              <Text style={styles.userName}>{displayName}</Text>
            </View>
          </View>
          <View style={styles.rightTop}>
            <TouchableOpacity
              onPress={toggleOnline}
              disabled={busy}
              style={[
                styles.onlineToggle,
                isOnline ? styles.onlineToggleOn : undefined,
              ]}
            >
              {isOnline ? (
                <Wifi size={14} color="#4ADE80" />
              ) : (
                <WifiOff size={14} color="rgba(255,255,255,0.6)" />
              )}
              <Text
                style={[
                  styles.onlineText,
                  isOnline ? { color: "#4ADE80" } : undefined,
                ]}
              >
                {isOnline ? "En ligne" : "Hors ligne"}
              </Text>
            </TouchableOpacity>
            <View style={styles.rightActions}>
              <NotificationBell />
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard icon={TrendingUp} label="Aujourd'hui" value={`${mockCompletedStats.todayEarnings} MAD`} />
          <StatCard icon={Star} label="Note" value={mockCompletedStats.rating.toFixed(1)} />
          <StatCard icon={Activity} label="Ce mois" value={`${mockCompletedStats.monthMissions} missions`} />
        </View>
      </LinearGradient>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "requests" && styles.tabBtnActive]}
          onPress={() => setTab("requests")}
        >
          <Text style={[styles.tabText, tab === "requests" && styles.tabTextActive]}>
            Demandes ({openReqs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "schedule" && styles.tabBtnActive]}
          onPress={() => setTab("schedule")}
        >
          <Text style={[styles.tabText, tab === "schedule" && styles.tabTextActive]}>
            Mon planning
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push("/pro/bids")}>
          <Banknote size={16} color={Colors.primary} />
          <Text style={styles.quickActionText}>Demandes proches</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push("/pro/kyc")}>
          <FileText size={16} color={Colors.primary} />
          <Text style={styles.quickActionText}>Documents KYC</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 26 }}>
        {tab === "requests" ? (
          specialty ? (
            <LiveBookingsFeed specialty={specialty} />
          ) : (
            <View style={styles.setupCard}>
              <Text style={styles.setupText}>
                Choisissez votre spécialité et votre position pour recevoir les demandes.
              </Text>
              <TouchableOpacity style={styles.setupBtn} onPress={() => router.push("/pro/bids")}>
                <Text style={styles.setupBtnText}>Configurer</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={{ gap: 10 }}>
            {appointments.length === 0 ? (
              <View style={styles.setupCard}>
                <Text style={styles.setupText}>Aucun rendez-vous pour le moment.</Text>
              </View>
            ) : (
              appointments.map((b) => {
                const d = b.scheduled_at ? new Date(b.scheduled_at) : null;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.bookingCard}
                    activeOpacity={0.9}
                    onPress={() => router.push(`/pro/tracking/${b.id}`)}
                  >
                    <View style={styles.bookingRow}>
                      <View style={styles.bookingTimeCol}>
                        <Text style={styles.bookingTime}>
                          {d ? d.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                        </Text>
                        <Text style={styles.bookingDate}>
                          {d ? d.toLocaleDateString("fr-MA", { day: "numeric", month: "short" }) : ""}
                        </Text>
                      </View>
                      <View style={styles.sep} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookingPatient}>Patient</Text>
                        <Text style={styles.bookingCare}>{(b.specialty ?? "").replaceAll("_", " ")}</Text>
                        {b.address ? (
                          <View style={styles.addrRow}>
                            <MapPin size={12} color={Colors.textMuted} />
                            <Text style={styles.bookingAddr} numberOfLines={2}>{b.address}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={[
                            styles.statusPill,
                            b.status === "completed" ? styles.statusCompleted : styles.statusComing,
                          ]}
                        >
                          {b.status === "completed"
                            ? "Terminé"
                            : b.status === "in_progress"
                              ? "En cours"
                              : "À venir"}
                        </Text>
                        <Text style={styles.bookingPrice}>
                          {b.final_price_mad ?? b.budget_max_mad ?? 0} MAD
                        </Text>
                      </View>
                    </View>
                    {b.status !== "completed" ? (
                      <TouchableOpacity
                        style={styles.navBtn}
                        onPress={() => {
                          if (!openNavigation({ address: b.address })) showToast("Adresse du patient indisponible");
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Naviguer vers le patient"
                      >
                        <Navigation size={15} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.navBtnText}>Naviguer vers le patient</Text>
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <Icon size={14} color="rgba(255,255,255,0.65)" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: { paddingHorizontal: 20, paddingTop: 42, paddingBottom: 16 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  userWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" },
  greeting: { color: "rgba(255,255,255,0.62)", fontSize: 12 },
  userName: { color: "white", fontSize: 17, fontWeight: "600" },
  rightTop: { alignItems: "flex-end", gap: 6 },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  onlineToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  onlineToggleOn: { backgroundColor: "rgba(34,197,94,0.16)" },
  onlineText: { color: "rgba(255,255,255,0.62)", fontSize: 11, fontWeight: "500" },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 10,
  },
  statValue: { color: "white", fontSize: 14, fontWeight: "700", marginTop: 4 },
  statLabel: { color: "rgba(255,255,255,0.54)", fontSize: 10, marginTop: 2 },
  tabs: { flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  tabBtn: { flex: 1, height: 46, justifyContent: "center", alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textMuted, fontSize: 14 },
  tabTextActive: { color: Colors.primary, fontWeight: "600" },
  quickActions: {
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.surfaceWarm,
  },
  quickActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  quickActionText: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  requestCard: {
    borderRadius: 16,
    backgroundColor: "white",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  newBar: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  newBarText: { color: "white", fontSize: 11, fontWeight: "600" },
  newBarSub: { color: "rgba(255,255,255,0.75)", fontSize: 10 },
  requestBody: { padding: 12 },
  reqHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  reqPatientBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceWarm,
  },
  reqPatientInitials: { color: Colors.primary, fontSize: 14, fontWeight: "700" },
  reqPatient: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  reqCare: { color: Colors.textMuted, fontSize: 12 },
  reqPrice: { color: Colors.primary, fontSize: 14, fontWeight: "700" },
  reqInfoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  reqInfoText: { color: Colors.textMuted, fontSize: 12 },
  counterRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 8 },
  counterInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  sendCounter: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendCounterText: { color: "white", fontSize: 12, fontWeight: "600" },
  reqActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: {
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  acceptBtn: { flex: 1, backgroundColor: Colors.primary },
  acceptText: { color: "white", fontSize: 12, fontWeight: "600" },
  counterBtn: { flex: 1, borderWidth: 2, borderColor: Colors.primary, backgroundColor: "white" },
  counterText: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  rejectBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  setupCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    gap: 12,
  },
  setupText: { color: Colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  setupBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  setupBtnText: { color: "white", fontSize: 13, fontWeight: "700" },
  bookingCard: {
    borderRadius: 16,
    backgroundColor: "white",
    padding: 12,
    gap: 10,
  },
  bookingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 3 },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  navBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  bookingTimeCol: { minWidth: 58, alignItems: "center" },
  bookingTime: { color: Colors.primary, fontSize: 15, fontWeight: "700" },
  bookingDate: { color: Colors.textMuted, fontSize: 10 },
  sep: { width: 1, height: 40, backgroundColor: Colors.border },
  bookingPatient: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  bookingCare: { color: Colors.textMuted, fontSize: 12 },
  bookingAddr: { flex: 1, color: Colors.textMuted, fontSize: 11, lineHeight: 15 },
  statusPill: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 6,
  },
  statusCompleted: { backgroundColor: "#F3F3F5", color: Colors.textMuted },
  statusComing: { backgroundColor: Colors.surfaceWarm, color: Colors.primary },
  bookingPrice: { color: Colors.primary, fontSize: 13, fontWeight: "700" },
});
