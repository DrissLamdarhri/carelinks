/**
 * Admin: create yoga classes and manage their lifecycle. This is the ONLY
 * place yoga_sessions rows get created from within the app — until now
 * nothing did (rows only existed because someone inserted them by hand), and
 * complete_yoga_session()/cancel_yoga_session() (migration 0031) had no
 * caller anywhere either. RLS now restricts writes on yoga_sessions to
 * admins (migration 0041), so this screen is also the intended sole writer.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Calendar, CheckCircle2, ChevronDown, MapPin, Navigation, Plus, Users, X } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { showAppAlert } from "@/lib/app-alert";
import { geo } from "@/lib/db/geo";
import { CareLinkMapView, type LatLng } from "@/components/map/CareLinkMapView";
import {
  cancelYogaSession,
  completeYogaSession,
  createYogaSession,
  listAdminSessions,
  listYogaInstructors,
} from "@/lib/db/yoga";
import { CANCEL_REASON_ADMIN } from "@/lib/care-label";
import type { YogaCatalogEntry } from "@/types/yoga";

const LEVELS = ["Tous niveaux", "Débutant", "Intermédiaire", "Avancé"];
// LEVELS are the values persisted on yoga_sessions.level — keep them French.
// This maps each stored value to the key used to display it.
const LEVEL_KEY: Record<string, string> = {
  "Tous niveaux": "level_all",
  "Débutant": "level_beginner",
  "Intermédiaire": "level_intermediate",
  "Avancé": "level_advanced",
};
const DEFAULT_MAP_CENTER: LatLng = { lat: 34.037, lng: -5.004 }; // Fès

function toIsoFromParts(dateStr: string, timeStr: string): string | null {
  // dateStr "JJ/MM/AAAA", timeStr "HH:MM"
  const dm = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const tm = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const [, dd, mm, yyyy] = dm;
  const [, hh, min] = tm;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function AdminYogaSessionsScreen() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<YogaCatalogEntry[]>([]);
  const [instructors, setInstructors] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [instructorPickerOpen, setInstructorPickerOpen] = useState(false);
  const [levelPickerOpen, setLevelPickerOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [level, setLevel] = useState(LEVELS[0]);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, i] = await Promise.all([listAdminSessions(), listYogaInstructors()]);
      setSessions(s);
      setInstructors(i);
    } catch (e) {
      showAppAlert(t("error"), e instanceof Error ? e.message : t("sessions_load_error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const channel = supabase
        .channel("admin-yoga-sessions")
        .on("postgres_changes", { event: "*", schema: "public", table: "yoga_sessions" }, () => void load())
        .on("postgres_changes", { event: "*", schema: "public", table: "yoga_enrollments" }, () => void load())
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    }, [load]),
  );

  const resetForm = () => {
    setTitle("");
    setInstructorId(null);
    setAddress("");
    setCity("");
    setDateStr("");
    setStartTime("");
    setEndTime("");
    setCapacity("");
    setPrice("");
    setLevel(LEVELS[0]);
    setCoords(null);
  };

  const locateOnMap = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const current = await geo.getCurrentPosition();
      setCoords(current);
      const label = await geo.reverseGeocodeAddress(current.lat, current.lng);
      if (label) {
        const parts = label.split(",").map((p) => p.trim());
        if (parts.length > 1) {
          setAddress(parts.slice(0, -1).join(", "));
          setCity(parts[parts.length - 1]);
        } else {
          setAddress(label);
        }
      }
    } catch (e) {
      showAppAlert(t("error"), e instanceof Error ? e.message : t("admin_gps_unavailable"));
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (submitting) return;
    if (!title.trim() || !instructorId || !address.trim() || !city.trim()) {
      showAppAlert(t("admin_missing_fields_title"), t("admin_yoga_required_fields"));
      return;
    }
    const capacityNum = Number(capacity);
    const priceNum = Number(price);
    if (!Number.isFinite(capacityNum) || capacityNum <= 0) {
      showAppAlert(t("admin_invalid_capacity_title"), t("admin_capacity_must_be_positive"));
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      showAppAlert(t("admin_invalid_price_title"), t("admin_price_must_be_positive"));
      return;
    }
    const startIso = toIsoFromParts(dateStr, startTime);
    const endIso = toIsoFromParts(dateStr, endTime);
    if (!startIso || !endIso) {
      showAppAlert(t("admin_invalid_datetime_title"), t("admin_datetime_format_hint"));
      return;
    }
    const durationMin = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
    if (durationMin <= 0) {
      showAppAlert(t("admin_invalid_hours_title"), t("admin_end_after_start"));
      return;
    }

    setSubmitting(true);
    try {
      await createYogaSession({
        title: title.trim(),
        instructor_id: instructorId,
        address: address.trim(),
        city: city.trim(),
        starts_at: startIso,
        duration_min: durationMin,
        capacity: capacityNum,
        price_mad: priceNum,
        level,
        coords,
      });
      showAppAlert(t("admin_session_created_title"), t("admin_session_created_msg"));
      resetForm();
      setFormOpen(false);
      void load();
    } catch (e) {
      showAppAlert(t("error"), e instanceof Error ? e.message : t("admin_create_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = (session: YogaCatalogEntry) => {
    showAppAlert(t("admin_complete_session_title"), t("admin_complete_session_msg").replace("%s", session.title), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("finish"),
        onPress: async () => {
          setActingOn(session.id);
          try {
            await completeYogaSession(session.id);
          } catch (e) {
            showAppAlert(t("error"), e instanceof Error ? e.message : t("action_failed"));
          } finally {
            setActingOn(null);
          }
        },
      },
    ]);
  };

  const handleCancelClass = (session: YogaCatalogEntry) => {
    showAppAlert(
      t("admin_cancel_session_title"),
      t("admin_cancel_session_msg").replace("%s", session.title),
      [
        { text: t("admin_keep_session"), style: "cancel" },
        {
          text: t("admin_cancel_session_action"),
          style: "destructive",
          onPress: async () => {
            setActingOn(session.id);
            try {
              await cancelYogaSession(session.id, CANCEL_REASON_ADMIN);
            } catch (e) {
              showAppAlert(t("error"), e instanceof Error ? e.message : t("action_failed"));
            } finally {
              setActingOn(null);
            }
          },
        },
      ],
    );
  };

  const selectedInstructorName = instructors.find((i) => i.id === instructorId)?.full_name;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.title}>{t("yoga_sessions")}</Text>
      <Text style={s.subtitle}>{t("admin_yoga_subtitle")}</Text>

      <TouchableOpacity style={s.newBtn} onPress={() => setFormOpen((v) => !v)}>
        {formOpen ? <X size={16} color="#FFFFFF" /> : <Plus size={16} color="#FFFFFF" />}
        <Text style={s.newBtnTxt}>{formOpen ? t("close") : t("admin_new_session")}</Text>
      </TouchableOpacity>

      {formOpen ? (
        <View style={s.form}>
          <Text style={s.label}>{t("admin_title_label")}</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder={t("admin_title_ph")} placeholderTextColor={Colors.textSubtle} />

          <Text style={s.label}>{t("admin_instructor")}</Text>
          <TouchableOpacity style={s.selector} onPress={() => setInstructorPickerOpen((v) => !v)}>
            <Text style={selectedInstructorName ? s.selectorTxt : s.selectorPlaceholder}>
              {selectedInstructorName ?? t("admin_choose_instructor")}
            </Text>
            <ChevronDown size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {instructorPickerOpen ? (
            <View style={s.pickerList}>
              {instructors.length === 0 ? (
                <Text style={s.emptyPickerTxt}>{t("admin_no_yoga_instructors")}</Text>
              ) : (
                instructors.map((i) => (
                  <TouchableOpacity
                    key={i.id}
                    style={s.pickerItem}
                    onPress={() => { setInstructorId(i.id); setInstructorPickerOpen(false); }}
                  >
                    <Text style={s.pickerItemTxt}>{i.full_name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : null}

          <Text style={s.label}>{t("admin_level")}</Text>
          <TouchableOpacity style={s.selector} onPress={() => setLevelPickerOpen((v) => !v)}>
            <Text style={s.selectorTxt}>{LEVEL_KEY[level] ? t(LEVEL_KEY[level]) : level}</Text>
            <ChevronDown size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {levelPickerOpen ? (
            <View style={s.pickerList}>
              {LEVELS.map((l) => (
                <TouchableOpacity key={l} style={s.pickerItem} onPress={() => { setLevel(l); setLevelPickerOpen(false); }}>
                  <Text style={s.pickerItemTxt}>{LEVEL_KEY[l] ? t(LEVEL_KEY[l]) : l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <Text style={s.label}>{t("admin_center_address")}</Text>
          <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder={t("admin_center_address_ph")} placeholderTextColor={Colors.textSubtle} />

          <Text style={s.label}>{t("city")}</Text>
          <TextInput style={s.input} value={city} onChangeText={setCity} placeholder={t("admin_city_ph")} placeholderTextColor={Colors.textSubtle} />

          <View style={s.mapLabelRow}>
            <Text style={[s.label, { marginTop: 0 }]}>{t("admin_locate_on_map")}</Text>
            <TouchableOpacity style={s.locateBtn} onPress={locateOnMap} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Navigation size={13} color={Colors.primary} />
              )}
              <Text style={s.locateBtnTxt}>{t("admin_my_position")}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.mapPicker}>
            <CareLinkMapView
              center={coords ?? DEFAULT_MAP_CENTER}
              destination={coords ?? undefined}
              onMapPress={(c) => setCoords(c)}
              radiusKm={0}
            />
          </View>
          {coords ? (
            <View style={s.coordsRow}>
              <MapPin size={12} color={Colors.textMuted} />
              <Text style={s.coordsTxt}>
                {t("admin_coords_adjust_hint").replace("%s", `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)}
              </Text>
            </View>
          ) : (
            <Text style={s.coordsHint}>{t("admin_map_tap_hint")}</Text>
          )}

          <Text style={s.label}>{t("admin_date_label")}</Text>
          <TextInput style={s.input} value={dateStr} onChangeText={setDateStr} placeholder="12/08/2026" placeholderTextColor={Colors.textSubtle} keyboardType="numbers-and-punctuation" />

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t("admin_start_time")}</Text>
              <TextInput style={s.input} value={startTime} onChangeText={setStartTime} placeholder="18:00" placeholderTextColor={Colors.textSubtle} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t("admin_end_time")}</Text>
              <TextInput style={s.input} value={endTime} onChangeText={setEndTime} placeholder="19:00" placeholderTextColor={Colors.textSubtle} keyboardType="numbers-and-punctuation" />
            </View>
          </View>

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t("admin_capacity")}</Text>
              <TextInput style={s.input} value={capacity} onChangeText={setCapacity} placeholder="12" placeholderTextColor={Colors.textSubtle} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t("admin_price_mad")}</Text>
              <TextInput style={s.input} value={price} onChangeText={setPrice} placeholder="120" placeholderTextColor={Colors.textSubtle} keyboardType="number-pad" />
            </View>
          </View>

          <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={submit}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.submitTxt}>{t("admin_publish_session")}</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={s.sectionTitle}>{t("admin_existing_sessions")}</Text>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
      ) : sessions.length === 0 ? (
        <Text style={s.emptyTxt}>{t("admin_no_sessions_yet")}</Text>
      ) : (
        sessions.map((sess) => {
          const dt = new Date(sess.starts_at);
          const dateLabel = dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
          const busy = actingOn === sess.id;
          return (
            <View key={sess.id} style={s.sessionCard}>
              <View style={s.sessionHead}>
                <Text style={s.sessionTitle} numberOfLines={1}>{sess.title}</Text>
                <View style={[s.statusPill, sess.status === "scheduled" ? s.statusScheduled : sess.status === "completed" ? s.statusCompleted : s.statusCancelled]}>
                  <Text style={s.statusPillTxt}>
                    {sess.status === "scheduled" ? t("admin_session_scheduled") : sess.status === "completed" ? t("admin_session_completed") : t("admin_session_cancelled")}
                  </Text>
                </View>
              </View>
              <Text style={s.sessionMeta}>{sess.instructorDisplayName} · {[sess.address, sess.city].filter(Boolean).join(", ")}</Text>
              <View style={s.sessionMetaRow}>
                <View style={s.sessionMetaItem}>
                  <Calendar size={12} color={Colors.textMuted} />
                  <Text style={s.sessionMetaTxt}>{dateLabel}</Text>
                </View>
                <View style={s.sessionMetaItem}>
                  <Users size={12} color={Colors.textMuted} />
                  <Text style={s.sessionMetaTxt}>{t("admin_enrolled_ratio").replace("%s", `${sess.enrolledCount}/${sess.capacity}`)}</Text>
                </View>
                <Text style={s.sessionPrice}>{sess.price_mad} {t("mad")}</Text>
              </View>

              {sess.status === "scheduled" ? (
                <View style={s.sessionActions}>
                  <TouchableOpacity style={[s.actionBtn, s.actionComplete]} disabled={busy} onPress={() => handleComplete(sess)}>
                    {busy ? <ActivityIndicator size="small" color="#16A34A" /> : <CheckCircle2 size={14} color="#16A34A" />}
                    <Text style={[s.actionTxt, { color: "#16A34A" }]}>{t("finish")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, s.actionCancel]} disabled={busy} onPress={() => handleCancelClass(sess)}>
                    <X size={14} color={Colors.danger} />
                    <Text style={[s.actionTxt, { color: Colors.danger }]}>{t("cancel")}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  title: { color: Colors.textPrimary, fontSize: 22, fontFamily: "DMSerifDisplay_400Regular" },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginBottom: 16 },
  newBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: 46, borderRadius: 14, backgroundColor: Colors.primary, marginBottom: 16,
  },
  newBtnTxt: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  form: { backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 24, gap: 4 },
  label: { fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginTop: 12, marginBottom: 6 },
  input: { height: 46, borderRadius: 12, backgroundColor: Colors.input, paddingHorizontal: 14, fontSize: 14, color: Colors.textPrimary },
  row2: { flexDirection: "row", gap: 12 },
  selector: { height: 46, borderRadius: 12, backgroundColor: Colors.input, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectorTxt: { fontSize: 14, color: Colors.textPrimary },
  selectorPlaceholder: { fontSize: 14, color: Colors.textSubtle },
  pickerList: { backgroundColor: Colors.input, borderRadius: 12, marginTop: 6, overflow: "hidden" },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  pickerItemTxt: { fontSize: 14, color: Colors.textPrimary },
  emptyPickerTxt: { padding: 14, fontSize: 12, color: Colors.textMuted },
  mapLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 6 },
  locateBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 30, borderRadius: 8, backgroundColor: Colors.input },
  locateBtnTxt: { fontSize: 11.5, fontWeight: "700", color: Colors.primary },
  mapPicker: { height: 180, borderRadius: 14, overflow: "hidden" },
  coordsRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  coordsTxt: { fontSize: 11, color: Colors.textMuted, flex: 1 },
  coordsHint: { fontSize: 11, color: Colors.textSubtle, marginTop: 8 },
  submitBtn: { height: 50, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginTop: 20 },
  submitTxt: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary, marginBottom: 12 },
  emptyTxt: { color: Colors.textMuted, fontSize: 13 },
  sessionCard: { backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 10 },
  sessionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sessionTitle: { flex: 1, fontSize: 14.5, fontWeight: "700", color: Colors.textPrimary },
  statusPill: { paddingHorizontal: 9, height: 24, borderRadius: 12, justifyContent: "center" },
  statusScheduled: { backgroundColor: "#DBEAFE" },
  statusCompleted: { backgroundColor: "#DCFCE7" },
  statusCancelled: { backgroundColor: "#FDE8E8" },
  statusPillTxt: { fontSize: 11, fontWeight: "700", color: Colors.textPrimary },
  sessionMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 6 },
  sessionMetaRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  sessionMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionMetaTxt: { fontSize: 11, color: Colors.textMuted },
  sessionPrice: { fontSize: 13, fontWeight: "800", color: Colors.primary, marginLeft: "auto" },
  sessionActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 38, borderRadius: 10, borderWidth: 1.5 },
  actionComplete: { borderColor: "#DCFCE7", backgroundColor: "#F0FDF4" },
  actionCancel: { borderColor: "#FDE8E8", backgroundColor: "#FEF3F3" },
  actionTxt: { fontSize: 12.5, fontWeight: "700" },
});
