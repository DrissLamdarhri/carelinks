import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check } from "lucide-react-native";
import { useI18n, type Locale } from "@/lib/i18n";

const NAVY = "#0D0870";

const OPTIONS: { code: Locale; native: string; sub: string; flag: string }[] = [
  { code: "fr", native: "Français", sub: "Continuer en français", flag: "🇫🇷" },
  { code: "ar", native: "العربية", sub: "المتابعة بالعربية", flag: "🇲🇦" },
];

export function LaunchLanguage() {
  const { setLocale } = useI18n();
  return (
    <LinearGradient colors={[NAVY, "#0A065A", "#071650"]} style={s.root}>
      <View style={s.top}>
        <Text style={s.logo}>CareLink</Text>
        <View style={s.logoLine} />
      </View>

      <View style={s.center}>
        <Text style={s.title}>Choisissez votre langue</Text>
        <Text style={s.titleAr}>اختر لغتك</Text>

        <View style={s.options}>
          {OPTIONS.map((o) => (
            <TouchableOpacity key={o.code} style={s.card} activeOpacity={0.9} onPress={() => setLocale(o.code)}>
              <Text style={s.flag}>{o.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.native}>{o.native}</Text>
                <Text style={s.sub}>{o.sub}</Text>
              </View>
              <View style={s.go}><Check size={16} color="white" strokeWidth={3} /></View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={s.footer}>Vous pourrez changer à tout moment · يمكنك التغيير في أي وقت</Text>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 26, paddingTop: 80, paddingBottom: 40 },
  top: { alignItems: "center", marginBottom: 40 },
  logo: { color: "white", fontSize: 40, fontFamily: "DMSerifDisplay_400Regular" },
  logoLine: { marginTop: 6, width: 36, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" },
  center: { flex: 1, justifyContent: "center" },
  title: { color: "white", fontSize: 22, fontWeight: "800", textAlign: "center" },
  titleAr: { color: "rgba(255,255,255,0.8)", fontSize: 20, fontWeight: "700", textAlign: "center", marginTop: 4, marginBottom: 30 },
  options: { gap: 14 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "white", borderRadius: 18, padding: 16 },
  flag: { fontSize: 30 },
  native: { color: "#1A1A1A", fontSize: 18, fontWeight: "800" },
  sub: { color: "#888780", fontSize: 13, marginTop: 2 },
  go: { width: 30, height: 30, borderRadius: 15, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  footer: { color: "rgba(255,255,255,0.55)", fontSize: 12, textAlign: "center" },
});
