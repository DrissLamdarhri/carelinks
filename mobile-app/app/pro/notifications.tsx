/**
 * Pro notifications — real list from the `notifications` table, live-updating,
 * with tap-to-open the related booking.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Banknote,
  Bell,
  CalendarCheck,
  CheckCheck,
  CheckCircle2,
  MessageCircle,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";

type Notif = {
  id: string;
  kind: "new_bid" | "bid_accepted" | "booking_status" | "message" | "system";
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
};

function iconFor(kind: Notif["kind"]) {
  switch (kind) {
    case "new_bid":
      return Banknote;
    case "bid_accepted":
      return CheckCircle2;
    case "booking_status":
      return CalendarCheck;
    case "message":
      return MessageCircle;
    default:
      return Bell;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString("fr-MA", { day: "numeric", month: "short" });
}

export default function ProNotificationsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, read_at, created_at, payload")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as Notif[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
    if (!user?.id) return;
    const channel = supabase
      .channel(`pro-notifs:${user.id}:${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [user?.id, load]);

  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!user?.id || unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
  };

  const open = async (n: Notif) => {
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    }
    const bookingId = (n.payload?.booking_id as string) ?? null;
    if (bookingId && (n.kind === "bid_accepted" || n.kind === "booking_status")) {
      router.push(`/pro/tracking/${bookingId}`);
    }
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("notifications")}</Text>
          {unread > 0 ? <Text style={s.sub}>{unread} non lue{unread > 1 ? "s" : ""}</Text> : null}
        </View>
        {unread > 0 ? (
          <TouchableOpacity style={s.markAll} onPress={markAllRead}>
            <CheckCheck size={15} color={Colors.primary} />
            <Text style={s.markAllTxt}>{t("mark_all_read")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Bell size={34} color={Colors.textSubtle} />
          <Text style={s.emptyTxt}>{t("no_notifications")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        >
          {items.map((n) => {
            const Icon = iconFor(n.kind);
            const unreadItem = !n.read_at;
            return (
              <TouchableOpacity key={n.id} activeOpacity={0.85} onPress={() => open(n)} style={[s.card, unreadItem && s.cardUnread]}>
                <View style={[s.iconWrap, unreadItem && s.iconWrapUnread]}>
                  <Icon size={18} color={unreadItem ? Colors.primary : Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, unreadItem && { fontWeight: "800" }]} numberOfLines={1}>{n.title}</Text>
                  {n.body ? <Text style={s.cardBody} numberOfLines={2}>{n.body}</Text> : null}
                  <Text style={s.cardTime}>{timeAgo(n.created_at)}</Text>
                </View>
                {unreadItem ? <View style={s.dot} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingTop: 52, paddingBottom: 14, paddingHorizontal: 18,
    backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: Colors.textPrimary },
  sub: { fontSize: 12, color: Colors.primary, marginTop: 1 },
  markAll: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 999, backgroundColor: Colors.surfaceWarm },
  markAllTxt: { color: Colors.primary, fontSize: 12, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 },
  emptyTxt: { color: Colors.textMuted, fontSize: 14, textAlign: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 16, padding: 13 },
  cardUnread: { backgroundColor: "#FBFAFF", borderWidth: 1, borderColor: "#E7E4FA" },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center" },
  iconWrapUnread: { backgroundColor: "#EDE9FF" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  cardBody: { fontSize: 12, color: Colors.textMuted, marginTop: 2, lineHeight: 16 },
  cardTime: { fontSize: 11, color: Colors.textSubtle, marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primary },
});
