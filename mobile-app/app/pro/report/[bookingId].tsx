import { useLocalSearchParams } from "expo-router";
import { ReportProblemScreen } from "@/components/ReportProblemScreen";

export default function ProReportScreen() {
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  if (!bookingId) return null;
  return <ReportProblemScreen role="pro" bookingId={bookingId} />;
}
