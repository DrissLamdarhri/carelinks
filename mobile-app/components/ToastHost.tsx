import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Info, X } from "lucide-react-native";
import { subscribeToasts, type ToastItem, type ToastType } from "@/lib/toast";

const NAVY = "#0D0870";

const CFG: Record<ToastType, { color: string; bg: string; Icon: typeof Check }> = {
  success: { color: "#16A34A", bg: "#E7F6EC", Icon: Check },
  error: { color: "#E24B4A", bg: "#FDECEC", Icon: X },
  info: { color: NAVY, bg: "#EDE5CC", Icon: Info },
};

function ToastCard({ item }: { item: ToastItem }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 9, tension: 80 }).start();
  }, [a]);
  const cfg = CFG[item.type];
  const Icon = cfg.Icon;
  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: a,
          transform: [
            { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
            { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
          ],
        },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: cfg.color }]} />
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Icon size={16} color={cfg.color} strokeWidth={2.8} />
      </View>
      <Text style={styles.msg} numberOfLines={3}>{item.message}</Text>
    </Animated.View>
  );
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();
  useEffect(() => subscribeToasts(setItems), []);
  if (items.length === 0) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + 8 }]}>
      {items.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 8, zIndex: 9999, paddingHorizontal: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    width: "100%",
    maxWidth: 400,
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 16,
    overflow: "hidden",
    shadowColor: NAVY,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  msg: { flex: 1, color: "#1A1A1A", fontSize: 13.5, fontWeight: "600", lineHeight: 18 },
});
