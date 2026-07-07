import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { usePatientBookings } from "@/lib/db/realtime";
import { db } from "@/lib/db/dal";
import { supabase } from "@/lib/supabase";
import { buildDemoProfile, DEMO_PRO_1_ID, isDemoBookingId } from "@/lib/demo-booking";

const NAVY = "#0D0870";
const specialtyLabels: Record<string, string> = {
  nurse: "Infirmier", psychologist: "Psychologue", yoga_instructor: "Yoga", physiotherapist: "Kiné",
};

type Convo = {
  bookingId: string;
  name: string;
  avatar: string | null;
  specialty: string;
  active: boolean;
  lastBody: string | null;
  lastMine: boolean;
  lastTime: string | null;
  unread: boolean;
};

const initialsOf = (name: string) => name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

const timeAgo = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" });
  const yest = new Date(); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-MA", { day: "numeric", month: "short" });
};

export default function PatientMessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { bookings, loading } = usePatientBookings(user?.id ?? null);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [building, setBuilding] = useState(false);

  const chatReady = bookings.filter((b) => b.status !== "cancelled");

  const build = useCallback(async () => {
    if (!user?.id || chatReady.length === 0) { setConvos([]); return; }
    setBuilding(true);
    try {
      const items = await Promise.all(chatReady.map(async (b): Promise<Convo> => {
        const isDemo = isDemoBookingId(b.id);
        const profile = isDemo ? buildDemoProfile(DEMO_PRO_1_ID) : b.professional_id ? await db.profiles.get(b.professional_id).catch(() => null) : null;
        let lastBody: string | null = null, lastMine = false, lastTime: string | null = null;
        if (!isDemo) {
          const { data } = await supabase.from("messages").select("body, sender_id, created_at").eq("booking_id", b.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (data) { lastBody = data.body; lastMine = data.sender_id === user.id; lastTime = data.created_at; }
        }
        return {
          bookingId: b.id,
          name: profile?.full_name ?? "Professionnel",
          avatar: profile?.avatar_url ?? null,
          specialty: specialtyLabels[b.specialty] ?? b.specialty.replaceAll("_", " "),
          active: b.status === "matched" || b.status === "in_progress",
          lastBody, lastMine, lastTime,
          unread: !!lastBody && !lastMine,
        };
      }));
      items.sort((a, z) => (z.lastTime ? +new Date(z.lastTime) : 0) - (a.lastTime ? +new Date(a.lastTime) : 0));
      setConvos(items);
    } finally {
      setBuilding(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, JSON.stringify(chatReady.map((b) => b.id + b.status))]);

  useEffect(() => { void build(); }, [build]);

  // Refresh previews when any message arrives
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel("patient-convos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void build())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, build]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Messagerie</Text>
        <Text style={styles.subtitle}>Vos conversations avec les professionnels</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading || building ? (
          <View style={styles.center}><ActivityIndicator size="large" color={NAVY} /></View>
        ) : convos.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><MessageCircle size={22} color={Colors.textSubtle} /></View>
            <Text style={styles.emptyTitle}>Aucune conversation</Text>
            <Text style={styles.emptySub}>Vos échanges avec les professionnels apparaîtront ici.</Text>
          </View>
        ) : (
          convos.map((c) => (
            <TouchableOpacity key={c.bookingId} style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/patient/chat/${c.bookingId}`)}>
              <View style={styles.avatarWrap}>
                {c.avatar ? <Image source={{ uri: c.avatar }} style={styles.avatar} /> : (
                  <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarTxt}>{initialsOf(c.name)}</Text></View>
                )}
                {c.active ? <View style={styles.onlineDot} /> : null}
              </View>
              <View style={styles.info}>
                <View style={styles.topRow}>
                  <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                  {c.lastTime ? <Text style={[styles.time, c.unread && styles.timeUnread]}>{timeAgo(c.lastTime)}</Text> : null}
                </View>
                <View style={styles.bottomRow}>
                  <Text style={[styles.preview, c.unread && styles.previewUnread]} numberOfLines={1}>
                    {c.lastBody ? `${c.lastMine ? "Vous : " : ""}${c.lastBody}` : `${c.specialty} · démarrez la discussion`}
                  </Text>
                  {c.unread ? <View style={styles.unreadDot} /> : null}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: { backgroundColor: "white", paddingTop: 54, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  title: { fontSize: 26, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular" },
  subtitle: { color: Colors.textMuted, fontSize: 12.5, marginTop: 2 },
  content: { padding: 14, gap: 8 },
  center: { paddingVertical: 50, alignItems: "center" },

  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 18, padding: 12, shadowColor: NAVY, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  avatarWrap: { position: "relative" },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: "#E7E4FA", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: NAVY, fontSize: 15, fontWeight: "800" },
  onlineDot: { position: "absolute", right: 0, bottom: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: "#25D366", borderWidth: 2, borderColor: "white" },
  info: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  time: { color: Colors.textSubtle, fontSize: 11.5 },
  timeUnread: { color: NAVY, fontWeight: "700" },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  preview: { flex: 1, color: Colors.textMuted, fontSize: 13 },
  previewUnread: { color: Colors.textPrimary, fontWeight: "600" },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: NAVY },

  emptyCard: { backgroundColor: "white", borderRadius: 18, paddingVertical: 30, alignItems: "center", gap: 6, marginTop: 10 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  emptySub: { color: Colors.textMuted, fontSize: 12.5, textAlign: "center", paddingHorizontal: 30, lineHeight: 18 },
});
