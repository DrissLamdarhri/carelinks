import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Clock3, MessageCircle, Phone, Shield, X } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { db } from "@/lib/db/dal";
import type { Booking, Profile } from "@/lib/db/types";

export default function LiveTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId: string }>();
  const bookingId = params.bookingId;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [proProfile, setProProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState(12);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const routeX = useMemo(() => new Animated.Value(0), []);
  const routeY = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    let cancelled = false;
    const loadBooking = async () => {
      setErrorMessage(null);
      setLoading(true);
      try {
        const nextBooking = await db.bookings.get(bookingId);
        let nextProfile: Profile | null = null;
        if (nextBooking.professional_id) {
          nextProfile = await db.profiles.get(nextBooking.professional_id).catch(() => null);
        }
        if (!cancelled) {
          setBooking(nextBooking);
          setProProfile(nextProfile);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Suivi indisponible.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadBooking();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  useEffect(() => {
    const iv = setInterval(() => {
      setEta((prev) => Math.max(0, prev - 1));
      setProgress((prev) => Math.min(100, prev + 8));
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    Animated.timing(routeX, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: true,
    }).start();
    Animated.timing(routeY, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [progress, routeX, routeY]);

  const arrived = eta === 0;
  const proName = proProfile?.full_name || "Professionnel";
  const proAvatar = proProfile?.avatar_url || null;
  const proPhone = proProfile?.phone || null;

  return (
    <View style={styles.root}>
      <View style={styles.mapSection}>
        <View style={styles.headerOverlay}>
          <TouchableOpacity onPress={() => router.replace("/patient")} style={styles.closeBtn}>
            <X size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.etaPill}>
            <View
              style={[
                styles.dot,
                { backgroundColor: arrived ? Colors.primary : Colors.accent },
              ]}
            />
            <Text style={styles.etaPillText}>{arrived ? "Arrivé !" : `En route — ${eta} min`}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.mapMock}>
          <View style={styles.roadHorizontal} />
          <View style={styles.roadVertical} />

          <View style={styles.patientPinWrap}>
            <Text style={styles.patientTag}>Vous</Text>
            <View style={styles.patientPin} />
          </View>

          <Animated.View
            style={[
              styles.proPinWrap,
              {
                transform: [
                  {
                    translateX: routeX.interpolate({
                      inputRange: [0, 100],
                      outputRange: [120, 0],
                    }),
                  },
                  {
                    translateY: routeY.interpolate({
                      inputRange: [0, 100],
                      outputRange: [-120, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.proPin}>
              {proAvatar ? (
                <Image source={{ uri: proAvatar }} style={styles.proPinAvatar} />
              ) : (
                <Text style={styles.proPinText}>
                  {proName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </Text>
              )}
            </View>
          </Animated.View>
        </View>
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.dragger} />
        <View style={styles.progressHead}>
          <Text style={styles.progressLabel}>
            {arrived ? "Le professionnel est arrivé" : "En route vers vous"}
          </Text>
          <Text style={styles.progressValue}>{arrived ? "Arrivé" : `${eta} min`}</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.providerCard}>
          {proAvatar ? (
            <Image source={{ uri: proAvatar }} style={styles.providerAvatar} />
          ) : (
            <View style={styles.providerAvatarFallback}>
              <Text style={styles.providerAvatarText}>
                {proName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </Text>
            </View>
          )}
          <View style={styles.providerMeta}>
            <Text style={styles.providerName}>{proName}</Text>
            <Text style={styles.providerSub}>
              {booking?.specialty?.replaceAll("_", " ") || "Soin"} · {booking?.address || "Adresse"}
            </Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.priceValue}>{booking?.final_price_mad ?? booking?.budget_max_mad ?? "—"}</Text>
            <Text style={styles.priceUnit}>MAD</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {proPhone ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                void Linking.openURL(`tel:${proPhone}`);
              }}
            >
              <Phone size={18} color={Colors.primary} />
              <Text style={styles.secondaryBtnText}>Appeler</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push(`/patient/chat/${bookingId}`)}
          >
            <MessageCircle size={18} color={Colors.primary} />
            <Text style={styles.secondaryBtnText}>Message</Text>
          </TouchableOpacity>
          {arrived ? (
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => router.replace(`/patient/rating/${bookingId}`)}
            >
              <Text style={styles.completeBtnText}>Terminer</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Mise à jour du trajet…</Text>
          </View>
        ) : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  mapSection: { flex: 1, minHeight: 340, position: "relative" },
  headerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 5,
    paddingHorizontal: 20,
    paddingTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  etaPill: {
    borderRadius: 999,
    backgroundColor: "white",
    paddingHorizontal: 14,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  etaPillText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  mapMock: {
    flex: 1,
    backgroundColor: "#D4E8D4",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  roadHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "45%",
    height: 14,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  roadVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "55%",
    width: 14,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  patientPinWrap: { position: "absolute", left: "25%", top: "70%", alignItems: "center" },
  patientTag: {
    color: "white",
    backgroundColor: Colors.primary,
    fontSize: 10,
    fontWeight: "600",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  patientPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: "white",
  },
  proPinWrap: { position: "absolute", left: "55%", top: "45%" },
  proPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  proPinAvatar: { width: 32, height: 32, borderRadius: 16 },
  proPinText: { color: Colors.primary, fontSize: 14, fontWeight: "700" },
  bottomSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -18,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  },
  dragger: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    marginBottom: 10,
  },
  progressHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { color: Colors.textMuted, fontSize: 12 },
  progressValue: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.input,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 12,
  },
  progressBarFill: { height: "100%", backgroundColor: Colors.primary, borderRadius: 4 },
  providerCard: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  providerAvatar: { width: 56, height: 56, borderRadius: 28 },
  providerAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  providerAvatarText: { color: Colors.primary, fontSize: 18, fontWeight: "700" },
  providerMeta: { flex: 1 },
  providerName: { color: Colors.textPrimary, fontSize: 15, fontWeight: "600" },
  providerSub: { color: Colors.textMuted, fontSize: 12 },
  priceBlock: { alignItems: "flex-end" },
  priceValue: { color: Colors.primary, fontSize: 20, fontWeight: "700" },
  priceUnit: { color: Colors.textMuted, fontSize: 11 },
  actionsRow: { flexDirection: "row", gap: 8 },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "500" },
  completeBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  completeBtnText: { color: "white", fontSize: 13, fontWeight: "600" },
  loadingWrap: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  loadingText: { color: Colors.textMuted, fontSize: 12 },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
