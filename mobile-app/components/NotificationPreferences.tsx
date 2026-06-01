import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowLeft, Bell, Lock, Mail, MessageCircle, Shield, Smartphone } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import type { NotificationSettings } from "@/lib/db/types";
import { showToast } from "@/lib/toast";

type NotificationToggleKey =
  | "push_enabled"
  | "email_enabled"
  | "sms_enabled"
  | "appointment_enabled"
  | "messages_enabled"
  | "reminders_enabled"
  | "security_enabled";

type Row = {
  key: NotificationToggleKey;
  label: string;
  description?: string;
  icon: typeof Bell;
  disabled?: boolean;
};

const SMS_DISABLED = true;

export function NotificationPreferences({ title = "Notifications" }: { title?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const row = await db.notificationSettings.getOrCreate(user.id);
        if (active) setSettings(row);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Paramètres indisponibles.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const rows = useMemo<Row[]>(
    () => [
      { key: "push_enabled", label: "Notifications push", icon: Bell },
      { key: "email_enabled", label: "Emails", icon: Mail },
      {
        key: "sms_enabled",
        label: "SMS",
        description: SMS_DISABLED ? "Indisponible sans fournisseur SMS." : undefined,
        icon: Smartphone,
        disabled: SMS_DISABLED,
      },
    ],
    []
  );

  const categoryRows = useMemo<Row[]>(
    () => [
      { key: "appointment_enabled", label: "Rendez-vous", icon: Bell },
      { key: "messages_enabled", label: "Messages", icon: MessageCircle },
      { key: "reminders_enabled", label: "Rappels santé", icon: Shield },
      {
        key: "security_enabled",
        label: "Alertes de sécurité",
        description: "Toujours activé pour protéger votre compte.",
        icon: Lock,
        disabled: true,
      },
    ],
    []
  );

  const toggle = async (key: NotificationToggleKey, value: boolean) => {
    if (!settings || !user?.id || savingKey) return;
    if (key === "security_enabled") return;
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavingKey(key);
    try {
      const updated = await db.notificationSettings.update(user.id, { [key]: value });
      setSettings(updated);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Mise à jour impossible.");
      setSettings((prev) => (prev ? { ...prev, [key]: !value } : prev));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : null}

      {!loading && settings ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Canaux</Text>
            {rows.map((row) => (
              <View key={row.key} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.iconWrap}>
                    <row.icon size={16} color={Colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.label}>{row.label}</Text>
                    {row.description ? <Text style={styles.helper}>{row.description}</Text> : null}
                  </View>
                </View>
                <Switch
                  value={Boolean(settings[row.key])}
                  onValueChange={(value) => toggle(row.key, value)}
                  disabled={row.disabled || savingKey === row.key}
                  trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }}
                  thumbColor={row.disabled ? "#D1D5DB" : "#fff"}
                />
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Catégories</Text>
            {categoryRows.map((row) => (
              <View key={row.key} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.iconWrap}>
                    <row.icon size={16} color={Colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.label}>{row.label}</Text>
                    {row.description ? <Text style={styles.helper}>{row.description}</Text> : null}
                  </View>
                </View>
                <Switch
                  value={Boolean(settings[row.key])}
                  onValueChange={(value) => toggle(row.key, value)}
                  disabled={row.disabled || savingKey === row.key}
                  trackColor={{ false: "#E5E7EB", true: "#A5B4FC" }}
                  thumbColor={row.disabled ? "#D1D5DB" : "#fff"}
                />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular" },
  center: { paddingVertical: 40, alignItems: "center" },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 12,
  },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F4",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  helper: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
});
