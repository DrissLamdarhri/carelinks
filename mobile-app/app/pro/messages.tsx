import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { MessageCircle, Search } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n, tr } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { supabase } from "@/lib/supabase";
import type { Booking } from "@/lib/db/types";

const NAVY = "#0D0870";

type Convo = {
  bookingId: string;
  name: string;
  avatar: string | null;
  meta: string;
  active: boolean;
  lastBody: string | null;
  lastMine: boolean;
  lastTime: string | null;
  unread: boolean;
};

const initialsOf = (name: string) => name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

const timeAgo = (iso: string) => {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" });
  const yest = new Date(); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return tr("yesterday");
  return d.toLocaleDateString("fr-MA", { day: "numeric", month: "short" });
};

export default function ProMessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? convos.filter((c) => c.name.toLowerCase().includes(q)) : convos;
  }, [convos, query]);

  const build = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const rows = (await db.bookings.listForPro(user.id)) as Booking[];
      const chatReady = rows.filter((b) => ["matched", "en_route", "in_progress", "completed"].includes(b.status));

      // One conversation per patient (not per booking) — group shared bookings.
      const groups = new Map<string, Booking[]>();
      for (const b of chatReady) {
        if (!b.patient_id) continue;
        const arr = groups.get(b.patient_id) ?? [];
        arr.push(b);
        groups.set(b.patient_id, arr);
      }

      const items = await Promise.all(
        Array.from(groups.entries()).map(async ([patientId, bs]): Promise<Convo> => {
          const rep = [...bs].sort((a, z) => +new Date(z.created_at) - +new Date(a.created_at))[0];
          const ids = bs.map((b) => b.id);
          const patient = await db.profiles.get(patientId).catch(() => null);
          let lastBody: string | null = null, lastMine = false, lastTime: string | null = null;
          const { data } = await supabase
            .from("messages")
            .select("body, sender_id, created_at")
            .in("booking_id", ids)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) { lastBody = data.body; lastMine = data.sender_id === user.id; lastTime = data.created_at; }
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .in("booking_id", ids)
            .neq("sender_id", user.id)
            .is("read_at", null);
          return {
            bookingId: rep.id,
            name: patient?.full_name ?? t("patient"),
            avatar: patient?.avatar_url ?? null,
            meta: rep.address ?? t("at_home"),
            active: bs.some((b) => b.status === "matched" || b.status === "in_progress"),
            lastBody, lastMine, lastTime,
            unread: (count ?? 0) > 0,
          };
        }),
      );
      items.sort((a, z) => (z.lastTime ? +new Date(z.lastTime) : 0) - (a.lastTime ? +new Date(a.lastTime) : 0));
      setConvos(items);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void build(); }, [build]));

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel("pro-convos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void build())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, build]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("messaging_title")}</Text>
        <Text style={styles.subtitle}>{t("conversations_with_patients")}</Text>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("search_conversation")}
            placeholderTextColor={Colors.textSubtle}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={NAVY} /></View>
        ) : shown.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><MessageCircle size={22} color={Colors.textSubtle} /></View>
            <Text style={styles.emptyTitle}>{query ? t("no_results") : t("no_conversation")}</Text>
            <Text style={styles.emptySub}>{query ? t("try_another_search") : t("convos_patients_hint")}</Text>
          </View>
        ) : (
          shown.map((c) => (
            <TouchableOpacity key={c.bookingId} style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/pro/chat/${c.bookingId}`)}>
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
                    {c.lastBody ? `${c.lastMine ? t("you_prefix") : ""}${c.lastBody}` : `${c.meta} · ${t("start_discussion")}`}
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
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surfaceWarm, borderRadius: 12, paddingHorizontal: 12, height: 42, marginTop: 12 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 0 },
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
  emptySub: { color: Colors.textMuted, fontSize: 12.5, textAlign: "center", paddingHorizontal: 26, lineHeight: 18 },
});
