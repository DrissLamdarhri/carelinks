import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ChevronDown, LocateFixed, MapPin, Minus, Navigation, Plus } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import { toDbSpecialty } from "@/lib/db/types";
import { mockProfessionals } from "@/lib/mock-data";
import { BookingMap } from "../../components/BookingMap";

const careTypes = ["Pansement", "Injection IM", "Injection SC", "Perfusion", "Bilan sanguin", "Soins post-op", "Sonde urinaire", "Kinésithérapie"];
const serviceToCareIndex: Record<string, number> = {
  infirmier: 0,
  nurse: 0,
  psy: 4,
  psychologist: 4,
  yoga: 6,
  kine: 7,
  physio: 7,
};

function buildDates() {
  const result: { day: string; num: string; month: string; isoDate: string }[] = [];
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  for (let i = 0; i < 7; i += 1) {
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
const times = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

export default function PatientRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ service?: string }>();
  const { user } = useAuth();

  const initialService = typeof params.service === "string" ? params.service : "infirmier";
  const [careType, setCareType] = useState(serviceToCareIndex[initialService] ?? 0);
  const [showCareMenu, setShowCareMenu] = useState(false);
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedTime, setSelectedTime] = useState(4);
  const [price, setPrice] = useState(120);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => address.trim().length > 3, [address]);

  const serviceKey = useMemo(() => {
    const selected = careTypes[careType].toLowerCase();
    if (selected.includes("kin")) return "kine";
    if (selected.includes("yoga")) return "yoga";
    if (selected.includes("psy")) return "psy";
    return "infirmier";
  }, [careType]);

  const availablePreview = useMemo(() => {
    const specialtyMap: Record<string, string[]> = {
      infirmier: ["infirmier"],
      psy: ["psychologue"],
      yoga: ["yoga"],
      kine: ["kiné", "kine"],
    };
    const allowed = specialtyMap[serviceKey] ?? ["infirmier"];
    return mockProfessionals
      .filter((pro) => allowed.some((item) => pro.specialty.toLowerCase().includes(item)))
      .sort((a, b) => Number(b.isOnline) - Number(a.isOnline))
      .slice(0, 4);
  }, [serviceKey]);

  const handleLocate = async () => {
    if (locating) return;
    setErrorMessage(null);
    setLocating(true);
    try {
      const current = await geo.getCurrentPosition();
      setCoords(current);
      const city = await geo.reverseGeocode(current.lat, current.lng);
      if (city && !address.trim()) {
        setAddress(city);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Position GPS indisponible.");
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id || !canSubmit || submitting) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await db.patients.upsert({ id: user.id });

      const [hour, minute] = times[selectedTime].split(":");
      const scheduledAt = new Date(`${dates[selectedDate].isoDate}T${hour}:${minute}:00`).toISOString();

      let gps = coords;
      if (!gps) {
        try {
          gps = await geo.getCurrentPosition();
          setCoords(gps);
        } catch {
          gps = null;
        }
      }

      const booking = await db.bookings.create({
        patient_id: user.id,
        specialty: toDbSpecialty(serviceKey),
        notes: notes.trim() || null,
        address: address.trim(),
        budget_min_mad: Math.max(50, price - 20),
        budget_max_mad: price,
        scheduled_at: scheduledAt,
      });

      if (gps) {
        await geo.setBookingLocation(booking.id, gps.lat, gps.lng);
      }

      router.push(`/patient/waiting/${booking.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "La demande n'a pas pu être créée.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.mapZone}>
        <BookingMap radiusKm={5} onChange={(lat, lng) => setCoords({ lat, lng })} />

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.addressBar}>
            <MapPin size={16} color={Colors.primary} />
            <TextInput
              value={address}
              onChangeText={setAddress}
              style={styles.addressInput}
              placeholder="Entrez votre adresse..."
              placeholderTextColor={Colors.textSubtle}
            />
            <TouchableOpacity onPress={handleLocate} disabled={locating} style={styles.gpsBtn}>
              {locating ? <ActivityIndicator size="small" color={Colors.primary} /> : <Navigation size={13} color={Colors.primary} />}
              <Text style={styles.gpsText}>{coords ? "GPS ✓" : "GPS"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Votre demande</Text>

        <Text style={styles.label}>Type de soin</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowCareMenu((v) => !v)}>
          <Text style={styles.selectorText}>{careTypes[careType]}</Text>
          <ChevronDown size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        {showCareMenu ? (
          <View style={styles.menu}>
            {careTypes.map((item, index) => (
              <TouchableOpacity
                key={item}
                style={[styles.menuItem, index === careType && styles.menuItemActive]}
                onPress={() => {
                  setCareType(index);
                  setShowCareMenu(false);
                }}
              >
                <Text style={[styles.menuText, index === careType && styles.menuTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.rowChips}>
            {dates.map((date, index) => (
              <TouchableOpacity
                key={date.isoDate}
                style={[styles.dateChip, selectedDate === index && styles.dateChipActive]}
                onPress={() => setSelectedDate(index)}
              >
                <Text style={[styles.dateDay, selectedDate === index && styles.dateTextActive]}>{date.day}</Text>
                <Text style={[styles.dateNum, selectedDate === index && styles.dateTextActive]}>{date.num}</Text>
                <Text style={[styles.dateMonth, selectedDate === index && styles.dateTextActive]}>{date.month}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>Heure</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.rowChips}>
            {times.map((time, index) => (
              <TouchableOpacity
                key={time}
                style={[styles.timeChip, selectedTime === index && styles.timeChipActive]}
                onPress={() => setSelectedTime(index)}
              >
                <Text style={[styles.timeText, selectedTime === index && styles.timeTextActive]}>{time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>Notes (optionnel)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={styles.notesInput}
          multiline
          numberOfLines={2}
          placeholder="Ex: ordonnance disponible, allergie…"
          placeholderTextColor={Colors.textSubtle}
        />

        <Text style={styles.label}>
          Votre prix proposé <Text style={{ color: Colors.primary }}>(enchère inversée)</Text>
        </Text>
        <View style={styles.priceCard}>
          <TouchableOpacity style={styles.priceBtn} onPress={() => setPrice((v) => Math.max(50, v - 10))}>
            <Minus size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.priceCenter}>
            <Text style={styles.priceValue}>{price}</Text>
            <Text style={styles.priceUnit}>MAD</Text>
          </View>
          <TouchableOpacity style={styles.priceBtn} onPress={() => setPrice((v) => v + 10)}>
            <Plus size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.priceHint}>Prix moyen dans votre zone : 100–150 MAD</Text>

        <TouchableOpacity style={[styles.locateRow, locating && { opacity: 0.7 }]} onPress={handleLocate} disabled={locating}>
          <LocateFixed size={14} color={Colors.primary} />
          <Text style={styles.locateText}>{coords ? "Position GPS détectée" : "Utiliser ma position actuelle"}</Text>
        </TouchableOpacity>

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Aperçu développeur: ce qui se passe après publication</Text>
          <Text style={styles.previewStep}>1. Création de la demande (table bookings)</Text>
          <Text style={styles.previewStep}>2. Filtrage par service + distance des pros disponibles</Text>
          <Text style={styles.previewStep}>3. Notification envoyée aux pros ciblés</Text>
          <Text style={styles.previewStep}>4. Réception des offres en temps réel (écran attente)</Text>

          <Text style={styles.previewSubTitle}>Simulation des professionnels notifiés maintenant:</Text>
          {availablePreview.length === 0 ? (
            <Text style={styles.previewEmpty}>Aucun pro simulé pour ce service.</Text>
          ) : (
            availablePreview.map((pro) => (
              <View key={pro.id} style={styles.previewProRow}>
                <Text style={styles.previewProName}>
                  {pro.firstName} {pro.lastName}
                </Text>
                <Text style={[styles.previewProStatus, pro.isOnline ? styles.previewProStatusOnline : undefined]}>
                  {pro.isOnline ? "Disponible" : "Hors ligne"}
                </Text>
              </View>
            ))
          )}
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Navigation size={18} color="white" />
              <Text style={styles.submitText}>Publier ma demande</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.submitHint}>
          Les professionnels de votre zone verront votre offre et pourront répondre.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  mapZone: { height: "35%", paddingTop: 6, paddingHorizontal: 0 },
  topBar: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  addressBar: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "white",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addressInput: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: "500" },
  gpsBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  gpsText: { color: Colors.primary, fontSize: 11, fontWeight: "600" },
  sheet: {
    flex: 1,
    marginTop: -16,
    backgroundColor: "white",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#E0E0E0",
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 10,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  label: { fontSize: 12, color: Colors.textMuted, marginBottom: 7, marginTop: 8, fontWeight: "500" },
  selector: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
  },
  selectorText: { color: Colors.textPrimary, fontSize: 14 },
  menu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "white",
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  menuItemActive: { backgroundColor: Colors.surfaceWarm },
  menuText: { color: Colors.textPrimary, fontSize: 14 },
  menuTextActive: { color: Colors.primary, fontWeight: "600" },
  rowChips: { flexDirection: "row", gap: 8, marginBottom: 2 },
  dateChip: {
    width: 56,
    borderRadius: 16,
    backgroundColor: Colors.input,
    alignItems: "center",
    paddingVertical: 8,
  },
  dateChipActive: { backgroundColor: Colors.primary },
  dateDay: { fontSize: 10, color: Colors.textMuted },
  dateNum: { fontSize: 18, color: Colors.textPrimary, fontWeight: "700" },
  dateMonth: { fontSize: 9, color: Colors.textMuted },
  dateTextActive: { color: "white" },
  timeChip: {
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  timeChipActive: { backgroundColor: Colors.primary },
  timeText: { color: Colors.textPrimary, fontSize: 13 },
  timeTextActive: { color: "white" },
  notesInput: {
    minHeight: 68,
    borderRadius: 14,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    paddingTop: 12,
    color: Colors.textPrimary,
    textAlignVertical: "top",
  },
  priceCard: {
    borderRadius: 16,
    backgroundColor: Colors.input,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  priceBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  priceCenter: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  priceValue: { color: Colors.primary, fontSize: 34, fontWeight: "800", lineHeight: 38 },
  priceUnit: { color: Colors.textMuted, fontSize: 14, marginBottom: 6 },
  priceHint: { marginTop: 6, textAlign: "center", color: Colors.textMuted, fontSize: 11 },
  locateRow: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locateText: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  previewCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    backgroundColor: "#FAFAFA",
    padding: 12,
    gap: 4,
  },
  previewTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  previewStep: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  previewSubTitle: {
    marginTop: 7,
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  previewEmpty: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  previewProRow: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ECECEC",
    height: 34,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewProName: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: "600",
  },
  previewProStatus: {
    color: Colors.textSubtle,
    fontSize: 10,
    fontWeight: "700",
  },
  previewProStatusOnline: {
    color: Colors.success,
  },
  submitBtn: {
    marginTop: 14,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitBtnDisabled: { backgroundColor: "#D9D9D9" },
  submitText: { color: "white", fontSize: 15, fontWeight: "600" },
  submitHint: { marginTop: 8, textAlign: "center", color: Colors.textMuted, fontSize: 11 },
  errorText: { marginTop: 10, color: Colors.danger, fontSize: 12 },
});
