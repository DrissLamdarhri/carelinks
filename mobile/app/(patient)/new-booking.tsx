/**
 * New Booking — multi-step form
 * Step 1: Specialty (pre-filled from params)
 * Step 2: Address + notes + urgency
 * Step 3: Budget (min/max) + scheduled date
 * Step 4: Confirm → create booking → go to waiting-offers
 */

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import { useAuth } from "../../../shared/auth-context";
import { db } from "../../../shared/db/dal";
import { toDbSpecialty } from "../../../shared/db/types";
import type { ProSpecialty, UrgencyLevel } from "../../../shared/db/types";

const STEPS = ["Spécialité", "Lieu & notes", "Budget", "Confirmation"];

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string; color: string }[] =
  [
    { value: "normal", label: "Normal", color: "#10B981" },
    { value: "urgent", label: "Urgent", color: "#F59E0B" },
    { value: "emergency", label: "Urgence", color: "#EF4444" },
  ];

export default function NewBookingScreen() {
  const { specialty: specialtyParam } = useLocalSearchParams<{
    specialty: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [specialty, setSpecialty] = useState<ProSpecialty>(
    specialtyParam ? toDbSpecialty(specialtyParam) : "nurse"
  );
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("normal");
  const [budgetMin, setBudgetMin] = useState("100");
  const [budgetMax, setBudgetMax] = useState("300");

  const specialties: ProSpecialty[] = [
    "nurse",
    "psychologist",
    "physiotherapist",
    "yoga_instructor",
  ];

  const specialtyLabels: Record<ProSpecialty, string> = {
    nurse: "Infirmier(e)",
    psychologist: "Psychologue",
    physiotherapist: "Kinésithérapeute",
    yoga_instructor: "Instructeur Yoga",
  };

  const canProceed = () => {
    if (step === 1 && !address.trim()) return false;
    if (step === 2 && (!budgetMin || !budgetMax)) return false;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) {
      Alert.alert("Champ requis", "Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const booking = await db.bookings.create({
        patient_id: user.id,
        specialty,
        address,
        notes: notes || null,
        urgency,
        budget_min_mad: parseFloat(budgetMin),
        budget_max_mad: parseFloat(budgetMax),
      });
      router.replace({
        pathname: "/(patient)/waiting-offers/[bookingId]",
        params: { bookingId: booking.id },
      });
    } catch (err: any) {
      Alert.alert("Erreur", err.message ?? "Impossible de créer la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="bg-primary px-5 py-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => (step > 0 ? setStep((s) => s - 1) : router.back())}
          className="mr-4 p-1"
        >
          <ArrowLeft color="#EDE5CC" size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            className="text-surface text-lg"
            style={{ fontFamily: "DMSerifDisplay_400Regular" }}
          >
            Nouvelle demande
          </Text>
          <Text
            className="text-surface/60 text-xs"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            Étape {step + 1} / {STEPS.length}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View className="bg-primary/20 h-1">
        <View
          className="bg-mid h-1 transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </View>

      <ScrollView
        className="flex-1 px-5 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* STEP 0: Specialty */}
        {step === 0 && (
          <View>
            <Text
              className="text-primary text-xl mb-6"
              style={{ fontFamily: "DMSerifDisplay_400Regular" }}
            >
              Choisissez une spécialité
            </Text>
            {specialties.map((sp) => (
              <TouchableOpacity
                key={sp}
                className={`rounded-2xl p-5 mb-3 flex-row items-center justify-between border-2 ${
                  specialty === sp
                    ? "bg-primary border-primary"
                    : "bg-white border-transparent"
                }`}
                onPress={() => setSpecialty(sp)}
              >
                <Text
                  className={specialty === sp ? "text-surface" : "text-primary"}
                  style={{ fontFamily: "DMSans_500Medium" }}
                >
                  {specialtyLabels[sp]}
                </Text>
                {specialty === sp && (
                  <View className="w-5 h-5 rounded-full bg-mid items-center justify-center">
                    <Text className="text-white text-xs">✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STEP 1: Address + notes + urgency */}
        {step === 1 && (
          <View>
            <Text
              className="text-primary text-xl mb-6"
              style={{ fontFamily: "DMSerifDisplay_400Regular" }}
            >
              Lieu & détails
            </Text>

            <Text
              className="text-primary text-sm mb-2"
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              Adresse *
            </Text>
            <TextInput
              className="bg-white rounded-2xl px-4 py-4 mb-4 text-gray-800 border border-gray-200"
              placeholder="Ex: 12 Rue Mohammed V, Casablanca"
              placeholderTextColor="#888780"
              value={address}
              onChangeText={setAddress}
              multiline
              style={{ fontFamily: "DMSans_400Regular" }}
            />

            <Text
              className="text-primary text-sm mb-2"
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              Notes médicales (optionnel)
            </Text>
            <TextInput
              className="bg-white rounded-2xl px-4 py-4 mb-6 text-gray-800 border border-gray-200"
              placeholder="Décrivez vos besoins..."
              placeholderTextColor="#888780"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{ fontFamily: "DMSans_400Regular", minHeight: 100 }}
            />

            <Text
              className="text-primary text-sm mb-3"
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              Niveau d'urgence
            </Text>
            <View className="flex-row gap-3">
              {URGENCY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  className={`flex-1 py-3 rounded-xl items-center border-2 ${
                    urgency === opt.value ? "border-current" : "border-gray-200 bg-white"
                  }`}
                  style={{
                    borderColor:
                      urgency === opt.value ? opt.color : "#E5E7EB",
                    backgroundColor:
                      urgency === opt.value ? opt.color + "15" : "white",
                  }}
                  onPress={() => setUrgency(opt.value)}
                >
                  <Text
                    style={{
                      color: urgency === opt.value ? opt.color : "#888780",
                      fontFamily: "DMSans_500Medium",
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* STEP 2: Budget */}
        {step === 2 && (
          <View>
            <Text
              className="text-primary text-xl mb-2"
              style={{ fontFamily: "DMSerifDisplay_400Regular" }}
            >
              Votre budget
            </Text>
            <Text
              className="text-muted text-sm mb-6"
              style={{ fontFamily: "DMSans_400Regular" }}
            >
              Les professionnels feront des offres dans votre fourchette.
            </Text>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text
                  className="text-primary text-sm mb-2"
                  style={{ fontFamily: "DMSans_500Medium" }}
                >
                  Minimum (MAD)
                </Text>
                <TextInput
                  className="bg-white rounded-2xl px-4 py-4 text-gray-800 border border-gray-200"
                  placeholder="100"
                  placeholderTextColor="#888780"
                  value={budgetMin}
                  onChangeText={setBudgetMin}
                  keyboardType="numeric"
                  style={{ fontFamily: "DMSans_400Regular" }}
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-primary text-sm mb-2"
                  style={{ fontFamily: "DMSans_500Medium" }}
                >
                  Maximum (MAD)
                </Text>
                <TextInput
                  className="bg-white rounded-2xl px-4 py-4 text-gray-800 border border-gray-200"
                  placeholder="300"
                  placeholderTextColor="#888780"
                  value={budgetMax}
                  onChangeText={setBudgetMax}
                  keyboardType="numeric"
                  style={{ fontFamily: "DMSans_400Regular" }}
                />
              </View>
            </View>
          </View>
        )}

        {/* STEP 3: Confirmation */}
        {step === 3 && (
          <View>
            <Text
              className="text-primary text-xl mb-6"
              style={{ fontFamily: "DMSerifDisplay_400Regular" }}
            >
              Confirmer votre demande
            </Text>
            <View className="bg-white rounded-2xl p-5 gap-4">
              {[
                { label: "Spécialité", value: specialtyLabels[specialty] },
                { label: "Adresse", value: address },
                {
                  label: "Urgence",
                  value: URGENCY_OPTIONS.find((o) => o.value === urgency)?.label,
                },
                {
                  label: "Budget",
                  value: `${budgetMin} – ${budgetMax} MAD`,
                },
                { label: "Notes", value: notes || "Aucune" },
              ].map((row) => (
                <View key={row.label} className="flex-row justify-between">
                  <Text
                    className="text-muted"
                    style={{ fontFamily: "DMSans_400Regular" }}
                  >
                    {row.label}
                  </Text>
                  <Text
                    className="text-primary flex-1 text-right ml-4"
                    style={{ fontFamily: "DMSans_500Medium" }}
                    numberOfLines={2}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
            <Text
              className="text-muted text-xs mt-4 text-center"
              style={{ fontFamily: "DMSans_400Regular" }}
            >
              Votre demande sera visible par les professionnels disponibles dans
              votre zone.
            </Text>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>

      {/* Bottom CTA */}
      <View className="px-5 pb-6 pt-4 bg-surface border-t border-gray-200">
        <TouchableOpacity
          className="py-4 rounded-2xl items-center justify-center bg-primary"
          onPress={handleNext}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#EDE5CC" />
          ) : (
            <View className="flex-row items-center gap-2">
              <Text
                className="text-surface"
                style={{ fontFamily: "DMSans_500Medium" }}
              >
                {step < STEPS.length - 1
                  ? "Continuer"
                  : "Envoyer la demande"}
              </Text>
              <ChevronRight color="#EDE5CC" size={18} strokeWidth={1.5} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
