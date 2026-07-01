import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Wifi,
  WifiOff,
  TrendingUp,
  Star,
  Activity,
  Calendar,
  Check,
  X,
  Banknote,
  MapPin,
  FileText,
} from "lucide-react-native";
import { Colors, Gradients, DEFAULT_AVATAR } from "@/lib/colors";
import {
  mockProProfile,
  mockPendingRequests,
  mockProAppointments,
  mockCompletedStats,
} from "@/lib/mock-data";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/lib/auth-context";

export default function ProHomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [tab, setTab] = useState<"requests" | "schedule">("requests");
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState(0);
  const { profile, refreshProfile } = useAuth();
  
  // Refresh profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile])
  );
  
  const displayName =
    profile?.firstName || profile?.lastName
      ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
      : mockProProfile.name;
  const avatar = profile?.avatar || DEFAULT_AVATAR;

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
              onPress={() => setIsOnline((v) => !v)}
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
            Demandes ({mockPendingRequests.length})
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
          <View style={{ gap: 10 }}>
            {mockPendingRequests.map((r) => (
              <View key={r.id} style={styles.requestCard}>
                <View style={styles.newBar}>
                  <Text style={styles.newBarText}>Nouvelle demande</Text>
                  <Text style={styles.newBarSub}>à l’instant</Text>
                </View>

                <View style={styles.requestBody}>
                  <View style={styles.reqHeader}>
                    <View style={styles.reqPatientBadge}>
                      <Text style={styles.reqPatientInitials}>
                        {r.patientName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reqPatient}>{r.patientName}</Text>
                      <Text style={styles.reqCare}>{r.careType}</Text>
                    </View>
                    <Text style={styles.reqPrice}>{r.proposedPrice} MAD</Text>
                  </View>

                  <View style={styles.reqInfoRow}>
                    <Calendar size={12} color={Colors.textMuted} />
                    <Text style={styles.reqInfoText}>
                      {r.dateStr} · {r.timeStr}
                    </Text>
                  </View>
                  <View style={styles.reqInfoRow}>
                    <MapPin size={12} color={Colors.textMuted} />
                    <Text style={styles.reqInfoText}>{r.address}</Text>
                  </View>

                  {counterFor === r.id ? (
                    <View style={styles.counterRow}>
                      <TextInput
                        style={styles.counterInput}
                        keyboardType="numeric"
                        value={String(counterPrice)}
                        onChangeText={(v) => setCounterPrice(Number(v || 0))}
                      />
                      <Text style={{ color: Colors.textMuted, fontSize: 13 }}>MAD</Text>
                      <TouchableOpacity
                        style={styles.sendCounter}
                        onPress={() => setCounterFor(null)}
                      >
                        <Text style={styles.sendCounterText}>Envoyer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <View style={styles.reqActions}>
                    <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]}>
                      <Check size={16} color="white" />
                      <Text style={styles.acceptText}>Accepter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.counterBtn]}
                      onPress={() => {
                        setCounterFor(r.id);
                        setCounterPrice(r.proposedPrice + 20);
                      }}
                    >
                      <Banknote size={16} color={Colors.primary} />
                      <Text style={styles.counterText}>Contre-offre</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn}>
                      <X size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {mockProAppointments.map((b) => (
              <View key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingTimeCol}>
                  <Text style={styles.bookingTime}>{b.timeStr}</Text>
                  <Text style={styles.bookingDate}>{b.dateStr}</Text>
                </View>
                <View style={styles.sep} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingPatient}>{b.patientName}</Text>
                  <Text style={styles.bookingCare}>{b.careType}</Text>
                  <Text style={styles.bookingAddr}>{b.address}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[
                      styles.statusPill,
                      b.status === "completed"
                        ? styles.statusCompleted
                        : styles.statusComing,
                    ]}
                  >
                    {b.status === "completed" ? "Terminé" : "À venir"}
                  </Text>
                  <Text style={styles.bookingPrice}>{b.price} MAD</Text>
                </View>
              </View>
            ))}
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
  bookingCard: {
    borderRadius: 16,
    backgroundColor: "white",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bookingTimeCol: { minWidth: 58, alignItems: "center" },
  bookingTime: { color: Colors.primary, fontSize: 15, fontWeight: "700" },
  bookingDate: { color: Colors.textMuted, fontSize: 10 },
  sep: { width: 1, height: 40, backgroundColor: Colors.border },
  bookingPatient: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  bookingCare: { color: Colors.textMuted, fontSize: 12 },
  bookingAddr: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
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
