import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, Circle, CreditCard, HandCoins, Landmark } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { DEMO_PRO_1_ID, isDemoBookingId, normalizeRouteParam } from "@/lib/demo-booking";
import { supabase } from "@/lib/supabase";

type PaymentProvider = "cmi" | "stripe" | "cash";

const options: { value: PaymentProvider; label: string; icon: typeof CreditCard }[] = [
  { value: "cmi", label: "CMI", icon: Landmark },
  { value: "stripe", label: "Stripe", icon: CreditCard },
  { value: "cash", label: "Espèces", icon: HandCoins },
];

export default function PaymentSheetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = normalizeRouteParam(params.bookingId);
  const isDemoBooking = isDemoBookingId(bookingId);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<PaymentProvider>("cmi");
  const [amountMad, setAmountMad] = useState<number>(0);
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!bookingId) {
        Alert.alert("Erreur", "Réservation introuvable.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (isDemoBooking) {
          if (!active) return;
          setAmountMad(110);
          setProfessionalId(DEMO_PRO_1_ID);
          return;
        }

        const booking = await db.bookings.get(bookingId);
        if (!active) return;
        const fallbackAmount =
          booking.final_price_mad ?? booking.budget_max_mad ?? booking.budget_min_mad ?? 0;
        setAmountMad(Math.round(Number(fallbackAmount) || 0));
        setProfessionalId(booking.professional_id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Impossible de récupérer la réservation.";
        Alert.alert("Erreur", message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [bookingId, isDemoBooking]);

  const canSubmit = useMemo(
    () => !!user?.id && amountMad > 0 && !submitting && !loading,
    [amountMad, loading, submitting, user?.id]
  );

  const handleConfirm = async () => {
    if (!bookingId || !user?.id || !canSubmit) return;
    setSubmitting(true);
    try {
      if (isDemoBooking) {
        Alert.alert("Paiement validé", "Paiement démo confirmé avec succès.");
        router.replace("/patient/bookings");
        return;
      }

      const { error } = await supabase.from("payments").insert({
        booking_id: bookingId,
        patient_id: user.id,
        professional_id: professionalId,
        amount_mad: amountMad,
        provider: selected,
        status: "authorized",
      });
      if (error) throw error;

      Alert.alert("Paiement validé", "Votre paiement a bien été autorisé.");
      router.replace("/patient/bookings");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Le paiement n'a pas pu être confirmé.";
      Alert.alert("Erreur", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={() => router.back()} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Paiement</Text>
        <Text style={styles.subtitle}>Réservation #{(bookingId ?? "—").slice(0, 8)}</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Montant à autoriser</Text>
              <Text style={styles.amountValue}>{amountMad} MAD</Text>
            </View>

            <Text style={styles.sectionLabel}>Méthode de paiement</Text>
            <View style={styles.optionsWrap}>
              {options.map((item) => {
                const selectedOption = selected === item.value;
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.option, selectedOption && styles.optionSelected]}
                    onPress={() => setSelected(item.value)}
                  >
                    <Icon size={16} color={selectedOption ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.optionText, selectedOption && styles.optionTextSelected]}>
                      {item.label}
                    </Text>
                    {selectedOption ? (
                      <CheckCircle2 size={18} color={Colors.primary} />
                    ) : (
                      <Circle size={18} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, !canSubmit && { opacity: 0.6 }]}
              disabled={!canSubmit}
              onPress={handleConfirm}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.confirmText}>Confirmer le paiement</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 12,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  amountCard: {
    borderRadius: 14,
    backgroundColor: Colors.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  amountLabel: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  amountValue: {
    color: Colors.primary,
    fontSize: 26,
    fontWeight: "800",
  },
  sectionLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  optionsWrap: {
    gap: 8,
    marginBottom: 14,
  },
  option: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceWarm,
  },
  optionText: {
    color: Colors.textPrimary,
    fontSize: 14,
    flex: 1,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: "600",
  },
  confirmBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
});
