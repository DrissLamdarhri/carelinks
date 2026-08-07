import { useState, useEffect, useRef, useMemo } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
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
  ChevronRight,
  Star,
  Clock,
  MessageCircle,
} from "lucide-react-native";
import { Colors, Gradients, DEFAULT_AVATAR } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useFocusRefresh } from "@/lib/hooks/useFocusRefresh";
import {
  MOROCCAN_CITIES,
  quickServices,
  primaryServices,
} from "@/lib/mock-data";
import { db } from "@/lib/db/dal";
import { geo, type NearbyProMapItem } from "@/lib/db/geo";
import { usePatientBookings } from "@/lib/db/realtime";
import { SPEC_LABEL, careLabel } from "@/lib/care-label";
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

// City default (Fès) used to find nearby pros before a patient location exists.
const HOME_CENTER = { lat: 34.037, lng: -5.004 };

export default function PatientHomeScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, profile, refreshProfile } = useAuth();

  // Professionals who are online right now, near this patient.
  const [nearbyPros, setNearbyPros] = useState<NearbyProMapItem[]>([]);
  const [prosLoading, setProsLoading] = useState(true);
  const [nextProName, setNextProName] = useState<string | null>(null);

  // "Prochain rendez-vous" — a live Supabase Realtime subscription (same hook
  // patient/bookings.tsx uses), not a poll: any status/assignment change lands
  // here the moment it happens, instead of waiting up to 30s or a tab switch.
  const { bookings: myBookings } = usePatientBookings(user?.id ?? null);

  const workedWithIds = useMemo(
    () =>
      new Set(
        myBookings
          .filter((b) => b.professional_id && ["completed", "in_progress", "en_route", "matched"].includes(b.status))
          .map((b) => b.professional_id as string),
      ),
    [myBookings],
  );

  const nextBooking = useMemo(() => {
    const upcoming = myBookings
      .filter((b) => ["matched", "en_route", "in_progress"].includes(b.status))
      .sort((a, b) => {
        const ta = a.scheduled_at ? Date.parse(a.scheduled_at) : Date.parse(a.created_at);
        const tb = b.scheduled_at ? Date.parse(b.scheduled_at) : Date.parse(b.created_at);
        return ta - tb;
      });
    return upcoming[0] ?? null;
  }, [myBookings]);

  // Refresh profile when screen comes into focus
  // Profile changes rarely — refresh at most once a minute instead of on every
  // tab switch (was a Supabase round-trip each time the tab regained focus).
  useFocusRefresh(() => {
    void refreshProfile();
  }, 60_000);

  // Nearby professionals, kept fresh on focus.
  // (useFocusRefresh ignores any returned cleanup, so we guard setState with a
  // mounted ref rather than a per-run cancel flag.)
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useFocusRefresh(
    useCallback(() => {
      void (async () => {
        try {
          // Search around the city default (Fès); real pros from v_pros_public.
          // Fetch a few extra so we can prioritise before trimming to 3.
          const rows = await geo.findNearbyProsForMap(HOME_CENTER.lat, HOME_CENTER.lng, {
            radiusKm: 100,
            limit: 12,
          });
          if (alive.current) setNearbyPros(rows);
        } catch {
          if (alive.current) setNearbyPros([]);
        } finally {
          if (alive.current) setProsLoading(false);
        }
      })();
    }, []),
    30_000,
  );

  // Resolve the next appointment's pro name whenever it (or who it points at)
  // changes — nextBooking itself now updates live via the realtime hook above.
  useEffect(() => {
    if (!nextBooking?.professional_id) {
      setNextProName(null);
      return;
    }
    let cancelled = false;
    db.profiles
      .get(nextBooking.professional_id)
      .then((pro) => { if (!cancelled) setNextProName(pro?.full_name ?? null); })
      .catch(() => { if (!cancelled) setNextProName(null); });
    return () => { cancelled = true; };
  }, [nextBooking?.professional_id]);

  // Keep "Proches de vous" short and friendly: at most 3 pros, familiar faces
  // (already consulted) first, then the nearest.
  const topPros = useMemo(() => {
    return [...nearbyPros]
      .sort((a, b) => {
        const aw = workedWithIds.has(a.id) ? 0 : 1;
        const bw = workedWithIds.has(b.id) ? 0 : 1;
        if (aw !== bw) return aw - bw;
        return (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9);
      })
      .slice(0, 3);
  }, [nearbyPros, workedWithIds]);

  const displayName = {
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
  };
  const city = profile?.city || "";
  const avatar = profile?.avatar;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 24 }}>
      <LinearGradient colors={Gradients.patientHeader} style={styles.header}>
        <View style={styles.headerCircle1} />
        <View style={styles.headerCircle2} />

        <View style={styles.headerTop}>
          {/* Tap the greeting to open your profile — a friendly, expected shortcut. */}
          <TouchableOpacity
            style={styles.userWrap}
            activeOpacity={0.7}
            onPress={() => router.push("/patient/profile")}
            accessibilityRole="button"
            accessibilityLabel={t("open_my_profile")}
          >
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
            <ChevronRight size={16} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <NotificationBell />
          </View>
        </View>

        <Text style={styles.question}>{t("what_care")}</Text>
        <Text style={styles.questionSub}>
          {t("certified_pros_now")}
        </Text>
      </LinearGradient>

      <View style={styles.quickStrip}>
        {quickServices.map((qs) => {
          const Icon = qs.icon === "zap" ? Zap : Syringe;
          return (
            <TouchableOpacity
              key={qs.id}
              style={[styles.quickBtn, { backgroundColor: qs.background }]}
              onPress={() => {
                if (qs.id === "q1") router.push("/patient/urgent");
                // Pansement / Injection: jump straight into the nurse request
                // form with that exact care type pre-selected, instead of
                // dropping the patient on a blank "Type de soin" picker.
                else if (qs.id === "q2") router.push("/patient/request?service=infirmier&care=pansement");
                else if (qs.id === "q3") router.push("/patient/request?service=infirmier&care=injection");
                else router.push("/patient/request");
              }}
            >
              <Icon size={14} color={qs.color} />
              <Text style={[styles.quickText, { color: qs.color }]}>{t(qs.label)}</Text>
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
                  {s.tag ? <Text style={styles.tag}>{t(s.tag)}</Text> : <View />}
                </View>

                <View>
                  <Text style={styles.serviceLabel}>{t(s.label)}</Text>
                  <Text style={styles.serviceSub}>{t(s.sub)}</Text>
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
        <Text style={styles.ctaHint}>⚡ {t("pat_reply_under_5min")}</Text>
      </View>

      <View style={styles.section}>
        {/* The count is the answer to "who can actually come right now?" — the
            list itself only ever contains online pros now (see
            geo.findNearbyProsForMap), but saying so out loud is the difference
            between a patient trusting the list and guessing at it. */}
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionTitle}>{t("pat_near_you").replace("%s", city)}</Text>
          {!prosLoading && nearbyPros.length > 0 ? (
            <View style={styles.onlineCount}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineCountTxt}>
                {nearbyPros.length} {t("pros_available_now")}
              </Text>
            </View>
          ) : null}
        </View>
        {prosLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} color={Colors.primary} />
        ) : topPros.length === 0 ? (
          <View style={styles.emptyPros}>
            <Text style={styles.emptyProsText}>{t("no_pros_nearby")}</Text>
          </View>
        ) : (
          topPros.map((n) => {
            const name = n.full_name || t("professional");
            const specLabel = SPEC_LABEL[n.specialty] ? t(SPEC_LABEL[n.specialty]) : n.specialty;
            const knownBefore = workedWithIds.has(n.id);
            return (
              <TouchableOpacity
                key={n.id}
                style={styles.proCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/patient/provider/${n.id}`)}
              >
                <View>
                  <Image
                    source={n.avatar_url ? { uri: n.avatar_url } : DEFAULT_AVATAR}
                    style={styles.proAvatar}
                  />
                  {/* Presence badge. Only rendered when the server says online,
                      never assumed from the row simply existing — that
                      assumption is what put offline pros on the map. */}
                  {n.is_online ? <View style={styles.proOnlineDot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.proName} numberOfLines={1}>{name}</Text>
                  <View style={styles.proSpecRow}>
                    <Text style={styles.proSpecialty}>{specLabel}</Text>
                    {knownBefore ? (
                      <View style={styles.knownBadge}>
                        <Text style={styles.knownBadgeText}>{t("worked_together")}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.proMetaRow}>
                    <Star size={11} color="#FBBF24" fill="#FBBF24" />
                    <Text style={styles.proMetaText}>{(n.rating_avg ?? 0).toFixed(1)}</Text>
                    {n.distanceKm != null ? (
                      <>
                        <Text style={styles.proMetaDot}>·</Text>
                        <MapPin size={10} color={Colors.textSubtle} />
                        <Text style={styles.proMetaText}>{n.distanceKm.toFixed(1)} km</Text>
                      </>
                    ) : null}
                  </View>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  {n.hourly_rate_mad ? (
                    <Text style={styles.proPrice}>
                      {t("pat_from_price").replace("{n}", String(n.hourly_rate_mad))}
                    </Text>
                  ) : null}
                  <View style={styles.actionsRow}>
                    {/* Both actions stay inside the app: contact happens through a
                        booking, never a raw phone number on a discovery card
                        (that would let patients bypass the platform). */}
                    <TouchableOpacity style={styles.msgBtn} onPress={() => router.push(`/patient/provider/${n.id}`)}>
                      <MessageCircle size={13} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.callBtn} onPress={() => router.push(`/patient/provider/${n.id}`)}>
                      <ChevronRight size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {nextBooking ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("next_appointment")}</Text>
          <TouchableOpacity
            onPress={() =>
              // Straight back into tracking for any active status — including
              // "matched", which now shows a real waiting-for-departure state
              // rather than a blank screen. This is the patient's way back in
              // if they close or accidentally leave the map mid-mission.
              router.push(`/patient/tracking?bookingId=${encodeURIComponent(nextBooking.id)}`)
            }
            activeOpacity={0.9}
          >
            <LinearGradient colors={Gradients.nurse} style={styles.bookingCard}>
              <View style={styles.bookingBadgeRow}>
                <Text style={styles.bookingBadge}>
                  {careLabel(nextBooking, t)}
                </Text>
                <Text style={styles.bookingStatus}>
                  {nextBooking.status === "in_progress"
                    ? t("status_in_progress")
                    : nextBooking.status === "en_route"
                    ? t("en_route_to_you")
                    : t("confirmed")}
                </Text>
              </View>
              <Text style={styles.bookingPro}>{nextProName ?? t("your_professional")}</Text>
              <View style={styles.bookingTimeRow}>
                <Clock size={13} color="rgba(255,255,255,0.75)" />
                <Text style={styles.bookingTime}>
                  {nextBooking.scheduled_at
                    ? new Date(nextBooking.scheduled_at).toLocaleString("fr-MA", {
                        weekday: "short", day: "numeric", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      })
                    : t("flexible_time")}
                </Text>
              </View>
              <View style={styles.bookingArrow}>
                <ChevronRight size={20} color="white" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}
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
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  onlineCount: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#16A34A" },
  onlineCountTxt: { color: "#16A34A", fontSize: 11.5, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
  emptyPros: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyProsText: { color: Colors.textMuted, fontSize: 13 },
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
  proOnlineDot: {
    position: "absolute", right: -2, bottom: -2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: "#16A34A", borderWidth: 2.5, borderColor: "#FFFFFF",
  },
  proName: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 1 },
  proSpecialty: { color: Colors.textMuted, fontSize: 12, marginBottom: 4, textTransform: "capitalize" },
  proSpecRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  knownBadge: { backgroundColor: "#E7F6EC", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  knownBadgeText: { color: "#16A34A", fontSize: 9.5, fontWeight: "700" },
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
