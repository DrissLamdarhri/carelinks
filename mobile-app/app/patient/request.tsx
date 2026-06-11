import { useEffect, useMemo, useState } from "react";
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
import {
  ArrowLeft,
  ChevronDown,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Activity,
  Bone,
  Droplets,
  Lungs,
  RotateCcw,
  ShieldCheck,
  HandMetal,
} from "lucide-react-native";
import { Colors, KineColors } from "@/lib/colors";
import { getServiceTheme, isKineService } from "@/lib/service-theme";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { geo } from "@/lib/db/geo";
import { toDbSpecialty } from "@/lib/db/types";
import { BookingMap } from "../../components/BookingMap";

// ── Kiné care type icons ─────────────────────────────────────────────────────
const kineCareIcons = [Bone, HandMetal, RotateCcw, Droplets, Lungs, ShieldCheck] as const;

const nurseCareTypes = [
  "Pansement",
  "Injection IM",
  "Injection SC",
  "Perfusion",
  "Bilan sanguin",
  "Soins post-op",
  "Sonde urinaire",
];
const kineCareTypes = [
  "Rééducation fonctionnelle",
  "Massage thérapeutique",
  "Mobilisation articulaire",
  "Drainage lymphatique",
  "Rééducation respiratoire",
  "Prévention des blessures",
];

function buildDates() {
  const result: { day: string; num: string; month: string; isoDate: string }[] = [];
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  // Générer plusieurs jours pour permettre la réservation sur plusieurs mois (ex: 90 jours)
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
const times = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

export default function PatientRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ service?: string }>();
  const { user } = useAuth();
  const initialService = typeof params.service === "string" ? params.service : "infirmier";
  const normalizedService = initialService.toLowerCase();
  const isKine = isKineService(normalizedService);
  const serviceKey = isKine ? "kine" : "infirmier";
  const careTypes = useMemo(
    () => (serviceKey === "kine" ? kineCareTypes : nurseCareTypes),
    [serviceKey]
  );
  const theme = useMemo(() => getServiceTheme(serviceKey), [serviceKey]);
  const [careType, setCareType] = useState(0);
  const [showCareMenu, setShowCareMenu] = useState(false);
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedTime, setSelectedTime] = useState(4);
  const [price, setPrice] = useState(isKine ? 120 : 80);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const demoMode = true;

  const canSubmit = useMemo(
    () => address.trim().length > 3 || coords !== null,
    [address, coords]
  );

  useEffect(() => {
    setCareType(0);
    setShowCareMenu(false);
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
      } else if (!city && !address.trim()) {
        setAddress("Ma position");
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
      if (demoMode) {
        const mockBookingId = `demo-${serviceKey}-${Date.now()}`;
        await new Promise(resolve => setTimeout(resolve, 800));
        router.push(`/patient/waiting/${mockBookingId}`);
        setSubmitting(false);
        return;
      }

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
            <MapPin size={16} color={theme.primary} />
            <TextInput
              value={address}
              onChangeText={setAddress}
              style={styles.addressInput}
              placeholder="Entrez votre adresse..."
              placeholderTextColor={Colors.textSubtle}
            />
            <TouchableOpacity onPress={handleLocate} disabled={locating} style={styles.gpsBtn}>
              {locating ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Navigation size={13} color={theme.primary} />
              )}
              <Text style={[styles.gpsText, { color: theme.primary }]}>
                {coords ? "GPS ✓" : "GPS"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
      >
        <View style={styles.grabber} />

        {/* ── Title row ── */}
        <Text style={styles.sheetTitle}>Votre demande</Text>
        {isKine && (
          <View style={styles.kineBadgeRow}>
            <View style={styles.kinePill}>
              <View style={styles.kinePillDot} />
              <Text style={styles.kinePillText}>Kinésithérapie</Text>
            </View>
            <Text style={styles.kinePillSub}>Rééducation à domicile</Text>
          </View>
        )}

        {/* ── Type de soin ── */}
        <Text style={styles.label}>Type de soin</Text>

        {isKine ? (
          /* Kiné: visual chip grid */
          <View style={styles.kineCareGrid}>
            {kineCareTypes.map((item, index) => {
              const Icon = kineCareIcons[index] ?? Activity;
              const active = careType === index;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.kineCareChip, active && styles.kineCareChipActive]}
                  onPress={() => setCareType(index)}
                >
                  <View style={[styles.kineCareIcon, active && styles.kineCareIconActive]}>
                    <Icon size={14} color={active ? KineColors.primary : Colors.textMuted} />
                  </View>
                  <Text
                    style={[styles.kineCareText, active && styles.kineCareTextActive]}
                    numberOfLines={2}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* Nurse: dropdown */
          <>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowCareMenu((v) => !v)}
            >
              <Text style={styles.selectorText}>{careTypes[careType]}</Text>
              <ChevronDown size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {showCareMenu ? (
              <View style={styles.menu}>
                {careTypes.map((item, index) => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.menuItem,
                      index === careType && styles.menuItemActive,
                      index === careType && { backgroundColor: theme.surfaceStrong },
                    ]}
                    onPress={() => {
                      setCareType(index);
                      setShowCareMenu(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.menuText,
                        index === careType && styles.menuTextActive,
                        index === careType && { color: theme.primary },
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        )}

        {/* ── Date ── */}
        <Text style={styles.label}>Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.rowChips}>
            {dates.map((date, index) => (
              <TouchableOpacity
                key={date.isoDate}
                style={[
                  styles.dateChip,
                  selectedDate === index && styles.dateChipActive,
                  selectedDate === index && { backgroundColor: theme.primary },
                ]}
                onPress={() => setSelectedDate(index)}
              >
                <Text style={[styles.dateDay, selectedDate === index && styles.dateTextActive]}>
                  {date.day}
                </Text>
                <Text style={[styles.dateNum, selectedDate === index && styles.dateTextActive]}>
                  {date.num}
                </Text>
                <Text style={[styles.dateMonth, selectedDate === index && styles.dateTextActive]}>
                  {date.month}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Heure ── */}
        <Text style={styles.label}>Heure</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.rowChips}>
            {times.map((time, index) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeChip,
                  selectedTime === index && styles.timeChipActive,
                  selectedTime === index && { backgroundColor: theme.primary },
                ]}
                onPress={() => setSelectedTime(index)}
              >
                <Text style={[styles.timeText, selectedTime === index && styles.timeTextActive]}>
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Notes ── */}
        <Text style={styles.label}>Notes (optionnel)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={styles.notesInput}
          multiline
          numberOfLines={2}
          placeholder={
            isKine
              ? "Ex: ordonnance disponible, zone douloureuse, allergie…"
              : "Ex: ordonnance disponible, allergie…"
          }
          placeholderTextColor={Colors.textSubtle}
        />

        {/* ── Prix ── */}
        <Text style={styles.label}>
          Votre prix proposé{" "}
          <Text style={{ color: theme.primary }}>(enchère inversée)</Text>
        </Text>
        <View style={styles.priceCard}>
          <TouchableOpacity
            style={styles.priceBtn}
            onPress={() => setPrice((v) => Math.max(50, v - 10))}
          >
            <Minus size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.priceCenter}>
            <Text style={[styles.priceValue, { color: theme.primary }]}>{price}</Text>
            <Text style={styles.priceUnit}>MAD</Text>
          </View>
          <TouchableOpacity
            style={styles.priceBtn}
            onPress={() => setPrice((v) => v + 10)}
          >
            <Plus size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.priceHint}>
          {isKine
            ? "Prix moyen dans votre zone : 100–150 MAD"
            : "Prix moyen dans votre zone : 60–120 MAD"}
        </Text>

        {/* ── GPS locate ── */}
        <TouchableOpacity
          style={[styles.locateRow, locating && { opacity: 0.7 }]}
          onPress={handleLocate}
          disabled={locating}
        >
          <LocateFixed size={14} color={Colors.primary} />
          <Text style={styles.locateText}>
            {coords ? "Position GPS détectée" : "Utiliser ma position actuelle"}
          </Text>
        </TouchableOpacity>

        {/* ── Info hint (kiné only) ── */}
        {isKine && (
          <View style={styles.kineInfoStrip}>
            <Text style={styles.kineInfoText}>
              💡 Les kinés certifiés de votre zone verront votre offre et pourront répondre en moins de 5 min.
            </Text>
          </View>
        )}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: theme.primary },
            (!canSubmit || submitting) && styles.submitBtnDisabled,
          ]}
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
          {isKine
            ? "Les kinésithérapeutes de votre zone verront votre offre et pourront répondre."
            : "Les professionnels de votre zone verront votre offre et pourront répondre."}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  mapZone: { height: "35%", paddingTop: 6 },
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
  gpsText: { fontSize: 11, fontWeight: "600" },

  // Sheet
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
    backgroundColor: Colors.input,
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 4,
    fontFamily: "DMSerifDisplay_400Regular",
  },

  // Kiné identity row
  kineBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  kinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: KineColors.surfaceStrong,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  kinePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: KineColors.primary,
  },
  kinePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: KineColors.primary,
  },
  kinePillSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Shared form
  label: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 7,
    marginTop: 8,
    fontWeight: "500",
  },

  // Nurse dropdown
  selector: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "white",
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  menuItemActive: { backgroundColor: Colors.surfaceWarm },
  menuText: { color: Colors.textPrimary, fontSize: 14 },
  menuTextActive: { fontWeight: "600" },

  // Kiné care type grid
  kineCareGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 2,
  },
  kineCareChip: {
    width: "48.2%",
    borderRadius: 12,
    backgroundColor: Colors.input,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  kineCareChipActive: {
    backgroundColor: KineColors.surfaceStrong,
    borderWidth: 1,
    borderColor: KineColors.inputBorder,
  },
  kineCareIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  kineCareIconActive: {
    backgroundColor: KineColors.badgeBg,
  },
  kineCareText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
    color: Colors.textPrimary,
    lineHeight: 14,
  },
  kineCareTextActive: {
    color: KineColors.primary,
    fontWeight: "600",
  },

  // Date & time chips
  rowChips: { flexDirection: "row", gap: 8, marginBottom: 2 },
  dateChip: {
    width: 56,
    borderRadius: 16,
    backgroundColor: Colors.input,
    alignItems: "center",
    paddingVertical: 8,
  },
  dateChipActive: {},
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
  timeChipActive: {},
  timeText: { color: Colors.textPrimary, fontSize: 13 },
  timeTextActive: { color: "white" },

  // Notes
  notesInput: {
    minHeight: 68,
    borderRadius: 14,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    paddingTop: 12,
    color: Colors.textPrimary,
    textAlignVertical: "top",
    fontSize: 13,
  },

  // Price
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
  priceValue: { fontSize: 34, fontWeight: "800", lineHeight: 38 },
  priceUnit: { color: Colors.textMuted, fontSize: 14, marginBottom: 6 },
  priceHint: { marginTop: 6, textAlign: "center", color: Colors.textMuted, fontSize: 11 },

  // Locate
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

  // Kiné info hint
  kineInfoStrip: {
    marginTop: 12,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 12,
    padding: 12,
  },
  kineInfoText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "500",
    lineHeight: 16,
  },

  // Submit
  submitBtn: {
    marginTop: 14,
    height: 54,
    borderRadius: 16,
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