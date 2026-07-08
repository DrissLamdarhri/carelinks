import { NotificationPreferences } from "@/components/NotificationPreferences";
import { useI18n } from "@/lib/i18n";

export default function PatientNotificationsScreen() {
  const { t } = useI18n();
  return <NotificationPreferences title={t("notifications")} />;
}
