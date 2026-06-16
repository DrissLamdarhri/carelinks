import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MessageCircle, ChevronRight } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { usePatientBookings } from "@/lib/db/realtime";
import { db } from "@/lib/db/dal";
import { buildDemoProfile, DEMO_PRO_1_ID, isDemoBookingId } from "@/lib/demo-booking";
import type { Profile } from "@/lib/db/types";

const specialtyLabels: Record<string, string> = {
  nurse: "Infirmier",
  psychologist: "Psychologue",
  yoga_instructor: "Yoga",
  physiotherapist: "Kiné",
};

export default function PatientMessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { bookings, loading, error } = usePatientBookings(user?.id ?? null);
  const chatReadyBookings = bookings.filter((item) => item.status !== "cancelled");
  const [profilesById, setProfilesById] = useState<Record<string, Profile | null>>({});
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  const demoProfile = useMemo(() => buildDemoProfile(DEMO_PRO_1_ID), []);

  useEffect(() => {
    const ids = Array.from(
      new Set(chatReadyBookings.map((item) => item.professional_id).filter(Boolean))
    ) as string[];
    if (ids.length === 0) return;
    let active = true;
    setLoadingProfiles(true);
    Promise.all(
      ids.map(async (id) => {
        const profile = await db.profiles.get(id).catch(() => null);
        return [id, profile] as const;
      })
    )
      .then((entries) => {
        if (!active) return;
        const next = Object.fromEntries(entries);
        setProfilesById((prev) => ({ ...prev, ...next }));
      })
      .finally(() => {
        if (active) setLoadingProfiles(false);
      });
    return () => {
      active = false;
    };
  }, [chatReadyBookings]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Messagerie</Text>
      <Text style={styles.subtitle}>Choisissez une réservation pour discuter en temps réel.</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : null}

      {!loading &&
        chatReadyBookings.map((booking) => {
          const isDemo = isDemoBookingId(booking.id);
          const profile = isDemo
            ? demoProfile
            : booking.professional_id
              ? profilesById[booking.professional_id] ?? null
              : null;
          const name = profile?.full_name ?? "Professionnel";
          const avatar = profile?.avatar_url ?? null;
          const specialty =
            specialtyLabels[booking.specialty] ?? booking.specialty.replaceAll("_", " ");
          return (
            <TouchableOpacity
              key={booking.id}
              style={styles.chatCard}
              onPress={() => router.push(`/patient/chat/${booking.id}`)}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                </View>
              )}
              <View style={styles.chatInfo}>
                <Text style={styles.chatTitle} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.chatMeta} numberOfLines={1}>
                  {specialty} · {booking.status.replaceAll("_", " ")}
                </Text>
              </View>
              <View style={styles.chatAction}>
                <View style={styles.badge}>
                  <MessageCircle size={12} color={Colors.primary} />
                  <Text style={styles.badgeText}>Discuter</Text>
                </View>
                <ChevronRight size={16} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          );
        })}

      {!loading && chatReadyBookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucune conversation active.</Text>
        </View>
      ) : null}

      {loadingProfiles ? <Text style={styles.loadingText}>Chargement des profils…</Text> : null}
      {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  content: { padding: 20 },
  title: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginBottom: 12, marginTop: 4 },
  center: { paddingVertical: 40, alignItems: "center" },
  chatCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatar: { width: 46, height: 46, borderRadius: 14 },
  avatarFallback: {
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { color: Colors.primary, fontSize: 13, fontWeight: "700" },
  chatInfo: { flex: 1 },
  chatTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  chatMeta: { color: Colors.textMuted, fontSize: 12, textTransform: "capitalize" },
  chatAction: { alignItems: "flex-end", gap: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surfaceWarm,
  },
  badgeText: { color: Colors.primary, fontSize: 11, fontWeight: "600" },
  emptyCard: { backgroundColor: "white", borderRadius: 16, padding: 20, alignItems: "center" },
  emptyText: { color: Colors.textMuted, fontSize: 12 },
  loadingText: { marginTop: 8, color: Colors.textMuted, fontSize: 12, textAlign: "center" },
  errorText: { marginTop: 8, color: Colors.danger, fontSize: 12 },
});
