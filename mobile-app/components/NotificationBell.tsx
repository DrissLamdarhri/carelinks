import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

type AppNotification = {
  id: string;
  kind: "new_bid" | "bid_accepted" | "booking_status" | "message" | "system";
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

function iconForKind(kind: AppNotification["kind"]) {
  switch (kind) {
    case "new_bid":
      return "cash-outline";
    case "bid_accepted":
      return "checkmark-circle-outline";
    case "booking_status":
      return "calendar-outline";
    case "message":
      return "chatbubble-outline";
    default:
      return "notifications-outline";
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;
      setItems((data ?? []) as AppNotification[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Notifications indisponibles.";
      Alert.alert("Erreur", message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?.id) return;
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase.channel(`notifications:${user.id}:${Date.now()}`);
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      },
      () => {
        void fetchNotifications();
      }
    );
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchNotifications, user?.id]);

  const unreadCount = useMemo(
    () => items.filter((item) => item.read_at === null).length,
    [items]
  );

  const markAllAsRead = async () => {
    if (!user?.id || marking || unreadCount === 0) return;
    setMarking(true);
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (error) throw error;
      await fetchNotifications();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de marquer les notifications comme lues.";
      Alert.alert("Erreur", message);
    } finally {
      setMarking(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.bellBtn} onPress={() => setVisible(true)}>
        <Ionicons name="notifications-outline" size={20} color="white" />
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : (
              <ScrollView style={styles.list} contentContainerStyle={{ gap: 10 }}>
                {items.length === 0 ? (
                  <Text style={styles.emptyText}>Aucune notification.</Text>
                ) : (
                  items.map((item) => (
                    <View key={item.id} style={[styles.itemCard, item.read_at ? styles.itemRead : undefined]}>
                      <View style={styles.itemIcon}>
                        <Ionicons
                          name={iconForKind(item.kind)}
                          size={16}
                          color={item.read_at ? Colors.textMuted : Colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.itemBody}>{item.body ?? "—"}</Text>
                        <Text style={styles.itemTime}>
                          {new Date(item.created_at).toLocaleString("fr-MA", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.markBtn, (marking || unreadCount === 0) && { opacity: 0.6 }]}
              onPress={markAllAsRead}
              disabled={marking || unreadCount === 0}
            >
              {marking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.markBtnText}>Tout marquer comme lu</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    maxHeight: "72%",
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  list: {
    maxHeight: 380,
    marginBottom: 12,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceWarm,
  },
  itemRead: {
    opacity: 0.72,
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  itemBody: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  itemTime: {
    color: Colors.textSubtle,
    fontSize: 10,
    marginTop: 4,
  },
  markBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  markBtnText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
});
