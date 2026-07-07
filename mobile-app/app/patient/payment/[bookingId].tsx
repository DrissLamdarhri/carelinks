import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Check, CreditCard, Lock, ShieldCheck, User } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { DEMO_PRO_1_ID, isDemoBookingId, normalizeRouteParam } from "@/lib/demo-booking";

const NAVY = "#0D0870";
const CREAM = "#EDE5CC";
const SERVICE_FEE = 5; // flat CareLink patient fee (MAD)
const COMMISSION_RATE = 0.2; // 20% platform commission on the prestation

const SPEC_LABEL: Record<string, string> = {
  nurse: "Infirmier·ère",
  physiotherapist: "Kinésithérapeute",
  psychologist: "Psychologue",
  yoga_instructor: "Coach yoga",
};

type Step = 0 | 1 | 2 | 3; // Résumé · Paiement · 3-D Secure · Confirmé
const STEPS = ["Résumé", "Paiement", "Confirmation"];

const digits = (s: string) => s.replace(/\D/g, "");
const fmtCard = (s: string) => digits(s).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
const fmtExp = (s: string) => {
  const d = digits(s).slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeRouteParam(params.bookingId);
  const isDemo = isDemoBookingId(bookingId);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);

  const [prestation, setPrestation] = useState(0);
  const [proId, setProId] = useState<string | null>(null);
  const [proName, setProName] = useState("Professionnel");
  const [specialty, setSpecialty] = useState("nurse");
  const [city, setCity] = useState("");
  const [service, setService] = useState("Soin à domicile");
  const [txId, setTxId] = useState("");

  const [cardNum, setCardNum] = useState("");
  const [cardName, setCardName] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!bookingId) { setLoading(false); return; }
      try {
        if (isDemo) {
          if (!active) return;
          setPrestation(150); setProId(DEMO_PRO_1_ID); setProName("Salma B."); setCity("Casablanca");
          setService("Injection à domicile"); setSpecialty("nurse");
          return;
        }
        const b = await db.bookings.get(bookingId);
        if (!active) return;
        setPrestation(Math.round(Number(b.final_price_mad ?? b.budget_max_mad ?? b.budget_min_mad ?? 0)));
        setProId(b.professional_id);
        setSpecialty(b.specialty);
        setCity((b.address ?? "").split(",").pop()?.trim() || (b.address ?? ""));
        if (b.professional_id) {
          try {
            const prof = await db.profiles.get(b.professional_id);
            if (active && prof?.full_name) setProName(prof.full_name);
          } catch { /* keep default */ }
        }
      } catch (error) {
        Alert.alert("Erreur", error instanceof Error ? error.message : "Réservation introuvable.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [bookingId, isDemo]);

  const total = prestation + SERVICE_FEE;
  const commission = Math.round(prestation * COMMISSION_RATE);
  const proNet = prestation - commission;
  const careLinkRevenue = SERVICE_FEE + commission;

  const cardValid = useMemo(
    () => digits(cardNum).length === 16 && cardName.trim().length > 1 && digits(exp).length === 4 && digits(cvv).length === 3,
    [cardNum, cardName, exp, cvv],
  );

  const confirmPayment = async () => {
    if (!bookingId || !user?.id || submitting) return;
    setSubmitting(true);
    try {
      if (!isDemo) {
        await db.payments.create({
          booking_id: bookingId,
          patient_id: user.id,
          professional_id: proId,
          amount_mad: prestation,
          provider: "cmi",
        });
      }
      setTxId(String(Math.floor(100000 + Math.random() * 900000)));
      setStep(3);
    } catch (error) {
      Alert.alert("Paiement", error instanceof Error ? error.message : "Le paiement n'a pas pu être confirmé.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={[NAVY, "#0A065A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => (step > 0 && step < 3 ? setStep((step - 1) as Step) : router.back())}>
          <ArrowLeft size={18} color="rgba(255,255,255,0.85)" />
          <Text style={s.backTxt}>Retour</Text>
        </TouchableOpacity>
        <Text style={s.title}>Paiement</Text>
        <Text style={s.sub}>Paiement sécurisé CMI · 3-D Secure</Text>
        <View style={s.headerBlob} />
      </LinearGradient>

      {/* Stepper */}
      <View style={s.stepper}>
        {STEPS.map((label, i) => {
          const activeIdx = step === 3 ? 3 : step;
          const on = i <= activeIdx;
          return (
            <View key={label} style={s.stepCol}>
              <View style={[s.stepBar, on ? s.stepBarOn : null]} />
              <Text style={[s.stepLbl, on ? s.stepLblOn : null]}>{label}</Text>
            </View>
          );
        })}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={NAVY} /></View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* ── Step 0: Résumé ── */}
            {step === 0 && (
              <>
                <View style={s.card}>
                  <View style={s.proRow}>
                    <View style={s.avatar}><User size={20} color={NAVY} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.proName}>{proName} · {SPEC_LABEL[specialty] ?? specialty}</Text>
                      <Text style={s.proMeta}>{service}{city ? ` · ${city}` : ""}</Text>
                    </View>
                  </View>
                </View>

                <View style={s.card}>
                  <Text style={s.cardLabel}>Détail à la charge du patient</Text>
                  <Row label="Prestation" value={`${prestation} MAD`} />
                  <Row label="Frais de service CareLink" value={`+${SERVICE_FEE} MAD`} muted />
                  <View style={s.divider} />
                  <Row label="Total à payer" value={`${total} MAD`} bold />
                </View>

                <TouchableOpacity style={s.cta} activeOpacity={0.9} onPress={() => setStep(1)}>
                  <Text style={s.ctaTxt}>Continuer vers le paiement</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 1: Paiement ── */}
            {step === 1 && (
              <>
                <View style={s.totalBanner}>
                  <Text style={s.totalBannerLbl}>Montant total</Text>
                  <Text style={s.totalBannerVal}>{total} MAD</Text>
                </View>

                <CmiCard number={cardNum} name={cardName} exp={exp} />

                <Field icon={<CreditCard size={17} color={Colors.textMuted} />} value={fmtCard(cardNum)} onChangeText={(t) => setCardNum(digits(t))} placeholder="4242 4242 4242 4242" keyboardType="number-pad" />
                <Field value={cardName} onChangeText={setCardName} placeholder="Nom du titulaire" autoCapitalize="characters" />
                <View style={s.rowFields}>
                  <View style={{ flex: 1 }}><Field value={fmtExp(exp)} onChangeText={(t) => setExp(digits(t))} placeholder="MM/AA" keyboardType="number-pad" /></View>
                  <View style={{ flex: 1 }}><Field icon={<Lock size={15} color={Colors.textMuted} />} value={cvv} onChangeText={(t) => setCvv(digits(t).slice(0, 3))} placeholder="CVV" keyboardType="number-pad" secureTextEntry /></View>
                </View>

                <TouchableOpacity style={[s.cta, !cardValid && s.ctaDisabled]} activeOpacity={0.9} disabled={!cardValid} onPress={() => setStep(2)}>
                  <Lock size={16} color="#FFF" />
                  <Text style={s.ctaTxt}>Payer {total} MAD via CMI</Text>
                </TouchableOpacity>
                <View style={s.secureRow}>
                  <ShieldCheck size={13} color={Colors.textMuted} />
                  <Text style={s.secureTxt}>Paiement 3-D Secure · chiffré · démo (aucune donnée réelle)</Text>
                </View>
              </>
            )}

            {/* ── Step 2: 3-D Secure ── */}
            {step === 2 && (
              <>
                <View style={s.totalBanner}>
                  <Text style={s.totalBannerLbl}>Montant total</Text>
                  <Text style={s.totalBannerVal}>{total} MAD</Text>
                </View>
                <CmiCard number={cardNum} name={cardName} exp={exp} filled />
                <View style={s.otpCard}>
                  <View style={s.otpHead}>
                    <ShieldCheck size={18} color={NAVY} />
                    <Text style={s.otpTitle}>Vérification 3-D Secure</Text>
                  </View>
                  <Text style={s.otpSub}>Un code de confirmation a été envoyé au numéro associé à votre carte (démo : saisissez n'importe quel code).</Text>
                  <TextInput
                    value={otp}
                    onChangeText={(t) => setOtp(digits(t).slice(0, 6))}
                    placeholder="Code OTP"
                    placeholderTextColor={Colors.textSubtle}
                    keyboardType="number-pad"
                    style={s.otpInput}
                    textAlign="center"
                  />
                  <TouchableOpacity style={[s.cta, { marginTop: 12 }, otp.length < 4 && s.ctaDisabled]} disabled={otp.length < 4 || submitting} onPress={confirmPayment} activeOpacity={0.9}>
                    {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>Confirmer</Text>}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setStep(1)}><Text style={s.linkCenter}>Modifier la carte</Text></TouchableOpacity>
              </>
            )}

            {/* ── Step 3: Confirmé + Répartition ── */}
            {step === 3 && (
              <>
                <View style={s.doneWrap}>
                  <View style={s.doneCircle}><Check size={30} color={NAVY} strokeWidth={3} /></View>
                  <Text style={s.doneTitle}>Paiement confirmé</Text>
                  <Text style={s.doneSub}>Transaction CMI #{txId}</Text>
                </View>

                <View style={s.card}>
                  <Text style={s.cardLabel}>Répartition de la transaction</Text>
                  <Row label="Encaissé (patient)" value={`${total} MAD`} bold />
                  <View style={s.divider} />
                  <Row label="Frais de service · CareLink" value={`${SERVICE_FEE} MAD`} muted />
                  <Row label={`Commission (${Math.round(COMMISSION_RATE * 100)} %) · CareLink`} value={`${commission} MAD`} muted />
                  <View style={[s.splitRow, { backgroundColor: NAVY }]}>
                    <Text style={[s.splitLbl, { color: "#FFF" }]}>Revenu net CareLink</Text>
                    <Text style={[s.splitVal, { color: "#FFF" }]}>{careLinkRevenue} MAD</Text>
                  </View>
                  <View style={[s.splitRow, { backgroundColor: CREAM }]}>
                    <Text style={[s.splitLbl, { color: NAVY }]}>Versé au professionnel</Text>
                    <Text style={[s.splitVal, { color: NAVY }]}>{proNet} MAD</Text>
                  </View>
                </View>

                <TouchableOpacity style={s.cta} activeOpacity={0.9} onPress={() => router.replace("/patient/bookings")}>
                  <Text style={s.ctaTxt}>Voir mes réservations</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <View style={s.detailRow}>
      <Text style={[s.detailLbl, bold && s.detailBold, muted && s.detailMuted]}>{label}</Text>
      <Text style={[s.detailVal, bold && s.detailBold, muted && s.detailMuted]}>{value}</Text>
    </View>
  );
}

function Field({
  icon, value, onChangeText, placeholder, keyboardType, secureTextEntry, autoCapitalize,
}: {
  icon?: React.ReactNode; value: string; onChangeText: (t: string) => void; placeholder: string;
  keyboardType?: "number-pad" | "default"; secureTextEntry?: boolean; autoCapitalize?: "none" | "characters";
}) {
  return (
    <View style={s.field}>
      {icon}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSubtle}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={s.fieldInput}
      />
    </View>
  );
}

function CmiCard({ number, name, exp, filled }: { number: string; name: string; exp: string; filled?: boolean }) {
  const shown = filled || digits(number).length > 0
    ? (fmtCard(number) || "1234 1234 1234 1234")
    : "••••  ••••  ••••  ••••";
  return (
    <LinearGradient colors={["#1A0F8C", "#3A2CC7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cmi}>
      <View style={s.cmiTop}>
        <View style={s.cmiChip} />
        <Text style={s.cmiBrand}>CMI · MAROC</Text>
      </View>
      <Text style={s.cmiNum}>{shown}</Text>
      <View style={s.cmiBottom}>
        <View>
          <Text style={s.cmiCap}>TITULAIRE</Text>
          <Text style={s.cmiVal}>{name.trim() ? name.toUpperCase() : "PRÉNOM NOM"}</Text>
        </View>
        <View>
          <Text style={s.cmiCap}>EXPIRE</Text>
          <Text style={s.cmiVal}>{fmtExp(exp) || "MM/AA"}</Text>
        </View>
      </View>
      <View style={s.cmiBlob} />
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 22, overflow: "hidden" },
  headerBlob: { position: "absolute", top: -40, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.06)" },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  backTxt: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600" },
  title: { color: "#FFF", fontSize: 30, fontFamily: "DMSerifDisplay_400Regular" },
  sub: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 2 },

  stepper: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, backgroundColor: Colors.surfaceWarm },
  stepCol: { flex: 1, gap: 6 },
  stepBar: { height: 4, borderRadius: 2, backgroundColor: "#DEDBCE" },
  stepBarOn: { backgroundColor: NAVY },
  stepLbl: { fontSize: 10.5, color: Colors.textMuted, fontWeight: "600" },
  stepLblOn: { color: NAVY, fontWeight: "800" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 20, gap: 14, paddingBottom: 40 },

  card: { backgroundColor: "#FFF", borderRadius: 18, padding: 16, shadowColor: NAVY, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  cardLabel: { color: Colors.textMuted, fontSize: 12.5, fontWeight: "600", marginBottom: 10 },
  proRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: CREAM, alignItems: "center", justifyContent: "center" },
  proName: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: "800" },
  proMeta: { color: Colors.textMuted, fontSize: 12.5, marginTop: 2 },

  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
  detailLbl: { color: Colors.textPrimary, fontSize: 14 },
  detailVal: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  detailMuted: { color: Colors.textMuted, fontWeight: "500" },
  detailBold: { fontWeight: "800", fontSize: 15.5, color: NAVY },
  divider: { height: 1, backgroundColor: "#EFEFEF", marginVertical: 6 },

  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 16, backgroundColor: NAVY, marginTop: 4 },
  ctaDisabled: { backgroundColor: "#C9C7DE" },
  ctaTxt: { color: "#FFF", fontSize: 15.5, fontWeight: "700" },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
  secureTxt: { color: Colors.textMuted, fontSize: 11.5 },
  linkCenter: { color: NAVY, fontSize: 13.5, fontWeight: "700", textAlign: "center", marginTop: 14 },

  totalBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: CREAM, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  totalBannerLbl: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  totalBannerVal: { color: NAVY, fontSize: 20, fontWeight: "800" },

  cmi: { height: 190, borderRadius: 20, padding: 18, justifyContent: "space-between", overflow: "hidden" },
  cmiBlob: { position: "absolute", top: -30, right: -20, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.08)" },
  cmiTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cmiChip: { width: 40, height: 30, borderRadius: 7, backgroundColor: "rgba(237,229,204,0.85)" },
  cmiBrand: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  cmiNum: { color: "#FFF", fontSize: 21, fontWeight: "700", letterSpacing: 2 },
  cmiBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  cmiCap: { color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  cmiVal: { color: "#FFF", fontSize: 14, fontWeight: "700", marginTop: 2 },

  field: { flexDirection: "row", alignItems: "center", gap: 10, height: 54, borderRadius: 14, backgroundColor: "#F1F1F4", paddingHorizontal: 14 },
  fieldInput: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  rowFields: { flexDirection: "row", gap: 12 },

  otpCard: { backgroundColor: CREAM, borderRadius: 16, padding: 16 },
  otpHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  otpTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  otpSub: { color: Colors.textMuted, fontSize: 12.5, lineHeight: 18, marginBottom: 12 },
  otpInput: { backgroundColor: "#FFF", borderRadius: 12, height: 54, fontSize: 20, fontWeight: "800", letterSpacing: 8, color: NAVY },

  doneWrap: { alignItems: "center", paddingVertical: 12, gap: 6 },
  doneCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: NAVY, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  doneTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  doneSub: { color: Colors.textMuted, fontSize: 13 },

  splitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 },
  splitLbl: { fontSize: 13.5, fontWeight: "700" },
  splitVal: { fontSize: 15, fontWeight: "800" },
});
