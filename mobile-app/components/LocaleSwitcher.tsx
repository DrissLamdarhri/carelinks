import { View, Text, TouchableOpacity } from "react-native";
import { Languages } from "lucide-react-native";
import { useI18n, type Locale } from "@/lib/i18n";
import { Colors } from "@/lib/colors";

// French + Arabic only (Moroccan solution).
const LABELS: Partial<Record<Locale, string>> = {
  fr: "FR",
  ar: "ع",
};

export function LocaleSwitcher({ compact = true }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: compact ? "rgba(255,255,255,0.15)" : Colors.card,
        borderRadius: 12,
        padding: compact ? 6 : 8,
      }}
    >
      <Languages size={14} color={compact ? "white" : Colors.primary} />
      <View style={{ flexDirection: "row", gap: 4 }}>
        {(Object.keys(LABELS) as Locale[]).map((l) => {
          const active = l === locale;
          return (
            <TouchableOpacity
              key={l}
              onPress={() => setLocale(l)}
              style={{
                paddingHorizontal: compact ? 8 : 10,
                paddingVertical: compact ? 4 : 5,
                borderRadius: 8,
                backgroundColor: active
                  ? compact
                    ? "white"
                    : Colors.primary
                  : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "600",
                  color: active
                    ? compact
                      ? Colors.primary
                      : "white"
                    : compact
                    ? "rgba(255,255,255,0.85)"
                    : Colors.textMuted,
                }}
              >
                {LABELS[l]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
