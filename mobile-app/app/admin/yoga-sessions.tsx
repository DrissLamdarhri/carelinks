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
import type { YogaCatalogEntry } from "@/types/yoga";

const LEVELS = ["Tous niveaux", "Débutant", "Intermédiaire", "Avancé"];
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
      showAppAlert("Erreur", e instanceof Error ? e.message : "Impossible de charger les séances.");
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
      showAppAlert("Erreur", e instanceof Error ? e.message : "Position GPS indisponible.");
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (submitting) return;
    if (!title.trim() || !instructorId || !address.trim() || !city.trim()) {
      showAppAlert("Champs manquants", "Titre, instructeur, adresse et ville sont obligatoires.");
      return;
    }
    const capacityNum = Number(capacity);
    const priceNum = Number(price);
    if (!Number.isFinite(capacityNum) || capacityNum <= 0) {
      showAppAlert("Capacité invalide", "La capacité doit être un nombre supérieur à 0.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      showAppAlert("Prix invalide", "Le prix doit être un nombre supérieur à 0.");
      return;
    }
    const startIso = toIsoFromParts(dateStr, startTime);
    const endIso = toIsoFromParts(dateStr, endTime);
    if (!startIso || !endIso) {
      showAppAlert("Date/heure invalide", "Utilisez les formats JJ/MM/AAAA et HH:MM.");
      return;
    }
    const durationMin = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
    if (durationMin <= 0) {
      showAppAlert("Heures invalides", "L'heure de fin doit être après l'heure de début.");
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
      showAppAlert("Séance créée", "La séance est maintenant visible dans le catalogue patient.");
      resetForm();
      setFormOpen(false);
      void load();
    } catch (e) {
      showAppAlert("Erreur", e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = (session: YogaCatalogEntry) => {
    showAppAlert("Terminer la séance ?", `"${session.title}" sera marquée terminée et les réservations liées seront clôturées (paiement libéré).`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Terminer",
        onPress: async () => {
          setActingOn(session.id);
          try {
            await completeYogaSession(session.id);
          } catch (e) {
            showAppAlert("Erreur", e instanceof Error ? e.message : "Action impossible.");
          } finally {
            setActingOn(null);
          }
        },
      },
    ]);
  };

  const handleCancelClass = (session: YogaCatalogEntry) => {
    showAppAlert(
      "Annuler toute la séance ?",
      `Tous les élèves inscrits à "${session.title}" seront notifiés et leurs réservations annulées.`,
      [
        { text: "Garder la séance", style: "cancel" },
        {
          text: "Annuler la séance",
          style: "destructive",
          onPress: async () => {
            setActingOn(session.id);
            try {
              await cancelYogaSession(session.id, "Annulée par l'administration");
            } catch (e) {
              showAppAlert("Erreur", e instanceof Error ? e.message : "Action impossible.");
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
      <Text style={s.title}>Séances de yoga</Text>
      <Text style={s.subtitle}>Création et gestion des cours proposés au catalogue.</Text>

      <TouchableOpacity style={s.newBtn} onPress={() => setFormOpen((v) => !v)}>
        {formOpen ? <X size={16} color="#FFFFFF" /> : <Plus size={16} color="#FFFFFF" />}
        <Text style={s.newBtnTxt}>{formOpen ? "Fermer" : "Nouvelle séance"}</Text>
      </TouchableOpacity>

      {formOpen ? (
        <View style={s.form}>
          <Text style={s.label}>Titre</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Ex: Vinyasa Dynamique" placeholderTextColor={Colors.textSubtle} />

          <Text style={s.label}>Instructeur</Text>
          <TouchableOpacity style={s.selector} onPress={() => setInstructorPickerOpen((v) => !v)}>
            <Text style={selectedInstructorName ? s.selectorTxt : s.selectorPlaceholder}>
              {selectedInstructorName ?? "Choisir un instructeur"}
            </Text>
            <ChevronDown size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {instructorPickerOpen ? (
            <View style={s.pickerList}>
              {instructors.length === 0 ? (
                <Text style={s.emptyPickerTxt}>Aucun instructeur de yoga approuvé pour le moment.</Text>
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

          <Text style={s.label}>Niveau</Text>
          <TouchableOpacity style={s.selector} onPress={() => setLevelPickerOpen((v) => !v)}>
            <Text style={s.selectorTxt}>{level}</Text>
            <ChevronDown size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {levelPickerOpen ? (
            <View style={s.pickerList}>
              {LEVELS.map((l) => (
                <TouchableOpacity key={l} style={s.pickerItem} onPress={() => { setLevel(l); setLevelPickerOpen(false); }}>
                  <Text style={s.pickerItemTxt}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <Text style={s.label}>Adresse du centre</Text>
          <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder="Ex: Studio CareLink, Agdal" placeholderTextColor={Colors.textSubtle} />

          <Text style={s.label}>Ville</Text>
          <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="Ex: Fès" placeholderTextColor={Colors.textSubtle} />

          <View style={s.mapLabelRow}>
            <Text style={[s.label, { marginTop: 0 }]}>Localiser sur la carte (optionnel)</Text>
            <TouchableOpacity style={s.locateBtn} onPress={locateOnMap} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Navigation size={13} color={Colors.primary} />
              )}
              <Text style={s.locateBtnTxt}>Ma position</Text>
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
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} — touchez la carte pour ajuster
              </Text>
            </View>
          ) : (
            <Text style={s.coordsHint}>Touchez la carte pour placer le point exact du studio.</Text>
          )}

          <Text style={s.label}>Date (JJ/MM/AAAA)</Text>
          <TextInput style={s.input} value={dateStr} onChangeText={setDateStr} placeholder="12/08/2026" placeholderTextColor={Colors.textSubtle} keyboardType="numbers-and-punctuation" />

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Heure de début</Text>
              <TextInput style={s.input} value={startTime} onChangeText={setStartTime} placeholder="18:00" placeholderTextColor={Colors.textSubtle} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Heure de fin</Text>
              <TextInput style={s.input} value={endTime} onChangeText={setEndTime} placeholder="19:00" placeholderTextColor={Colors.textSubtle} keyboardType="numbers-and-punctuation" />
            </View>
          </View>

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Capacité</Text>
              <TextInput style={s.input} value={capacity} onChangeText={setCapacity} placeholder="12" placeholderTextColor={Colors.textSubtle} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Prix (MAD)</Text>
              <TextInput style={s.input} value={price} onChangeText={setPrice} placeholder="120" placeholderTextColor={Colors.textSubtle} keyboardType="number-pad" />
            </View>
          </View>

          <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={submit}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.submitTxt}>Publier la séance</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={s.sectionTitle}>Séances existantes</Text>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
      ) : sessions.length === 0 ? (
        <Text style={s.emptyTxt}>Aucune séance créée pour le moment.</Text>
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
                    {sess.status === "scheduled" ? "Programmée" : sess.status === "completed" ? "Terminée" : "Annulée"}
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
                  <Text style={s.sessionMetaTxt}>{sess.enrolledCount}/{sess.capacity} inscrits</Text>
                </View>
                <Text style={s.sessionPrice}>{sess.price_mad} MAD</Text>
              </View>

              {sess.status === "scheduled" ? (
                <View style={s.sessionActions}>
                  <TouchableOpacity style={[s.actionBtn, s.actionComplete]} disabled={busy} onPress={() => handleComplete(sess)}>
                    {busy ? <ActivityIndicator size="small" color="#16A34A" /> : <CheckCircle2 size={14} color="#16A34A" />}
                    <Text style={[s.actionTxt, { color: "#16A34A" }]}>Terminer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, s.actionCancel]} disabled={busy} onPress={() => handleCancelClass(sess)}>
                    <X size={14} color={Colors.danger} />
                    <Text style={[s.actionTxt, { color: Colors.danger }]}>Annuler</Text>
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
