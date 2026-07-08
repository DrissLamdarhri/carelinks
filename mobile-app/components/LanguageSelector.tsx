import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, Globe } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n, type Locale } from "@/lib/i18n";

const NAVY = "#0D0870";

// French + Arabic (Moroccan solution). Arabic switches the app to RTL.
const OPTIONS: { code: Locale; native: string; sub: string; flag: string }[] = [
  { code: "fr", native: "Français", sub: "French", flag: "🇫🇷" },
  { code: "ar", native: "العربية", sub: "Arabic · RTL", flag: "🇲🇦" },
];

export function LanguageSelector({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { locale, setLocale, t } = useI18n();

  const choose = async (code: Locale) => {
    if (code === locale) { onClose(); return; }
    const needsReload = await setLocale(code);
    onClose();
    if (needsReload) {
      Alert.alert(
        code === "ar" ? "تغيير اللغة" : "Changement de langue",
        code === "ar"
          ? "الرجاء إعادة تشغيل التطبيق لتطبيق الاتجاه من اليمين إلى اليسار."
          : "Veuillez redémarrer l'application pour appliquer la nouvelle orientation.",
      );
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.head}>
            <View style={s.headIcon}><Globe size={18} color={NAVY} /></View>
            <Text style={s.title}>{t("language")}</Text>
          </View>

          {OPTIONS.map((o) => {
            const active = o.code === locale;
            return (
              <TouchableOpacity key={o.code} style={[s.row, active && s.rowActive]} onPress={() => choose(o.code)} activeOpacity={0.85}>
                <Text style={s.flag}>{o.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.native, active && { color: NAVY }]}>{o.native}</Text>
                  <Text style={s.sub}>{o.sub}</Text>
                </View>
                {active ? (
                  <View style={s.check}><Check size={15} color="white" strokeWidth={3} /></View>
                ) : (
                  <View style={s.radio} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 30 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  headIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EDE5CC", alignItems: "center", justifyContent: "center" },
  title: { color: Colors.textPrimary, fontSize: 19, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: "#EFEFEF", marginBottom: 10 },
  rowActive: { borderColor: NAVY, backgroundColor: "#F6F5FE" },
  flag: { fontSize: 26 },
  native: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  sub: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#D5D5D5" },
});
