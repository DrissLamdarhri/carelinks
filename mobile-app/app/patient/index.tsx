import { useState } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Linking,  
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  MapPin,
  Zap,
  Syringe,
  Brain,
  Flower2,
  Activity,
  AlertTriangle,
  ChevronRight,
  Star,
  Clock,
  MessageCircle,
  Phone,
} from "lucide-react-native";
import { Colors, Gradients, DEFAULT_AVATAR } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import {
  MOROCCAN_CITIES,
  mockPatientProfile,
  quickServices,
  primaryServices,
  mockProfessionals,
  mockPatientBooking,
} from "@/lib/mock-data";
import { NotificationBell } from "@/components/NotificationBell";
import { AvatarWithDefault } from "@/components/AvatarWithDefault";
import { useAuth } from "@/lib/auth-context";
import { useCallback } from "react";

const serviceIconMap = {
  syringe: Syringe,
  brain: Brain,
  flower2: Flower2,
  activity: Activity,
} as const;

export default function PatientHomeScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { profile, refreshProfile } = useAuth();
  
  // Refresh profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile])
  );
  
  // Use real profile data, fallback to mock for display purposes
  const displayName = {
    firstName: profile?.firstName || mockPatientProfile.firstName,
    lastName: profile?.lastName || mockPatientProfile.lastName,
  };
  const city = profile?.city || mockPatientProfile.city;
  const avatar = profile?.avatar;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 24 }}>
      <LinearGradient colors={Gradients.patientHeader} style={styles.header}>
        <View style={styles.headerCircle1} />
        <View style={styles.headerCircle2} />

        <View style={styles.headerTop}>
          <View style={styles.userWrap}>
              <AvatarWithDefault
                avatarUrl={avatar}
                size={44}
                borderRadius={22}
                useDefaultImage={!avatar}
              />
            <View>
              <Text style={styles.greeting}>{t("hello")}</Text>
              <Text style={styles.userName}>
                {displayName.firstName} {displayName.lastName}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell />
          </View>
        </View>

        <Text style={styles.question}>{t("what_care")}</Text>
        <Text style={styles.questionSub}>
          Des professionnels certifiés disponibles maintenant
        </Text>
      </LinearGradient>

      <View style={styles.quickStrip}>
        {quickServices.map((qs) => {
          const Icon = qs.icon === "zap" ? Zap : Syringe;
          return (
            <TouchableOpacity
              key={qs.id}
              style={[styles.quickBtn, { backgroundColor: qs.background }]}
              onPress={() => router.push(qs.id === "q1" ? "/patient/urgent" : "/patient/request")}
            >
              <Icon size={14} color={qs.color} />
              <Text style={[styles.quickText, { color: qs.color }]}>{qs.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("choose_service")}</Text>
        <View style={styles.grid}>
          {primaryServices.map((s) => {
            const Icon = serviceIconMap[s.icon];
            const gradient =
              s.gradient === "nurse"
                ? Gradients.nurse
                : s.gradient === "psy"
                ? Gradients.psy
                : s.gradient === "yoga"
                ? Gradients.yoga
                : Gradients.kine;
            return (
              <TouchableOpacity
                key={s.key}
                style={styles.serviceCard}
                onPress={() =>
                  router.push(
                    s.key === "psy"
                      ? "/patient/psychologists"
                      : s.key === "yoga"
                      ? "/patient/yoga"
                      : s.key === "kine"
                      ? "/patient/kine"
                      : `/patient/request?service=${s.key}`
                  )
                }
              >
                <Image source={{ uri: s.image }} style={styles.serviceImage} />
                <LinearGradient
                  colors={[gradient[0], "rgba(0,0,0,0.42)"]}
                  style={styles.serviceOverlay}
                />

                <View style={styles.serviceTop}>
                  <View style={styles.serviceIconWrap}>
                    <Icon size={18} color="white" />
                  </View>
                  {s.tag ? <Text style={styles.tag}>{s.tag}</Text> : <View />}
                </View>

                <View>
                  <Text style={styles.serviceLabel}>{s.label}</Text>
                  <Text style={styles.serviceSub}>{s.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.cta} onPress={() => router.push("/patient/request")}>
          <View style={styles.ctaIconWrap}>
            <Zap size={16} color="white" />
          </View>
          <Text style={styles.ctaText}>{t("request_care_now")}</Text>
          <ChevronRight size={18} color="white" />
        </TouchableOpacity>
        <Text style={styles.ctaHint}>⚡ Réponse en moins de 5 minutes</Text>
      </View>

      {/* Dedicated urgent / SOS entry (danger-themed) */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.sosBanner} onPress={() => router.push("/patient/urgent")} activeOpacity={0.9}>
          <View style={styles.sosIcon}><AlertTriangle size={18} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosTitle}>{t("sos_banner_title")}</Text>
            <Text style={styles.sosSub}>{t("sos_banner_sub")}</Text>
          </View>
          <ChevronRight size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Proches de vous · {city}</Text>
        {mockProfessionals.map((n) => (
          <TouchableOpacity
            key={n.id}
            style={styles.proCard}
            onPress={() => router.push(`/patient/provider/${n.id}`)}
          >
            <Image source={{ uri: n.avatar }} style={styles.proAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.proName}>
                {n.firstName} {n.lastName}
              </Text>
              <Text style={styles.proSpecialty}>{n.specialty}</Text>
              <View style={styles.proMetaRow}>
                <Star size={11} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.proMetaText}>
                  {n.rating.toFixed(1)} ({n.reviewCount})
                </Text>
                <Text style={styles.proMetaDot}>·</Text>
                <MapPin size={10} color={Colors.textSubtle} />
                <Text style={styles.proMetaText}>{n.city}</Text>
              </View>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.proPrice}>Dès {n.minPrice} MAD</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.msgBtn} onPress={() => router.push("/patient/messages")}>
                  <MessageCircle size={13} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${n.phone}`)}
                >
                  <Phone size={13} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("next_appointment")}</Text>
        <TouchableOpacity onPress={() => router.push("/patient/bookings")} activeOpacity={0.9}>
          <LinearGradient colors={Gradients.nurse} style={styles.bookingCard}>
          <View style={styles.bookingBadgeRow}>
            <Text style={styles.bookingBadge}>{mockPatientBooking.careType}</Text>
            <Text style={styles.bookingStatus}>{t("confirmed")}</Text>
          </View>
          <Text style={styles.bookingPro}>{mockPatientBooking.proName}</Text>
          <View style={styles.bookingTimeRow}>
            <Clock size={13} color="rgba(255,255,255,0.75)" />
            <Text style={styles.bookingTime}>
              {mockPatientBooking.dateStr} — {mockPatientBooking.timeStr}
            </Text>
          </View>
          <View style={styles.bookingArrow}>
            <ChevronRight size={20} color="white" />
          </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 42, paddingBottom: 28, overflow: "visible" },
  headerCircle1: {
    position: "absolute",
    top: -32,
    right: -22,
    width: 136,
    height: 136,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  headerCircle2: {
    position: "absolute",
    top: 70,
    left: -20,
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: "rgba(91,184,212,0.16)",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  greeting: { color: "rgba(255,255,255,0.62)", fontSize: 12 },
  userName: { color: "white", fontSize: 16, fontWeight: "700" },
  question: {
    color: "white",
    fontSize: 24,
    marginTop: 4,
    marginBottom: 2,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  questionSub: { color: "rgba(255,255,255,0.56)", fontSize: 12 },
  quickStrip: {
    marginTop: -13,
    paddingHorizontal: 20,
    marginBottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    height: 40,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  quickText: { fontSize: 12, fontWeight: "600" },
  section: { paddingHorizontal: 20, marginBottom: 18 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sosBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#E24B4A", borderRadius: 16, padding: 14 },
  sosIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  sosTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  sosSub: { color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 1 },
  serviceCard: {
    width: "48.5%",
    height: 140,
    borderRadius: 22,
    overflow: "hidden",
    justifyContent: "space-between",
    padding: 12,
  },
  serviceImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  serviceOverlay: { ...StyleSheet.absoluteFillObject },
  serviceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  serviceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  tag: {
    fontSize: 10,
    color: "white",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontWeight: "600",
  },
  serviceLabel: { color: "white", fontSize: 16, fontWeight: "700" },
  serviceSub: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  cta: {
    height: 54,
    borderRadius: 20,
    backgroundColor: "#5BB8D4",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#5BB8D4",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  ctaIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  ctaText: { color: "white", fontSize: 15, fontWeight: "700" },
  ctaHint: { textAlign: "center", marginTop: 6, color: Colors.textMuted, fontSize: 11 },
  proCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  proAvatar: { width: 54, height: 54, borderRadius: 16 },
  proName: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 1 },
  proSpecialty: { color: Colors.textMuted, fontSize: 12, marginBottom: 4, textTransform: "capitalize" },
  proMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  proMetaText: { color: Colors.textMuted, fontSize: 11 },
  proMetaDot: { color: Colors.textSubtle, fontSize: 11 },
  proPrice: { color: Colors.primary, fontSize: 11, fontWeight: "700", marginBottom: 8 },
  actionsRow: { flexDirection: "row", gap: 6 },
  msgBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceWarm,
  },
  callBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  bookingCard: {
    borderRadius: 22,
    padding: 16,
    position: "relative",
    overflow: "hidden",
  },
  bookingBadgeRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  bookingBadge: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "600",
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bookingStatus: {
    fontSize: 11,
    color: "white",
    backgroundColor: "rgba(91,184,212,0.35)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bookingPro: { color: "white", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  bookingTimeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bookingTime: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  bookingArrow: {
    position: "absolute",
    right: 14,
    top: "45%",
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
});
