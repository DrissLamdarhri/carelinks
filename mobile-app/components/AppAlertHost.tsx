/**
 * Renders whatever `showAppAlert(...)` (lib/app-alert.ts) currently has
 * queued — the styled replacement for the native `Alert.alert`. Mounted
 * once in app/_layout.tsx, same as <ToastHost/>.
 *
 * Visual language matches the rest of the app's popups (the yoga class
 * reminder, the "déjà inscrit" notice, <CancellationDialog/>): centered
 * card, rounded corners, an icon circle whose color reads the situation at
 * a glance, buttons side-by-side for a 2-choice confirm and stacked for
 * anything else — mirroring how a native alert lays out 2 vs 3+ buttons.
 */
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle, Info } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { subscribeAppAlert, dismissAppAlert, type AppAlertItem, type AppAlertButton } from "@/lib/app-alert";

const NAVY = Colors.primary;

function iconFor(buttons: AppAlertButton[]) {
  if (buttons.some((b) => b.style === "destructive")) return { Icon: AlertTriangle, color: "#E24B4A", bg: "#FDE8E8" };
  if (buttons.length > 1) return { Icon: AlertTriangle, color: "#D97706", bg: "#FFF7E6" };
  return { Icon: Info, color: NAVY, bg: "#EDE5CC" };
}

function ButtonView({ button, onDone }: { button: AppAlertButton; onDone: () => void }) {
  const isDestructive = button.style === "destructive";
  const isCancel = button.style === "cancel";
  return (
    <TouchableOpacity
      style={[
        s.btn,
        isDestructive ? s.btnDestructive : isCancel ? s.btnCancel : s.btnDefault,
      ]}
      onPress={() => {
        onDone();
        button.onPress?.();
      }}
    >
      <Text
        style={[
          s.btnTxt,
          isDestructive ? s.btnTxtDestructive : isCancel ? s.btnTxtCancel : s.btnTxtDefault,
        ]}
      >
        {button.text}
      </Text>
    </TouchableOpacity>
  );
}

export function AppAlertHost() {
  const [item, setItem] = useState<AppAlertItem | null>(null);
  useEffect(() => subscribeAppAlert(setItem), []);

  const close = () => dismissAppAlert();
  if (!item) return null;

  const { Icon, color, bg } = iconFor(item.buttons);
  const sideBySide = item.buttons.length === 2;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={close} />
        <View style={s.card}>
          <View style={[s.iconWrap, { backgroundColor: bg }]}>
            <Icon size={26} color={color} />
          </View>
          <Text style={s.title}>{item.title}</Text>
          {item.message ? <Text style={s.message}>{item.message}</Text> : null}

          <View style={sideBySide ? s.rowActions : s.stackActions}>
            {item.buttons.map((b, i) => (
              <ButtonView key={`${b.text}-${i}`} button={b} onDone={close} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  card: {
    width: "100%", maxWidth: 380, backgroundColor: "#FFFFFF", borderRadius: 24,
    padding: 24, alignItems: "center",
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  message: { fontSize: 13.5, color: Colors.textMuted, textAlign: "center", marginTop: 8, lineHeight: 19 },

  stackActions: { width: "100%", marginTop: 20, gap: 10 },
  rowActions: { width: "100%", marginTop: 20, flexDirection: "row", gap: 10 },

  btn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", flex: 1 },
  btnDefault: { backgroundColor: NAVY },
  btnDestructive: { backgroundColor: "#E24B4A" },
  btnCancel: { backgroundColor: Colors.input },

  btnTxt: { fontSize: 14.5, fontWeight: "700" },
  btnTxtDefault: { color: "#FFFFFF" },
  btnTxtDestructive: { color: "#FFFFFF" },
  btnTxtCancel: { color: Colors.textPrimary },
});
