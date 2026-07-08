import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle, CalendarClock, Zap } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import type { UrgencyLevel } from "@/lib/db/types";

const LEVELS: { key: UrgencyLevel; label: string; desc: string; color: string; bg: string; icon: typeof Zap }[] = [
  { key: "normal", label: "urg_normal", desc: "urg_normal_desc", color: "#16A34A", bg: "#ECFDF5", icon: CalendarClock },
  { key: "urgent", label: "urg_urgent", desc: "urg_urgent_desc", color: "#F59E0B", bg: "#FFFBEB", icon: Zap },
  { key: "emergency", label: "urg_emergency", desc: "urg_emergency_desc", color: "#E24B4A", bg: "#FEF2F2", icon: AlertTriangle },
];
const BANNER: Record<UrgencyLevel, string> = {
  normal: "urg_normal_banner",
  urgent: "urg_urgent_banner",
  emergency: "urg_emergency_banner",
};

export function UrgencySelector({ value, onChange }: { value: UrgencyLevel; onChange: (v: UrgencyLevel) => void }) {
  const { t } = useI18n();
  const active = LEVELS.find((l) => l.key === value) ?? LEVELS[0];

  return (
    <View>
      <Text style={styles.title}>{t("urgency_title")}</Text>
      <View style={styles.row}>
        {LEVELS.map((l) => {
          const on = l.key === value;
          return (
            <TouchableOpacity
              key={l.key}
              activeOpacity={0.9}
              onPress={() => onChange(l.key)}
              style={[styles.card, { borderColor: on ? l.color : "#ECECEC", backgroundColor: on ? l.bg : "#fff" }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: on ? l.color : "#F3F3F5" }]}>
                <l.icon size={16} color={on ? "#fff" : Colors.textMuted} strokeWidth={2.2} />
              </View>
              <Text style={[styles.label, { color: on ? l.color : Colors.textPrimary }]}>{t(l.label)}</Text>
              <Text style={styles.desc}>{t(l.desc)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Danger-aware banner */}
      <View style={[styles.banner, { backgroundColor: active.bg, borderColor: active.color + "55" }]}>
        {value === "emergency" ? <AlertTriangle size={16} color={active.color} /> : value === "urgent" ? <Zap size={16} color={active.color} /> : <CalendarClock size={16} color={active.color} />}
        <Text style={[styles.bannerTxt, { color: value === "normal" ? Colors.textPrimary : active.color }]}>{t(BANNER[value])}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  card: { flex: 1, borderRadius: 14, borderWidth: 2, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", gap: 5 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12.5, fontWeight: "800" },
  desc: { color: Colors.textMuted, fontSize: 10, textAlign: "center", lineHeight: 13 },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, borderWidth: 1, padding: 11, marginTop: 10 },
  bannerTxt: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "600" },
});
