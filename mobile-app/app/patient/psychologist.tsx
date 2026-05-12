import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, MapPin, MessageCircle, Star, Video } from "lucide-react-native";
import { Colors } from "@/lib/colors";

const days = [
  { day: "Lun", num: 14, available: true },
  { day: "Mar", num: 15, available: true },
  { day: "Mer", num: 16, available: true },
  { day: "Jeu", num: 17, available: false },
  { day: "Ven", num: 18, available: true },
  { day: "Sam", num: 19, available: true },
  { day: "Dim", num: 20, available: false },
];

const slots = [
  { time: "09:00", taken: false },
  { time: "10:30", taken: false },
  { time: "14:00", taken: true },
  { time: "15:30", taken: false },
  { time: "16:00", taken: false },
  { time: "17:30", taken: true },
];

const consultTypes = [
  { key: "onsite", label: "En personne", icon: MapPin },
  { key: "video", label: "Vidéo", icon: Video },
  { key: "chat", label: "Chat", icon: MessageCircle },
] as const;

export default function PsychologistBookingScreen() {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(2);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [consultType, setConsultType] = useState("onsite");

  const canConfirm = selectedSlot !== null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Prendre un RDV</Text>
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
              <Text style={styles.profileRole}>Psychologue Clinicienne</Text>
              <View style={styles.ratingRow}>
                <Star size={12} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.ratingText}>4.9</Text>
                <Text style={styles.ratingReviews}>(42)</Text>
              </View>
            </View>
          </View>
          <View style={styles.profileFooter}>
            <Text style={styles.profileFooterLabel}>Consultation</Text>
            <Text style={styles.profileFooterPrice}>200 MAD</Text>
          </View>
        </View>

        <Text style={styles.blockLabel}>Type de consultation</Text>
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
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.blockLabel}>Choisir une date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
          {days.map((d, i) => {
            const active = selectedDay === i;
            return (
              <TouchableOpacity
                key={`${d.day}-${d.num}`}
                onPress={() => d.available && setSelectedDay(i)}
                disabled={!d.available}
                style={[
                  styles.dayChip,
                  !d.available && styles.dayChipDisabled,
                  d.available && active && styles.dayChipActive,
                ]}
              >
                <Text style={[styles.dayText, active && styles.dayTextActive]}>{d.day}</Text>
                <Text style={[styles.dayNum, active && styles.dayTextActive]}>{d.num}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.blockLabel}>Créneaux disponibles</Text>
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
          disabled={!canConfirm}
          onPress={() => router.push("/patient/request?service=psy")}
          style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
        >
          <Text style={[styles.confirmBtnText, !canConfirm && styles.confirmBtnTextDisabled]}>
            Confirmer — 200 MAD
          </Text>
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
