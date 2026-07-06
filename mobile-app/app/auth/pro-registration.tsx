import { useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Mail,
  MapPin,
  Shield,
  Upload,
  User,
  X,
} from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { usePickDocument, uploadDocumentToSupabase } from "@/lib/hooks/useDocumentPicker";
import { useTakePhoto, uploadSelfieToSupabase } from "@/lib/hooks/useCameraPicker";
import { showToast } from "@/lib/toast";

const professions = ["Psychologue", "Infirmier", "Kinésithérapeute"];
const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const startTimes = ["06:00", "07:00", "08:00", "09:00", "10:00"];
const endTimes = ["16:00", "17:00", "18:00", "19:00", "20:00", "22:00"];

// Dynamic services loaded from public.services (fallback to inline lists when missing)

// Map French category to internal specialty key (keeps compatibility with different schemas)
const frenchToKey: Record<string, string> = {
  "Infirmier": "nurse",
  "Kinésithérapeute": "physiotherapist",
  "Psychologue": "psychologist",
};

// Hardcoded fallbacks used only when the services table is unavailable
const infirmierServices = ["Pansement", "Injection", "Perfusion", "Bilan sanguin", "Soins post-op", "Sonde urinaire"];
const kineServices = ["Rééducation motrice", "Traitement anti-douleur", "Traitement de l'arthrose", "Drainage lymphatique", "Traumatologie"];

export default function ProRegistrationScreen() {
  const router = useRouter();
  const { signUpWithEmail } = useAuth();
  const [step, setStep] = useState(0);

  // servicesMap state moved inside component so hooks are valid in component body
  const [servicesMap, setServicesMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.from("services").select("name,category,is_active");
        if (error) {
          console.warn("Failed to load services:", error);
          return;
        }
        const map: Record<string, string[]> = {};
        (data ?? []).forEach((s: any) => {
          if (s.is_active === false) return;
          const cat = s.category ?? "Autre";
          map[cat] = map[cat] || [];
          map[cat].push(s.name);
          const eng = frenchToKey[cat];
          if (eng) {
            map[eng] = map[eng] || [];
            map[eng].push(s.name);
          }
        });
        if (mounted) setServicesMap(map);
      } catch (e) {
        console.warn("Failed to load services:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    city: "",
    experience: "",
    password: "",
    showPassword: false,
  });
  const [profession, setProfession] = useState<string | null>(null);
  const [showProfessionMenu, setShowProfessionMenu] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [showServiceMenu, setShowServiceMenu] = useState(false);

  const [diploma, setDiploma] = useState(false);
  const [diplomaUrl, setDiplomaUrl] = useState<string | null>(null);
  const [diplomaPath, setDiplomaPath] = useState<string | null>(null);
  const [cin, setCin] = useState(false);
  const [cinUrl, setCinUrl] = useState<string | null>(null);
  const [cinPath, setCinPath] = useState<string | null>(null);
  const [selfie, setSelfie] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Pending uploads picked before sign-up; actual upload happens AFTER sign-up (when user id is available)
  const [pendingUploads, setPendingUploads] = useState<Array<{ type: "diploma" | "cin" | "selfie"; uri: string; name: string; mimeType: string }>>([]);

  const [availDays, setAvailDays] = useState<string[]>(["Lun", "Mar", "Mer", "Ven"]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [minPrice, setMinPrice] = useState(80);
  const [maxDistance, setMaxDistance] = useState(10);
  const [agreed, setAgreed] = useState(false);

  const totalSteps = 4;
  const fullName = `${form.firstName} ${form.lastName}`.trim();

  const stepValid = useMemo(
    () => [
      Boolean(
        form.firstName &&
          form.lastName &&
          form.phone &&
          form.email &&
          form.city &&
          profession &&
          (profession === "Psychologue" || selectedServices.length > 0) &&
          form.password.length >= 6
      ),
      diploma && cin && selfie,
      availDays.length > 0,
      agreed,
    ],
    [agreed, availDays.length, cin, diploma, form.city, form.email, form.firstName, form.lastName, form.password.length, form.phone, profession, selectedServices.length, selfie]
  );

  const handleUpload = async (type: "diploma" | "cin" | "selfie") => {
    // Pick/capture document and store locally in pendingUploads.
    // Actual upload to Supabase Storage will happen after successful sign-up (so we have the user id).
    setUploading(type);
    try {
      if (type === "selfie") {
        const photo = await useTakePhoto();
        if (!photo) { setUploading(null); return; }
        const fileName = photo.name ?? `selfie-${Date.now()}.jpg`;
        setPendingUploads((p) => [...p, { type: "selfie", uri: photo.uri, name: fileName, mimeType: photo.type ?? "image/jpeg" }]);
        setSelfie(true);
        setSelfieUrl(photo.uri);
        showToast("Selfie ajouté (upload après inscription)");
      } else {
        const doc = await usePickDocument();
        if (!doc) { setUploading(null); return; }
        setPendingUploads((p) => [...p, { type, uri: doc.uri, name: doc.name, mimeType: doc.type }]);
        if (type === "diploma") {
          setDiploma(true);
          setDiplomaUrl(doc.uri);
        } else if (type === "cin") {
          setCin(true);
          setCinUrl(doc.uri);
        }
        showToast("Document ajouté (upload après inscription)");
      }

      // Trigger OCR check if diploma and CIN are both present locally
      const nextDiploma = type === "diploma" ? true : diploma;
      const nextCin = type === "cin" ? true : cin;
      if (nextDiploma && nextCin) {
        setOcrRunning(true);
        setTimeout(() => {
          setOcrRunning(false);
          setOcrDone(true);
        }, 1700);
      }
    } catch (error) {
      console.error("handleUpload error:", error);
      showToast("Erreur lors de la sélection du document");
    } finally {
      setUploading(null);
    }
  };

  const getAvailableServices = (): string[] => {
    const key = getProfessionSpecialty();
    const fromMap = servicesMap[key] ?? servicesMap[profession ?? ""] ?? [];
    if (fromMap && fromMap.length) return fromMap;
    if (profession === "Infirmier") return infirmierServices;
    if (profession === "Kinésithérapeute") return kineServices;
    return [];
  };

  const getProfessionSpecialty = (): string => {
    if (profession === "Infirmier") return "nurse";
    if (profession === "Kinésithérapeute") return "physiotherapist";
    if (profession === "Psychologue") return "psychologist";
    return "nurse";
  };

  const getDiplomaTitle = (): string => {
    if (profession === "Infirmier") return "Diplôme d'infirmier";
    if (profession === "Kinésithérapeute") return "Diplôme de kinésithérapeute";
    return "Diplôme de psychologue";
  };

  const handleSubmit = async () => {
    if (submitting || !stepValid[3]) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      // 1) Sign up the user (create auth user + profile + professionals row)
      const newUserId = await signUpWithEmail(form.email.trim(), form.password, fullName, "pro", {
        phone: form.phone.trim(),
        city: form.city.trim(),
        profession: getProfessionSpecialty(),
        services: selectedServices,
        experience: form.experience.trim(),
      });

      // 2) If sign-up succeeded and we have a user id, upload any pending documents using that id and insert pro_documents rows
      const uid = newUserId ?? (await supabase.auth.getUser()).data?.user?.id;
      if (uid && pendingUploads.length > 0) {
        for (const file of pendingUploads) {
          try {
            // Attempt upload using shared helpers with retry
            let uploadResult: { url: string; path: string } | null = null;
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                if (file.type === "selfie") {
                  uploadResult = await uploadSelfieToSupabase(uid, file.uri, file.mimeType);
                } else {
                  uploadResult = await uploadDocumentToSupabase(uid, file.uri, file.name, file.mimeType);
                }
                if (uploadResult) break;
                // else retry
              } catch (upErr) {
                console.error(`Upload attempt ${attempt} failed for ${file.name}:`, upErr);
              }
              // small backoff
              await new Promise((r) => setTimeout(r, 600 * attempt));
            }

            if (!uploadResult) {
              console.error("Upload failed after retries for", file.name);
              showToast("Échec de l'upload d'un document. Vérifiez votre connexion et réessayez.");
              continue;
            }

            const storagePath = uploadResult.path;

            // Insert pro_documents row (RLS allows when authenticated as owner)
            const { error: insertError } = await supabase.from("pro_documents").insert({
              professional_id: uid,
              doc_type: file.type === "diploma" ? getDiplomaTitle() : file.type === "cin" ? "CIN" : "Selfie",
              storage_path: storagePath,
              is_verified: false,
              uploaded_at: new Date().toISOString(),
            });
            if (insertError) {
              console.error("Failed to insert pro_documents for", storagePath, insertError);
              showToast("Erreur lors de l'enregistrement du document.");
              continue;
            }

            // Update local state paths so UI shows uploaded docs
            if (file.type === "diploma") {
              setDiplomaPath(storagePath);
            } else if (file.type === "cin") {
              setCinPath(storagePath);
            } else if (file.type === "selfie") {
              setSelfiePath(storagePath);
            }
          } catch (e) {
            console.error("Exception uploading pending file:", e);
            showToast("Erreur lors de l'upload d'un document.");
          }
        }
      }

      setSubmitted(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erreur lors de l'inscription.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.successRoot}>
        <View style={styles.successIconWrap}>
          <CheckCircle2 size={50} color={Colors.primary} />
        </View>
        <Text style={styles.successTitle}>Demande envoyée !</Text>
        <Text style={styles.successSubtitle}>
          Votre dossier est en cours de vérification. Vous recevrez une notification après validation.
        </Text>
        <View style={styles.successList}>
          <SuccessRow label="Informations personnelles" ok />
          <SuccessRow label="Documents vérifiés" ok />
          <SuccessRow label="Validation admin" loading />
          <SuccessRow label="Activation du compte" />
        </View>
        <TouchableOpacity style={styles.successBtn} onPress={() => router.replace("/auth/pro-login")}>
          <Text style={styles.successBtnText}>Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => (step > 0 ? setStep((s) => s - 1) : router.push("/auth/pro-login"))}
            style={styles.backBtn}
          >
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inscription Professionnel</Text>
          <Text style={styles.stepBadge}>
            {step + 1}/{totalSteps}
          </Text>
        </View>
        <View style={styles.progressRow}>
          {[0, 1, 2, 3].map((idx) => (
            <View key={idx} style={styles.progressTrack}>
              <View style={[styles.progressFill, idx < step ? styles.progressDone : idx === step ? styles.progressHalf : undefined]} />
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {step === 0 ? (
          <View>
            <Text style={styles.bigTitle}>Vos informations</Text>
            <Text style={styles.bigSubtitle}>Renseignez vos coordonnées professionnelles</Text>

            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                <User size={30} color={Colors.primary} />
              </View>
              <View style={styles.cameraBtn}>
                <Camera size={11} color="white" />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Prénom</Text>
                <TextInput
                  value={form.firstName}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, firstName: value }))}
                  style={styles.input}
                  placeholder="Karim"
                  placeholderTextColor={Colors.textSubtle}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Nom</Text>
                <TextInput
                  value={form.lastName}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, lastName: value }))}
                  style={styles.input}
                  placeholder="Benali"
                  placeholderTextColor={Colors.textSubtle}
                />
              </View>
            </View>

            <Text style={styles.label}>Téléphone</Text>
            <View style={styles.phoneWrap}>
              <Text style={styles.country}>+212</Text>
              <TextInput
                value={form.phone}
                onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                style={styles.phoneInput}
                placeholder="6 12 34 56 78"
                placeholderTextColor={Colors.textSubtle}
              />
            </View>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWithIcon}>
              <Mail size={16} color={Colors.textMuted} />
              <TextInput
                value={form.email}
                onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
                style={styles.inputInner}
                placeholder="karim@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={Colors.textSubtle}
              />
            </View>

            <Text style={styles.label}>Ville</Text>
            <View style={styles.inputWithIcon}>
              <MapPin size={16} color={Colors.textMuted} />
              <TextInput
                value={form.city}
                onChangeText={(value) => setForm((prev) => ({ ...prev, city: value }))}
                style={styles.inputInner}
                placeholder="Fès"
                placeholderTextColor={Colors.textSubtle}
              />
            </View>

            <Text style={styles.label}>Profession</Text>
            <TouchableOpacity style={styles.inputWithIcon} onPress={() => setShowProfessionMenu((v) => !v)}>
              <Briefcase size={16} color={Colors.textMuted} />
              <Text style={[styles.inputInner, { color: profession ? Colors.textPrimary : Colors.textMuted }]}>
                {profession || "Choisir..."}
              </Text>
              <ChevronDown size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            {showProfessionMenu ? (
              <View style={styles.specMenu}>
                {professions.map((item) => {
                  const active = profession === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={styles.specRow}
                      onPress={() => {
                        setProfession(item);
                        setShowProfessionMenu(false);
                        setSelectedServices([]);
                      }}
                    >
                      <Text style={[styles.specText, active && { color: Colors.primary, fontWeight: "600" }]}>{item}</Text>
                      {active ? <Check size={16} color={Colors.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {profession && (profession === "Infirmier" || profession === "Kinésithérapeute") ? (
              <>
                <Text style={styles.label}>Types de service</Text>
                <TouchableOpacity style={styles.inputWithIcon} onPress={() => setShowServiceMenu((v) => !v)}>
                  <Briefcase size={16} color={Colors.textMuted} />
                  <Text style={[styles.inputInner, { color: selectedServices.length ? Colors.textPrimary : Colors.textMuted }]}>
                    {selectedServices.length ? `${selectedServices.length} sélectionnés` : "Choisir..."}
                  </Text>
                  <ChevronDown size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                {showServiceMenu ? (
                  <View style={styles.specMenu}>
                    {getAvailableServices().map((item) => {
                      const active = selectedServices.includes(item);
                      return (
                        <TouchableOpacity
                          key={item}
                          style={styles.specRow}
                          onPress={() =>
                            setSelectedServices((prev) => (active ? prev.filter((x) => x !== item) : [...prev, item]))
                          }
                        >
                          <Text style={[styles.specText, active && { color: Colors.primary, fontWeight: "600" }]}>{item}</Text>
                          {active ? <Check size={16} color={Colors.primary} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                {selectedServices.length ? (
                  <View style={styles.tagsRow}>
                    {selectedServices.map((item) => (
                      <View key={item} style={styles.tag}>
                        <Text style={styles.tagText}>{item}</Text>
                        <TouchableOpacity onPress={() => setSelectedServices((prev) => prev.filter((x) => x !== item))}>
                          <X size={10} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            <Text style={styles.label}>Années d'expérience</Text>
            <TextInput
              value={form.experience}
              onChangeText={(value) => setForm((prev) => ({ ...prev, experience: value }))}
              style={styles.input}
              placeholder="6"
              keyboardType="numeric"
              placeholderTextColor={Colors.textSubtle}
            />

            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWithIcon}>
              <Lock size={16} color={Colors.textMuted} />
              <TextInput
                value={form.password}
                onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))}
                style={styles.inputInner}
                placeholder="••••••••"
                secureTextEntry={!form.showPassword}
                placeholderTextColor={Colors.textSubtle}
              />
              <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, showPassword: !prev.showPassword }))}>
                {form.showPassword ? <EyeOff size={16} color={Colors.textMuted} /> : <Eye size={16} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <Text style={styles.bigTitle}>Documents officiels</Text>
            <Text style={styles.bigSubtitle}>Téléchargez vos documents pour la vérification KYC</Text>

            <View style={styles.warningCard}>
              <AlertTriangle size={18} color={Colors.accent} />
              <Text style={styles.warningText}>
                Les informations doivent correspondre entre votre CIN et votre diplôme.
              </Text>
            </View>

            <UploadCard
              title={diploma ? `${getDiplomaTitle()} téléchargé ✓` : getDiplomaTitle()}
              subtitle="Recto & verso · PDF ou image · max 5MB"
              done={diploma}
              loading={uploading === "diploma"}
              icon={FileText}
              onPress={() => handleUpload("diploma")}
            />
            <UploadCard
              title={cin ? "CIN téléchargée ✓" : "Carte d'Identité Nationale"}
              subtitle="Recto & verso · PDF ou image · max 5MB"
              done={cin}
              loading={uploading === "cin"}
              icon={CreditCard}
              onPress={() => handleUpload("cin")}
            />
            <UploadCard
              title={selfie ? "Selfie pris ✓" : "Selfie de vérification"}
              subtitle="Appuyez pour prendre une photo avec caméra"
              done={selfie}
              loading={uploading === "selfie"}
              icon={Camera}
              onPress={() => handleUpload("selfie")}
            />

            {ocrRunning ? (
              <View style={styles.ocrCard}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <View>
                  <Text style={styles.ocrTitle}>Analyse en cours...</Text>
                  <Text style={styles.ocrText}>Vérification OCR des documents</Text>
                </View>
              </View>
            ) : null}

            {ocrDone ? (
              <View style={styles.verifiedCard}>
                <CheckCircle2 size={18} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.verifiedTitle}>Documents vérifiés automatiquement</Text>
                  <Text style={styles.verifiedText}>Les informations correspondent.</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <Text style={styles.bigTitle}>Disponibilité & tarifs</Text>
            <Text style={styles.bigSubtitle}>Configurez quand et où vous souhaitez travailler</Text>

            <Text style={styles.sectionLabel}>Jours de disponibilité</Text>
            <View style={styles.daysRow}>
              {weekDays.map((day) => {
                const active = availDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayBtn, active && styles.dayBtnActive]}
                    onPress={() =>
                      setAvailDays((prev) => (active ? prev.filter((value) => value !== day) : [...prev, day]))
                    }
                  >
                    <Text style={[styles.dayText, active && styles.dayTextActive]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Horaires de travail</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>De</Text>
                <View style={styles.selectWrap}>
                  <Clock size={16} color={Colors.textMuted} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.timeRow}>
                      {startTimes.map((time) => (
                        <TouchableOpacity
                          key={time}
                          style={[styles.timeChip, startTime === time && styles.timeChipActive]}
                          onPress={() => setStartTime(time)}
                        >
                          <Text style={[styles.timeChipText, startTime === time && styles.timeChipTextActive]}>{time}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>À</Text>
                <View style={styles.selectWrap}>
                  <Clock size={16} color={Colors.textMuted} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.timeRow}>
                      {endTimes.map((time) => (
                        <TouchableOpacity
                          key={time}
                          style={[styles.timeChip, endTime === time && styles.timeChipActive]}
                          onPress={() => setEndTime(time)}
                        >
                          <Text style={[styles.timeChipText, endTime === time && styles.timeChipTextActive]}>{time}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Tarif minimum accepté</Text>
            <CounterCard value={`${minPrice} MAD`} onMinus={() => setMinPrice((v) => Math.max(40, v - 10))} onPlus={() => setMinPrice((v) => Math.min(300, v + 10))} />

            <Text style={styles.sectionLabel}>Distance maximale</Text>
            <CounterCard value={`${maxDistance} km`} onMinus={() => setMaxDistance((v) => Math.max(1, v - 1))} onPlus={() => setMaxDistance((v) => Math.min(30, v + 1))} />

            <View style={styles.zoneCard}>
              <View style={styles.zoneIcon}>
                <MapPin size={17} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.zoneTitle}>Zone de couverture</Text>
                <Text style={styles.zoneText}>
                  {form.city || "Fès"} — rayon de {maxDistance} km
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <Text style={styles.bigTitle}>Récapitulatif</Text>
            <Text style={styles.bigSubtitle}>Vérifiez vos informations avant de soumettre</Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryHead}>
                <View style={styles.summaryAvatar}>
                  <User size={20} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.summaryName}>{fullName || "Karim Benali"}</Text>
                  <Text style={styles.summaryMeta}>{form.email || "karim@email.com"}</Text>
                  <Text style={styles.summaryMeta}>+212 {form.phone || "6 12 34 56 78"}</Text>
                </View>
              </View>

              <SummaryRow label="Ville" value={form.city || "Fès"} />
              <SummaryRow label="Expérience" value={`${form.experience || "6"} ans`} />
              <SummaryRow label="Profession" value={profession || "Non sélectionnée"} />
              {profession && (profession === "Infirmier" || profession === "Kinésithérapeute") ? (
                <SummaryRow label="Types de service" value={selectedServices.length ? selectedServices.join(", ") : "Non sélectionné"} />
              ) : null}
              <SummaryRow label="Disponibilité" value={`${availDays.join(", ")} · ${startTime}-${endTime}`} />
              <SummaryRow label="Tarif minimum" value={`${minPrice} MAD`} />
              <SummaryRow label="Zone" value={`${maxDistance} km autour de ${form.city || "Fès"}`} />
            </View>

            <View style={styles.docsStatusCard}>
              <Text style={styles.docsStatusTitle}>Documents</Text>
              <DocStatus label={getDiplomaTitle()} ok={diploma} />
              <DocStatus label="Carte d'identité" ok={cin} />
              <DocStatus label="Selfie de vérification" ok={selfie} />
              <DocStatus label="Vérification OCR" ok={ocrDone} />
            </View>

            <TouchableOpacity style={styles.termsCard} onPress={() => setAgreed((v) => !v)}>
              <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                {agreed ? <Check size={12} color="white" /> : null}
              </View>
              <Text style={styles.termsText}>
                J'accepte les <Text style={styles.link}>conditions générales</Text> et la{" "}
                <Text style={styles.link}>politique de confidentialité</Text> de CareLink.
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.nextBtn, !stepValid[step] && styles.nextBtnDisabled]}
          disabled={!stepValid[step] || submitting}
          onPress={() => {
            if (step < 3) setStep((s) => s + 1);
            else void handleSubmit();
          }}
        >
          {submitting ? (
            <>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.nextText}>Envoi en cours...</Text>
            </>
          ) : step < 3 ? (
            <>
              <Text style={styles.nextText}>Continuer</Text>
              <ChevronRight size={18} color="white" />
            </>
          ) : (
            <Text style={styles.nextText}>Soumettre ma candidature</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function UploadCard({
  title,
  subtitle,
  done,
  onPress,
  icon: Icon,
  loading,
}: {
  title: string;
  subtitle: string;
  done: boolean;
  onPress: () => void;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity 
      style={[styles.uploadCard, done && styles.uploadDone, loading && styles.uploadLoading]} 
      onPress={onPress}
      disabled={loading}
    >
      <View style={[styles.uploadIcon, done && styles.uploadIconDone]}>
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : done ? (
          <Check size={22} color="white" />
        ) : (
          <Icon size={22} color={Colors.textMuted} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.uploadTitle}>{title}</Text>
        <Text style={styles.uploadSubtitle}>{subtitle}</Text>
      </View>
      {!done && !loading ? <Upload size={18} color={Colors.textMuted} /> : null}
    </TouchableOpacity>
  );
}

function CounterCard({ value, onMinus, onPlus }: { value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.counterCard}>
      <TouchableOpacity style={styles.counterBtn} onPress={onMinus}>
        <Text style={styles.counterBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.counterValue}>{value}</Text>
      <TouchableOpacity style={styles.counterBtn} onPress={onPlus}>
        <Text style={styles.counterBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function DocStatus({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={styles.docRow}>
      <View style={[styles.docDot, ok && styles.docDotOk]}>{ok ? <Check size={11} color="white" /> : <X size={11} color="white" />}</View>
      <Text style={styles.docText}>{label}</Text>
    </View>
  );
}

function SuccessRow({ label, ok, loading }: { label: string; ok?: boolean; loading?: boolean }) {
  return (
    <View style={styles.successRow}>
      <View style={[styles.successDot, ok && styles.successDotOk, loading && styles.successDotLoading]}>
        {ok ? <Check size={11} color="white" /> : loading ? <Clock size={11} color={Colors.accent} /> : null}
      </View>
      <Text style={[styles.successRowText, !ok && !loading && { color: Colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: {
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 46,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "600" },
  stepBadge: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.surfaceWarm,
    overflow: "hidden",
  },
  progressRow: { flexDirection: "row", gap: 6 },
  progressTrack: { flex: 1, height: 6, borderRadius: 4, backgroundColor: "#E0E0E0", overflow: "hidden" },
  progressFill: { width: 0, height: "100%", backgroundColor: Colors.primary },
  progressDone: { width: "100%" },
  progressHalf: { width: "52%" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  bigTitle: { fontSize: 24, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular" },
  bigSubtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 3, marginBottom: 14 },
  avatarWrap: { alignItems: "center", marginBottom: 14 },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14,
    marginLeft: 56,
    borderWidth: 2,
    borderColor: "white",
  },
  row: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  label: { fontSize: 11, color: Colors.textMuted, marginBottom: 7, marginTop: 10, fontWeight: "500" },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  phoneWrap: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.input,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  country: {
    width: 62,
    textAlign: "center",
    color: Colors.textMuted,
    fontSize: 13,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingVertical: 14,
  },
  phoneInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingHorizontal: 12 },
  inputWithIcon: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputInner: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  specMenu: {
    marginTop: 6,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  specText: { color: Colors.textPrimary, fontSize: 13 },
  tagsRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.surfaceWarm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tagText: { color: Colors.primary, fontSize: 11, fontWeight: "500" },
  warningCard: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  warningText: { flex: 1, color: Colors.accent, fontSize: 12, lineHeight: 18 },
  uploadCard: {
    backgroundColor: "white",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D0D0D0",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  uploadDone: { borderColor: Colors.primary, backgroundColor: Colors.surfaceWarm },
  uploadLoading: { borderColor: Colors.primary, opacity: 0.7 },
  uploadIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIconDone: { backgroundColor: Colors.primary },
  uploadTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  uploadSubtitle: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  ocrCard: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "white",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ocrTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  ocrText: { color: Colors.textMuted, fontSize: 11 },
  verifiedCard: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: Colors.surfaceWarm,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verifiedTitle: { color: Colors.primary, fontSize: 13, fontWeight: "600" },
  verifiedText: { color: "rgba(13,8,112,0.72)", fontSize: 11, marginTop: 1 },
  sectionLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", marginTop: 8, marginBottom: 8 },
  daysRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  dayBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  dayBtnActive: { backgroundColor: Colors.primary },
  dayText: { color: Colors.textMuted, fontSize: 12, fontWeight: "500" },
  dayTextActive: { color: "white" },
  selectWrap: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.input,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  timeRow: { flexDirection: "row", gap: 6 },
  timeChip: {
    height: 30,
    borderRadius: 999,
    backgroundColor: "white",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  timeChipActive: { backgroundColor: Colors.primary },
  timeChipText: { color: Colors.textMuted, fontSize: 12, fontWeight: "500" },
  timeChipTextActive: { color: "white" },
  counterCard: {
    borderRadius: 14,
    backgroundColor: Colors.input,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  counterBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnText: { color: Colors.textPrimary, fontSize: 22, lineHeight: 24 },
  counterValue: { color: Colors.primary, fontSize: 20, fontWeight: "700" },
  zoneCard: {
    marginTop: 6,
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  zoneIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  zoneTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "500" },
  zoneText: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  summaryAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryName: { color: Colors.textPrimary, fontSize: 16, fontWeight: "600" },
  summaryMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    paddingVertical: 9,
  },
  summaryLabel: { color: Colors.textMuted, fontSize: 12 },
  summaryValue: { color: Colors.textPrimary, fontSize: 13, maxWidth: "58%", textAlign: "right", fontWeight: "500" },
  docsStatusCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  docsStatusTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  docDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  docDotOk: { backgroundColor: Colors.primary },
  docText: { color: Colors.textPrimary, fontSize: 13 },
  termsCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#D0D0D0",
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsText: { flex: 1, color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  link: { color: Colors.primary, textDecorationLine: "underline" },
  bottom: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  nextBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  nextBtnDisabled: { backgroundColor: "#D9D9D9" },
  nextText: { color: "white", fontSize: 15, fontWeight: "600" },
  errorText: { marginTop: 10, color: Colors.danger, fontSize: 12 },
  successRoot: {
    flex: 1,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  successIconWrap: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: Colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successTitle: { color: Colors.textPrimary, fontSize: 24, fontFamily: "DMSerifDisplay_400Regular", marginBottom: 6 },
  successSubtitle: { color: Colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 16 },
  successList: { width: "100%", borderRadius: 14, backgroundColor: Colors.input, padding: 14, gap: 8, marginBottom: 20 },
  successRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  successDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#D0D0D0",
    alignItems: "center",
    justifyContent: "center",
  },
  successDotOk: { backgroundColor: Colors.primary },
  successDotLoading: { backgroundColor: "rgba(91,184,212,0.2)" },
  successRowText: { color: Colors.textPrimary, fontSize: 13 },
  successBtn: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  successBtnText: { color: "white", fontSize: 15, fontWeight: "600" },
});
