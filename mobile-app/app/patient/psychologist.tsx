import { useState, useMemo } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, MapPin, MessageCircle, Star, Video } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { notifyAdminNewBooking } from "@/lib/admin/booking-notifications";
import { geo } from "@/lib/db/geo";

function buildDates() {
  const result: { day: string; num: string; month: string; isoDate: string }[] = [];
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  for (let i = 0; i < 90; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    result.push({
      day: days[date.getDay()],
      num: String(date.getDate()).padStart(2, "0"),
      month: months[date.getMonth()],
      isoDate: date.toISOString().split("T")[0],
    });
  }
  return result;
}

const dates = buildDates();

const slots = [
  { time: "09:00", taken: false },
  { time: "10:30", taken: false },
  { time: "14:00", taken: true },
  { time: "15:30", taken: false },
  { time: "16:00", taken: false },
  { time: "17:30", taken: true },
];

const consultTypes = [
  { key: "onsite", label: "in_person", icon: MapPin },
  { key: "video", label: "video", icon: Video },
  { key: "chat", label: "chat", icon: MessageCircle },
] as const;

export default function PsychologistBookingScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [consultType, setConsultType] = useState("onsite");

  const groupedMonths = useMemo(() => {
    const map = new Map<string, { key: string; label: string; dates: typeof dates }>();
    for (const d of dates) {
      const dt = new Date(d.isoDate);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      const label = dt.toLocaleString("fr-MA", { month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, { key, label, dates: [] as any });
      map.get(key)!.dates.push(d);
    }
    return Array.from(map.values());
  }, [dates]);

  const canConfirm = selectedSlot !== null;

  const handleReservePsych = async () => {
    if (!user?.id) {
      Alert.alert("Erreur", t("please_login_book"));
      return;
    }
    if (!canConfirm) return;
    setConfirming(true);
    try {
      const slotTime = selectedSlot !== null ? slots[selectedSlot].time : "09:00";
      const [hour, minute] = slotTime.split(":");
      const scheduledAt = new Date(`${dates[selectedDay].isoDate}T${hour}:${minute}:00`).toISOString();

      const booking = await db.bookings.create({
        patient_id: user.id,
        specialty: "psychologist",
        status: "matched",
        urgency: "normal",
        scheduled_at: scheduledAt,
        address: "Meknès, Maroc",
        notes: `Réservation psychologue — ${consultType}`,
        budget_min_mad: 150,
        budget_max_mad: 200,
        final_price_mad: 200,
      });

      try {
        await notifyAdminNewBooking(booking);
      } catch (err) {
        console.error("notifyAdminNewBooking failed:", err);
      }

      Alert.alert("✅ Réservation confirmée!", t("booking_sent_admin"), [
        {
          text: t("see_my_bookings"),
          onPress: () => router.push("/patient/bookings"),
        },
        { text: "Fermer", onPress: () => {} },
      ]);
    } catch (err) {
      console.error("Erreur lors de la réservation psy:", err);
      Alert.alert("Erreur", t("cannot_create_booking"));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("book_appointment_short")}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 18 }}>
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatarWrap}>
              <Image
                source={{
                  uri: "https://images.unsplash.com/photo-1621255612554-440c5e7b21b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
                }}
                style={styles.profileAvatar}
              />
              <View style={styles.onlineDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>Dr. Dalila Mansouri</Text>
              <Text style={styles.profileRole}>{t("clinical_psychologist")}</Text>
              <View style={styles.ratingRow}>
                <Star size={12} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.ratingText}>4.9</Text>
                <Text style={styles.ratingReviews}>(42)</Text>
              </View>
            </View>
          </View>
          <View style={styles.profileFooter}>
            <Text style={styles.profileFooterLabel}>{t("consultation")}</Text>
            <Text style={styles.profileFooterPrice}>200 MAD</Text>
          </View>
        </View>

        <Text style={styles.blockLabel}>{t("consultation_type")}</Text>
        <View style={styles.consultRow}>
          {consultTypes.map((item) => {
            const active = item.key === consultType;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setConsultType(item.key)}
                style={[styles.consultCard, active && styles.consultCardActive]}
              >
                <item.icon size={18} color={active ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.consultText, active && styles.consultTextActive]}>
                  {t(item.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.dateHeaderRow}>
          <Text style={styles.blockLabel}>{t("choose_date")}</Text>
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={[styles.monthNavBtn, selectedMonthIndex === 0 && styles.monthNavBtnDisabled]}
              onPress={() => {
                const prev = Math.max(0, selectedMonthIndex - 1);
                setSelectedMonthIndex(prev);
                const firstGlobal = dates.findIndex((d) => d.isoDate === groupedMonths[prev].dates[0].isoDate);
                if (firstGlobal >= 0) setSelectedDay(firstGlobal);
              }}
              disabled={selectedMonthIndex === 0}
            >
              <Text style={styles.monthNavBtnText}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.monthHeader}>{groupedMonths[selectedMonthIndex]?.label}</Text>

            <TouchableOpacity
              style={[
                styles.monthNavBtn,
                selectedMonthIndex === groupedMonths.length - 1 && styles.monthNavBtnDisabled,
              ]}
              onPress={() => {
                const next = Math.min(groupedMonths.length - 1, selectedMonthIndex + 1);
                setSelectedMonthIndex(next);
                const firstGlobal = dates.findIndex((d) => d.isoDate === groupedMonths[next].dates[0].isoDate);
                if (firstGlobal >= 0) setSelectedDay(firstGlobal);
              }}
              disabled={selectedMonthIndex === groupedMonths.length - 1}
            >
              <Text style={styles.monthNavBtnText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {groupedMonths[selectedMonthIndex] && (
          <View style={styles.monthGroup}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.rowChips}>
                {groupedMonths[selectedMonthIndex].dates.map((date) => {
                  const globalIndex = dates.findIndex((d) => d.isoDate === date.isoDate);
                  const active = selectedDay === globalIndex;
                  return (
                    <TouchableOpacity
                      key={date.isoDate}
                      style={[
                        styles.dayChip,
                        active && styles.dayChipActive,
                      ]}
                      onPress={() => setSelectedDay(globalIndex)}
                    >
                      <Text style={[styles.dayText, active && styles.dayTextActive]}>
                        {date.day}
                      </Text>
                      <Text style={[styles.dayNum, active && styles.dayTextActive]}>
                        {date.num}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        <Text style={styles.blockLabel}>{t("available_slots")}</Text>
        <View style={styles.slotsGrid}>
          {slots.map((slot, i) => {
            const active = selectedSlot === i;
            return (
              <TouchableOpacity
                key={slot.time}
                onPress={() => !slot.taken && setSelectedSlot(i)}
                disabled={slot.taken}
                style={[
                  styles.slotBtn,
                  slot.taken && styles.slotBtnTaken,
                  !slot.taken && active && styles.slotBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.slotText,
                    slot.taken && styles.slotTextTaken,
                    active && styles.slotTextActive,
                  ]}
                >
                  {slot.time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          disabled={!canConfirm || confirming}
          onPress={handleReservePsych}
          style={[styles.confirmBtn, (!canConfirm || confirming) && styles.confirmBtnDisabled]}
        >
          {confirming ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={[styles.confirmBtnText, (!canConfirm || confirming) && styles.confirmBtnTextDisabled]}>
              Confirmer — 200 MAD
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: {
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "600" },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  profileCard: { backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 14 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  profileAvatarWrap: { position: "relative" },
  profileAvatar: { width: 64, height: 64, borderRadius: 16 },
  onlineDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: "white",
  },
  profileName: { color: Colors.textPrimary, fontSize: 17, fontWeight: "600" },
  profileRole: { color: Colors.textMuted, fontSize: 13 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  ratingText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  ratingReviews: { color: Colors.textMuted, fontSize: 12 },
  profileFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileFooterLabel: { color: Colors.textMuted, fontSize: 13 },
  profileFooterPrice: { color: Colors.primary, fontSize: 16, fontWeight: "700" },
  blockLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 8 },
  consultRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  consultCard: {
    flex: 1,
    height: 72,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#F0F0F0",
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  consultCardActive: { borderColor: Colors.primary, backgroundColor: Colors.surfaceWarm },
  consultText: { color: Colors.textMuted, fontSize: 11, fontWeight: "500" },
  consultTextActive: { color: Colors.primary },
  daysRow: { gap: 8, marginBottom: 14 },
  dateHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthNavBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  monthNavBtnDisabled: { opacity: 0.4 },
  monthNavBtnText: { fontSize: 18, color: Colors.textPrimary, fontWeight: "700" },
  monthHeader: { fontSize: 16, color: Colors.textPrimary, fontWeight: "700", marginHorizontal: 8 },
  monthGroup: { marginBottom: 12 },
  rowChips: { flexDirection: "row", gap: 8, marginBottom: 14 },
  dayChip: {
    width: 52,
    borderRadius: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    alignItems: "center",
    paddingVertical: 8,
  },
  dayChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipDisabled: { backgroundColor: Colors.input, borderColor: Colors.input },
  dayText: { color: Colors.textMuted, fontSize: 10 },
  dayNum: { color: Colors.textPrimary, fontSize: 18, fontWeight: "700" },
  dayTextActive: { color: "white" },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotBtn: {
    width: "31.5%",
    height: 46,
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  slotBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotBtnTaken: { backgroundColor: Colors.input, borderColor: Colors.input },
  slotText: { color: Colors.textPrimary, fontSize: 14, fontWeight: "500" },
  slotTextActive: { color: "white" },
  slotTextTaken: { color: Colors.textSubtle, textDecorationLine: "line-through" },
  footer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: { backgroundColor: "#E0E0E0" },
  confirmBtnText: { color: "white", fontSize: 15, fontWeight: "600" },
  confirmBtnTextDisabled: { color: Colors.textMuted },
});
