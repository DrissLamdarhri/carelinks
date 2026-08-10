import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
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
  RotateCcw,
  ShieldCheck,
  HandMetal,
  Users,
  X,
} from "lucide-react-native";
import Svg, { Polyline as SvgPolyline } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Colors, KineColors, DEFAULT_AVATAR } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { getServiceTheme, isKineService } from "@/lib/service-theme";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { toastError, toastSuccess } from "@/lib/toast";
import { notifyAdminNewBooking } from "@/lib/admin/booking-notifications";
import { geo } from "@/lib/db/geo";
import { toDbSpecialty } from "@/lib/db/types";
import { CareLinkMapView, HAS_NATIVE_MAPS } from "../../components/map/CareLinkMapView";
import { BookingMap } from "../../components/BookingMap";
import type { ProPinData } from "../../components/map/Pins";
import { useServiceTypes } from "@/lib/service-types";
import { careTypeLabel } from "@/lib/care-label";
import { useIdentityGate } from "@/lib/hooks/useIdentityVerification";

// Default map center (Fès) used until the patient's GPS resolves.
const DEFAULT_CENTER = { lat: 34.037, lng: -5.004 };

// ── Draggable sheet: drag the handle down to see the full map, back up to
// return to the form. Same default position as before (sheet top at 42% of
// the screen); collapsing just slides it down toward the bottom edge,
// leaving a small peek strip (handle + title) so it's obvious how to bring
// it back up.
const SCREEN_H = Dimensions.get("window").height;
const SHEET_EXPANDED_TOP = SCREEN_H * 0.42;
const SHEET_PEEK_HEIGHT = 132;
const SHEET_COLLAPSED_TOP = SCREEN_H - SHEET_PEEK_HEIGHT;
const SHEET_MAX_TRANSLATE = SHEET_COLLAPSED_TOP - SHEET_EXPANDED_TOP;

const SEARCH_RADIUS_KM = 15;

// Display-only declutter: on a discovery map, pros seeded/located at nearly the
// same point stack into a single unreadable blob. Fan any near-duplicates out on
// a small circle (~180 m) so every face is visible and tappable. This nudges the
// PIN only, never the pro's real stored location (this isn't a navigation map).
function declutterPros<T extends { lat: number; lng: number }>(pros: T[]): T[] {
  const THRESH = 0.0006; // ~65 m → treat as the same spot
  const R = 0.0016;      // ~180 m fan radius
  const groups: T[][] = [];
  for (const p of pros) {
    const g = groups.find(
      (grp) => Math.abs(grp[0].lat - p.lat) < THRESH && Math.abs(grp[0].lng - p.lng) < THRESH,
    );
    if (g) g.push(p);
    else groups.push([p]);
  }
  const out: T[] = [];
  for (const g of groups) {
    if (g.length === 1) { out.push(g[0]); continue; }
    g.forEach((p, i) => {
      const ang = (2 * Math.PI * i) / g.length;
      out.push({ ...p, lat: p.lat + R * Math.cos(ang), lng: p.lng + R * Math.sin(ang) });
    });
  }
  return out;
}

// ── Kiné care type icons ─────────────────────────────────────────────────────
const kineCareIcons = [Bone, HandMetal, RotateCcw, Droplets, Activity, ShieldCheck] as const;

const fallbackNurseCareTypes = [
  "Pansement",
  "Injection IM",
  "Injection SC",
  "Perfusion",
  "Bilan sanguin",
  "Soins post-op",
  "Sonde urinaire",
];
const fallbackKineCareTypes = [
  "Rééducation fonctionnelle",
  "Massage thérapeutique",
  "Mobilisation articulaire",
  "Drainage lymphatique",
  "Rééducation respiratoire",
  "Prévention des blessures",
];

const DAY_KEYS = ["day_sun", "day_mon", "day_tue", "day_wed", "day_thu", "day_fri", "day_sat"];
const MONTH_KEYS = [
  "pat_mon_jan", "pat_mon_feb", "pat_mon_mar", "pat_mon_apr", "pat_mon_may", "pat_mon_jun",
  "pat_mon_jul", "pat_mon_aug", "pat_mon_sep", "pat_mon_oct", "pat_mon_nov", "pat_mon_dec",
];

function buildDates() {
  const result: { dayKey: string; num: string; monthKey: string; isoDate: string }[] = [];
  // Générer plusieurs jours pour permettre la réservation sur plusieurs mois (ex: 90 jours)
  for (let i = 0; i < 90; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    result.push({
      dayKey: DAY_KEYS[date.getDay()],
      num: String(date.getDate()).padStart(2, "0"),
      monthKey: MONTH_KEYS[date.getMonth()],
      isoDate: date.toISOString().split("T")[0],
    });
  }
  return result;
}

const dates = buildDates();
// "now" is a sentinel, not a real HH:mm slot — on-demand requests default to
// ASAP (scheduled_at: null), not a fixed 14:00 the patient never chose.
const NOW_SLOT = "now";
const times = [NOW_SLOT, "08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

export default function PatientRequestScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ service?: string; care?: string }>();
  const { user } = useAuth();
  const { ensureVerified } = useIdentityGate();
  const initialService = typeof params.service === "string" ? params.service : "infirmier";
  const normalizedService = initialService.toLowerCase();
  const isKine = isKineService(normalizedService);
  const serviceCategory = isKine ? "Kinésithérapeute" : "Infirmier";
  const serviceKey = isKine ? "kine" : "infirmier";

  // Fetch service types from database
  const { serviceTypes, loading } = useServiceTypes(serviceCategory);
  
  // Use fetched types, fallback to hardcoded if loading or empty
  const careTypes = useMemo(() => {
    if (loading || serviceTypes.length === 0) {
      return isKine ? fallbackKineCareTypes : fallbackNurseCareTypes;
    }
    return serviceTypes.map(st => st.name);
  }, [loading, serviceTypes, isKine]);

  const theme = useMemo(() => getServiceTheme(isKine ? "kine" : "infirmier") ?? ({
    primary: Colors.primary,
    surface: Colors.surfaceWarm,
    surfaceStrong: Colors.surfaceWarm,
    inputBorder: Colors.border,
    badgeBg: Colors.surfaceWarm,
  }), [isKine]);
  
  const [careType, setCareType] = useState(0);
  // Coming from the home screen's "Pansement" / "Injection" quick chips: jump
  // straight to that care type instead of leaving the picker on its default.
  const careParamAppliedRef = useRef(false);
  useEffect(() => {
    if (careParamAppliedRef.current || !params.care || careTypes.length === 0) return;
    const wanted = params.care.toLowerCase();
    const idx = careTypes.findIndex((c) => c.toLowerCase().includes(wanted));
    if (idx >= 0) {
      setCareType(idx);
      careParamAppliedRef.current = true;
    }
  }, [params.care, careTypes]);
  const [showCareMenu, setShowCareMenu] = useState(false);
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [selectedTime, setSelectedTime] = useState(0);
  const [price, setPrice] = useState(isKine ? 120 : 80);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapPros, setMapPros] = useState<ProPinData[]>([]);
  const [selectedProId, setSelectedProId] = useState<string | null>(null);
  const [fitAllKey, setFitAllKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calendar: group dates by month and render month sections (no selector)
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
  const canSubmit = useMemo(
    () => address.trim().length > 3 || coords !== null,
    [address, coords]
  );

  useEffect(() => {
    setCareType(0);
    setShowCareMenu(false);
  }, [isKine]);

  // Fetch real nearby professionals for the map once we know the patient's GPS.
  // Empty result → BookingMap shows its empty state (never fake pros in prod).
  useEffect(() => {
    // Query around the patient's GPS, or the default center before GPS is granted,
    // so real pros show immediately (not only after tapping GPS).
    const c = coords ?? DEFAULT_CENTER;
    let cancelled = false;
    (async () => {
      try {
        const rows = await geo.findNearbyProsForMap(c.lat, c.lng, {
          specialty: toDbSpecialty(serviceKey),
          radiusKm: SEARCH_RADIUS_KM,
        });
        if (cancelled) return;
        setMapPros(
          rows.map((r) => ({
            id: r.id,
            initials:
              (r.full_name ?? "")
                .split(" ")
                .map((w) => w[0])
                .filter(Boolean)
                .join("")
                .slice(0, 2)
                .toUpperCase() || "Pr",
            name: r.full_name ?? t("professional"),
            shortName: (r.full_name ?? "Pro").split(" ")[0],
            specialty: r.specialty,
            distanceKm: r.distanceKm,
            rating: r.rating_avg ?? 0,
            priceMad: r.hourly_rate_mad ?? 0,
            avatarUrl: r.avatar_url,
            lat: r.lat,
            lng: r.lng,
          }))
        );
      } catch (err) {
        if (!cancelled) setMapPros([]);
        console.warn("findNearbyProsForMap failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coords, serviceKey]);

  // Reverse-geocode a coordinate and reflect it in the address field.
  const syncAddressFromCoords = async (lat: number, lng: number) => {
    const label = await geo.reverseGeocodeAddress(lat, lng);
    setAddress(label ?? t("pat_my_position"));
  };

  const handleLocate = async () => {
    if (locating) return;
    setErrorMessage(null);

    // Permission gate with rationale + denied CTA (Play Store requirement).
    const status = await geo.getPermissionStatus();
    if (status === "undetermined") {
      const proceed = await new Promise<boolean>((resolve) =>
        Alert.alert(
          t("allow_location_title"),
          t("allow_location_body"),
          [
            { text: t("not_now"), style: "cancel", onPress: () => resolve(false) },
            { text: t("continue_btn"), onPress: () => resolve(true) },
          ]
        )
      );
      if (!proceed) return;
    } else if (status === "denied") {
      Alert.alert(
        t("location_disabled_title"),
        t("location_disabled_body"),
        [
          { text: t("cancel"), style: "cancel" },
          { text: t("open_settings"), onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    setLocating(true);
    try {
      const current = await geo.getCurrentPosition();
      setCoords(current);
      await syncAddressFromCoords(current.lat, current.lng);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("pat_gps_unavailable"));
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id || !canSubmit || submitting) return;
    // Identity gate — a pro is about to enter this person's home (migration 0030).
    if (!(await ensureVerified())) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      // Block suspended patients (too many late cancellations).
      const profile = await db.profiles.get(user.id).catch(() => null);
      if (profile?.is_suspended) {
        setErrorMessage(t("pat_suspended_late_cancels"));
        setSubmitting(false);
        return;
      }

      // Real reverse-bidding loop: create an OPEN booking that nearby pros can bid on.
      const specialty = toDbSpecialty(serviceKey);

      // Don't let a patient post into a void — check someone is actually online first.
      const availablePros = await db.pros.countAvailableForSpecialty(specialty).catch(() => 1);
      if (availablePros === 0) {
        setErrorMessage(t("no_pros_online_block"));
        toastError(t("no_pros_online_block"));
        setSubmitting(false);
        return;
      }

      await db.patients.upsert({ id: user.id });

      // "Maintenant" means exactly that — no fake future slot the patient
      // never picked. Matches how urgent/emergency requests already work
      // (scheduled_at stays null, waiting screen shows "Flexible").
      const scheduledAt =
        times[selectedTime] === NOW_SLOT
          ? null
          : (() => {
              const [hour, minute] = times[selectedTime].split(":");
              return new Date(`${dates[selectedDate].isoDate}T${hour}:${minute}:00`).toISOString();
            })();

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
        specialty,
        care_type: careTypes[careType] ?? null,
        notes: notes.trim() || null,
        address: address.trim(),
        budget_min_mad: Math.max(50, price - 20),
        budget_max_mad: price,
        scheduled_at: scheduledAt,
      });

      if (gps) {
        await geo.setBookingLocation(booking.id, gps.lat, gps.lng);
      }

      try {
        await notifyAdminNewBooking(booking);
      } catch (err) {
        console.error("notifyAdminNewBooking failed:", err);
      }

      toastSuccess(t("request_sent_searching"));
      // replace, not push: a real booking now exists — the empty request
      // form must leave the back-stack here, matching every later step in
      // this chain (waiting → offers → payment → tracking all already use
      // replace). Otherwise the back button/gesture could walk a patient who
      // already paid straight back into a blank "new request" screen.
      router.replace(`/patient/waiting/${booking.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("request_create_failed"));
      toastError(t("request_create_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  // Real online professionals, or nothing. The fallback to four invented
  // photo-pros ("Fatima Zahra", "Karim Mansour", …) is gone — an empty map is
  // an honest answer and the map renders an empty state for it.
  const effectivePros = declutterPros(mapPros);
  // Tapped pro → small detail card (clean, doesn't cover the map).
  const selectedPro = effectivePros.find((p) => p.id === selectedProId) ?? null;

  // Price-history sparkline (mock trend ending at the current proposed price).
  const SPARK_W = Dimensions.get("window").width - 88;
  const sparkPoints = useMemo(() => {
    const data = [80, 90, 85, 95, 100, 90, price];
    const lo = Math.min(...data);
    const hi = Math.max(...data);
    return data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * SPARK_W;
        const y = 26 - ((v - lo) / Math.max(1, hi - lo)) * 24;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [price, SPARK_W]);

  // Sheet drag: 0 = expanded (default), SHEET_MAX_TRANSLATE = collapsed (map
  // fully visible). Dragged via the handle only, so it never fights the
  // form's own ScrollView or its buttons/inputs.
  const sheetTranslateY = useSharedValue(0);
  const sheetDragStart = useSharedValue(0);
  const sheetPan = Gesture.Pan()
    .onStart(() => {
      sheetDragStart.value = sheetTranslateY.value;
    })
    .onUpdate((e) => {
      const next = sheetDragStart.value + e.translationY;
      sheetTranslateY.value = Math.max(0, Math.min(SHEET_MAX_TRANSLATE, next));
    })
    .onEnd((e) => {
      const shouldCollapse =
        sheetTranslateY.value > SHEET_MAX_TRANSLATE / 2 || e.velocityY > 800;
      sheetTranslateY.value = withSpring(shouldCollapse ? SHEET_MAX_TRANSLATE : 0, {
        damping: 22,
        stiffness: 220,
      });
    });
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  return (
    <View style={styles.root}>
      {/* Map fills the whole screen now — dragging the sheet down reveals it,
          not just the old fixed 42% strip. */}
      <View style={styles.mapFull}>
        {HAS_NATIVE_MAPS ? (
          <CareLinkMapView
            center={coords ?? DEFAULT_CENTER}
            patient={coords ?? undefined}
            pros={effectivePros}
            radiusKm={5}
            primaryColor={theme.primary}
            selectedProId={selectedProId}
            onSelectPro={(id) => setSelectedProId((prev) => (prev === id ? null : id))}
            onMapPress={(c) => {
              setCoords(c);
              void syncAddressFromCoords(c.lat, c.lng);
            }}
            followUser
            fitAllKey={fitAllKey}
          />
        ) : (
          <BookingMap
            radiusKm={5}
            initialLat={coords?.lat ?? DEFAULT_CENTER.lat}
            initialLng={coords?.lng ?? DEFAULT_CENTER.lng}
            pros={effectivePros}
            primaryColor={theme.primary}
            showChrome={false}
            onChange={(lat, lng) => {
              setCoords({ lat, lng });
              void syncAddressFromCoords(lat, lng);
            }}
          />
        )}
      </View>

      {/* Chrome overlay (search bar, buttons, pro card) — same footprint as
          before; `box-none` lets taps on the empty parts fall through to the
          map underneath. */}
      <View style={styles.mapChrome} pointerEvents="box-none">
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
              placeholder={t("enter_address_ph")}
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

        {/* Zoom-to-fit-all-pros */}
        <TouchableOpacity
          style={styles.fitAllBtn}
          onPress={() => setFitAllKey((k) => k + 1)}
          accessibilityRole="button"
          accessibilityLabel={t("pat_see_all_pros")}
        >
          <Users size={18} color={theme.primary} />
        </TouchableOpacity>

        {/* How many professionals are online around this point. Was a
            debug chip reading "N pros (réel)" or "N démo"; there is no démo
            any more, and neither label was written for a patient to read. */}
        {effectivePros.length > 0 ? (
          <View style={styles.countChip}>
            <View style={[styles.countDot, { backgroundColor: "#22C55E" }]} />
            <Text style={styles.countChipText}>
              {effectivePros.length} {t("pros_available_now")}
            </Text>
          </View>
        ) : null}

        {/* Friendly location activation: before GPS is granted the map is generic,
            so invite the patient to turn on their position to see pros around them. */}
        {!coords && !locating ? (
          <View style={styles.locateHint} pointerEvents="box-none">
            <View style={styles.locateCard}>
              <View style={styles.locateIcon}>
                <Navigation size={20} color={theme.primary} />
              </View>
              <Text style={styles.locateTitle}>{t("activate_location_title")}</Text>
              <Text style={styles.locateSub}>{t("activate_location_sub")}</Text>
              <TouchableOpacity
                style={[styles.locateBtn, { backgroundColor: theme.primary }]}
                onPress={handleLocate}
                activeOpacity={0.9}
              >
                <Navigation size={15} color="#fff" />
                <Text style={styles.locateBtnText}>{t("activate_location_cta")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Tapped pro → compact detail card at the bottom of the map (never clipped,
            real photo). Small and dismissable — does not cover the map. */}
        {selectedPro ? (
          <View style={styles.proCard}>
            <Image
              source={
                selectedPro.avatarUrl
                  ? { uri: selectedPro.avatarUrl }
                  : selectedPro.avatarSource ?? DEFAULT_AVATAR
              }
              style={styles.proCardAvatar}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.proCardName} numberOfLines={1}>{selectedPro.name}</Text>
              <Text style={styles.proCardMeta} numberOfLines={1}>
                {(selectedPro.specialty ?? "").replaceAll("_", " ")}
                {selectedPro.rating ? `  ·  ★ ${selectedPro.rating.toFixed(1)}` : ""}
                {selectedPro.distanceKm != null ? `  ·  ${selectedPro.distanceKm.toFixed(1)} km` : ""}
              </Text>
            </View>
            <View style={styles.proCardPrice}>
              <Text style={[styles.proCardPriceVal, { color: theme.primary }]}>{selectedPro.priceMad}</Text>
              <Text style={styles.proCardPriceUnit}>{t("mad")}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedProId(null)}
              style={styles.proCardClose}
              accessibilityRole="button"
              accessibilityLabel={t("close")}
            >
              <X size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
        {/* Drag handle — always visible/reachable regardless of scroll
            position, so the sheet can be pulled down to the map at any time. */}
        <GestureDetector gesture={sheetPan}>
          <View style={styles.grabberZone}>
            <View style={styles.grabber} />
          </View>
        </GestureDetector>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
        {/* ── Title row ── */}
        <Text style={styles.sheetTitle}>{t("your_request")}</Text>
        {isKine && (
          <View style={styles.kineBadgeRow}>
            <View style={styles.kinePill}>
              <View style={styles.kinePillDot} />
              <Text style={styles.kinePillText}>{t("spec_physio")}</Text>
            </View>
            <Text style={styles.kinePillSub}>{t("home_rehab")}</Text>
          </View>
        )}

        {/* ── Type de soin ── */}
        <Text style={styles.label}>{t("care_type")}</Text>

        {isKine ? (
          /* Kiné: visual chip grid */
          <View style={styles.kineCareGrid}>
            {careTypes.map((item: string, index: number) => {
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
                    {careTypeLabel(item, t)}
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
              <Text style={styles.selectorText}>{careTypeLabel(careTypes[careType], t)}</Text>
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
                      {careTypeLabel(item, t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        )}

        {/* ── Date ── */}
        <View style={styles.dateHeaderRow}>
          <Text style={styles.label}>{t("date")}</Text>
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={[styles.monthNavBtn, selectedMonthIndex === 0 && styles.monthNavBtnDisabled]}
              onPress={() => {
                const prev = Math.max(0, selectedMonthIndex - 1);
                setSelectedMonthIndex(prev);
                const firstGlobal = dates.findIndex((d) => d.isoDate === groupedMonths[prev].dates[0].isoDate);
                if (firstGlobal >= 0) setSelectedDate(firstGlobal);
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
                if (firstGlobal >= 0) setSelectedDate(firstGlobal);
              }}
              disabled={selectedMonthIndex === groupedMonths.length - 1}
            >
              <Text style={styles.monthNavBtnText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {groupedMonths[selectedMonthIndex] && (
          <View key={groupedMonths[selectedMonthIndex].key} style={styles.monthGroup}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.rowChips}>
                {groupedMonths[selectedMonthIndex].dates.map((date) => {
                  const globalIndex = dates.findIndex((d) => d.isoDate === date.isoDate);
                  return (
                    <TouchableOpacity
                      key={date.isoDate}
                      style={[
                        styles.dateChip,
                        selectedDate === globalIndex && styles.dateChipActive,
                        selectedDate === globalIndex && { backgroundColor: theme.primary },
                      ]}
                      onPress={() => setSelectedDate(globalIndex)}
                    >
                      <Text style={[styles.dateDay, selectedDate === globalIndex && styles.dateTextActive]}>
                        {t(date.dayKey)}
                      </Text>
                      <Text style={[styles.dateNum, selectedDate === globalIndex && styles.dateTextActive]}>
                        {date.num}
                      </Text>
                      <Text style={[styles.dateMonth, selectedDate === globalIndex && styles.dateTextActive]}>
                        {t(date.monthKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Heure ── */}
        <Text style={styles.label}>{t("time_lbl")}</Text>
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
                  {time === NOW_SLOT ? t("time_now") : time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Notes ── */}
        <Text style={styles.label}>{t("notes_optional")}</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={styles.notesInput}
          multiline
          numberOfLines={2}
          placeholder={t(isKine ? "pat_notes_ph_kine" : "pat_notes_ph_nurse")}
          placeholderTextColor={Colors.textSubtle}
        />

        {/* ── Prix ── */}
        {/* One key, not two sibling <Text> nodes: the parenthetical is part of
            the sentence and Arabic reverses the visual order. */}
        <Text style={styles.label}>{t("pat_your_proposed_price")}</Text>
        <View style={styles.priceCard}>
          <TouchableOpacity
            style={styles.priceBtn}
            onPress={() => setPrice((v) => Math.max(50, v - 10))}
          >
            <Minus size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.priceCenter}>
            <Text style={[styles.priceValue, { color: theme.primary }]}>{price}</Text>
            <Text style={styles.priceUnit}>{t("mad")}</Text>
          </View>
          <TouchableOpacity
            style={styles.priceBtn}
            onPress={() => setPrice((v) => v + 10)}
          >
            <Plus size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Price-history sparkline */}
        <View style={styles.sparkWrap}>
          <Svg width={SPARK_W} height={28}>
            <SvgPolyline
              points={sparkPoints}
              fill="none"
              stroke={Colors.primary}
              strokeOpacity={0.4}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        </View>

        <Text style={styles.priceHint}>
          {t("pat_avg_price_zone").replace("%s", isKine ? "100–150" : "60–120")}
        </Text>

        {/* ── GPS locate ── */}
        <TouchableOpacity
          style={[styles.locateRow, locating && { opacity: 0.7 }]}
          onPress={handleLocate}
          disabled={locating}
        >
          <LocateFixed size={14} color={Colors.primary} />
          <Text style={styles.locateText}>
            {coords ? t("pat_gps_detected") : t("use_my_location")}
          </Text>
        </TouchableOpacity>

        {/* ── Info hint (kiné only) ── */}
        {isKine && (
          <View style={styles.kineInfoStrip}>
            <Text style={styles.kineInfoText}>💡 {t("pat_kine_offer_hint")}</Text>
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
              <Text style={styles.submitText}>{t("publish_request")}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.submitHint}>
          {t(isKine ? "pat_submit_hint_kine" : "pat_submit_hint_pros")}
        </Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  mapFull: { ...StyleSheet.absoluteFillObject },
  mapChrome: { height: "42%", paddingTop: 6 },
  fitAllBtn: {
    position: "absolute",
    right: 14,
    top: 104,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    shadowColor: "#0D0870",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  sparkWrap: { marginTop: 8, marginBottom: 2, alignItems: "center" },
  countChip: {
    position: "absolute",
    top: 104,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    zIndex: 40,
    shadowColor: "#0D0870",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  countDot: { width: 8, height: 8, borderRadius: 4 },
  countChipText: { fontSize: 12, fontWeight: "700", color: "#0D0870" },
  locateHint: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  locateCard: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 20,
    alignItems: "center",
    marginHorizontal: 40,
    shadowColor: "#0D0870",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  locateIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#EDE9FE",
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
  },
  locateTitle: { fontSize: 15, fontWeight: "800", color: "#0D0870", textAlign: "center" },
  locateSub: { fontSize: 12.5, color: "#6B7280", textAlign: "center", marginTop: 4, lineHeight: 17 },
  locateBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
  },
  locateBtnText: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  proCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    zIndex: 45,
    shadowColor: "#0D0870",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  proCardAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#E9E7F2" },
  proCardName: { fontSize: 15, fontWeight: "800", color: "#111827" },
  proCardMeta: { fontSize: 12, fontWeight: "600", color: "#6B7280", marginTop: 2 },
  proCardPrice: { alignItems: "flex-end", marginRight: 4 },
  proCardPriceVal: { fontSize: 20, fontWeight: "800", lineHeight: 22 },
  proCardPriceUnit: { fontSize: 10, fontWeight: "600", color: "#9CA3AF" },
  proCardClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  carousel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    maxHeight: 82,
  },
  carouselContent: { paddingHorizontal: 12, gap: 10, alignItems: "center" },
  pcard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: 208,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: "#0D0870",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  pcardAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#E9E7F2" },
  pcardName: { fontSize: 14, fontWeight: "800", color: "#111827" },
  pcardMeta: { fontSize: 11, fontWeight: "600", color: "#6B7280", marginTop: 1 },
  pcardPrice: { fontSize: 13, fontWeight: "800", marginTop: 2 },
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
    position: "absolute",
    left: 0,
    right: 0,
    top: SHEET_EXPANDED_TOP,
    height: SCREEN_H - SHEET_EXPANDED_TOP,
    backgroundColor: "white",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 14,
  },
  sheetScroll: { flex: 1 },
  grabberZone: { paddingTop: 10, paddingBottom: 8, alignItems: "center" },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 24 },
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
  dateHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, marginTop: 12 },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthNavBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  monthNavBtnDisabled: { opacity: 0.4 },
  monthNavBtnText: { fontSize: 18, color: Colors.textPrimary, fontWeight: "700" },
  monthGroup: { marginTop: 8, marginBottom: 12 },
  monthHeader: { fontSize: 16, color: Colors.textPrimary, fontWeight: "700", marginBottom: 6 },
  errorText: { marginTop: 10, color: Colors.danger, fontSize: 12 },
});