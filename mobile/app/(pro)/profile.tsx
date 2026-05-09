/**
 * Pro Profile — edit bio, specialty, radius + KYC shortcut.
 * Mirrors NurseProfile.tsx (web).
 */

import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Shield, ChevronRight, LogOut } from "lucide-react-native";

import { useAuth } from "../../../shared/auth-context";
import { useI18n } from "../../../shared/i18n";
import { db } from "../../../shared/db/dal";
import type { Professional, ProSpecialty } from "../../../shared/db/types";

const SPECIALTIES: { value: ProSpecialty; label: string }[] = [
  { value: "nurse", label: "Infirmier(e)" },
  { value: "psychologist", label: "Psychologue" },
  { value: "physiotherapist", label: "Kinésithérapeute" },
  { value: "yoga_instructor", label: "Instructeur Yoga" },
];

export default function ProProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();

  const [pro, setPro] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState<ProSpecialty>("nurse");
  const [yearsExp, setYearsExp] = useState("0");
  const [radius, setRadius] = useState("10");
  const [hourlyRate, setHourlyRate] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    if (!user) return;
    db.pros
      .get(user.id)
      .then((data) => {
        if (data) {
          setPro(data);
          setBio(data.bio ?? "");
          setSpecialty(data.specialty);
          setYearsExp(data.years_experience.toString());
          setRadius(data.service_radius_km.toString());
          setHourlyRate(data.hourly_rate_mad?.toString() ?? "");
          setIsAvailable(data.is_available);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await db.pros.upsert({
        id: user.id,
        specialty,
        bio: bio || null,
        years_experience: parseInt(yearsExp) || 0,
        service_radius_km: parseFloat(radius) || 10,
        hourly_rate_mad: hourlyRate ? parseFloat(hourlyRate) : null,
        is_available: isAvailable,
      });
      Alert.alert("Sauvegardé", "Votre profil a été mis à jour.");
    } catch (err: any) {
      Alert.alert("Erreur", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnecter",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#0D0870" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="bg-primary px-5 py-4">
        <Text
          className="text-surface text-xl"
          style={{ fontFamily: "DMSerifDisplay_400Regular" }}
        >
          Mon profil professionnel
        </Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled">
        {/* Avatar + name */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-mid items-center justify-center">
            <Text className="text-white text-2xl">
              {(profile?.firstName ?? "P").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text
            className="text-primary text-lg mt-3"
            style={{ fontFamily: "DMSerifDisplay_400Regular" }}
          >
            {profile?.firstName} {profile?.lastName}
          </Text>
          {/* Verification badge */}
          <View
            className={`flex-row items-center gap-1 mt-2 px-3 py-1 rounded-full ${
              pro?.verification_status === "approved"
                ? "bg-green-100"
                : pro?.verification_status === "rejected"
                ? "bg-red-100"
                : "bg-yellow-100"
            }`}
          >
            <Shield
              color={
                pro?.verification_status === "approved"
                  ? "#10B981"
                  : pro?.verification_status === "rejected"
                  ? "#EF4444"
                  : "#F59E0B"
              }
              size={12}
              strokeWidth={1.5}
            />
            <Text
              className="text-xs"
              style={{
                color:
                  pro?.verification_status === "approved"
                    ? "#10B981"
                    : pro?.verification_status === "rejected"
                    ? "#EF4444"
                    : "#F59E0B",
                fontFamily: "DMSans_500Medium",
              }}
            >
              {pro?.verification_status === "approved"
                ? "Vérifié"
                : pro?.verification_status === "rejected"
                ? "Rejeté"
                : "En cours de vérification"}
            </Text>
          </View>
        </View>

        {/* Availability toggle */}
        <View className="bg-white rounded-2xl px-5 py-4 mb-4 flex-row items-center justify-between">
          <Text
            className="text-primary"
            style={{ fontFamily: "DMSans_500Medium" }}
          >
            Disponible pour des missions
          </Text>
          <Switch
            value={isAvailable}
            onValueChange={setIsAvailable}
            trackColor={{ false: "#E5E7EB", true: "#5BB8D4" }}
            thumbColor={isAvailable ? "#0D0870" : "#888780"}
          />
        </View>

        {/* Specialty */}
        <Text
          className="text-primary text-sm mb-2"
          style={{ fontFamily: "DMSans_500Medium" }}
        >
          Spécialité
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {SPECIALTIES.map((sp) => (
            <TouchableOpacity
              key={sp.value}
              className={`px-4 py-2 rounded-xl border-2 ${
                specialty === sp.value
                  ? "bg-primary border-primary"
                  : "bg-white border-gray-200"
              }`}
              onPress={() => setSpecialty(sp.value)}
            >
              <Text
                className={specialty === sp.value ? "text-surface" : "text-primary"}
                style={{ fontFamily: "DMSans_400Regular", fontSize: 12 }}
              >
                {sp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form fields */}
        <View className="gap-4 mb-6">
          {[
            {
              label: "Biographie",
              value: bio,
              onChange: setBio,
              placeholder: "Présentez-vous aux patients...",
              multiline: true,
            },
            {
              label: "Années d'expérience",
              value: yearsExp,
              onChange: setYearsExp,
              placeholder: "5",
              keyboardType: "numeric" as const,
            },
            {
              label: "Rayon de service (km)",
              value: radius,
              onChange: setRadius,
              placeholder: "10",
              keyboardType: "numeric" as const,
            },
            {
              label: "Tarif horaire (MAD)",
              value: hourlyRate,
              onChange: setHourlyRate,
              placeholder: "200",
              keyboardType: "numeric" as const,
            },
          ].map((field) => (
            <View key={field.label}>
              <Text
                className="text-primary text-sm mb-2"
                style={{ fontFamily: "DMSans_500Medium" }}
              >
                {field.label}
              </Text>
              <TextInput
                className="bg-white rounded-2xl px-4 py-4 text-gray-800 border border-gray-100"
                placeholder={field.placeholder}
                placeholderTextColor="#888780"
                value={field.value}
                onChangeText={field.onChange}
                keyboardType={field.keyboardType}
                multiline={field.multiline}
                numberOfLines={field.multiline ? 3 : 1}
                textAlignVertical={field.multiline ? "top" : "center"}
                style={{
                  fontFamily: "DMSans_400Regular",
                  ...(field.multiline ? { minHeight: 80 } : {}),
                }}
              />
            </View>
          ))}
        </View>

        {/* KYC shortcut */}
        <TouchableOpacity
          className="bg-white rounded-2xl px-5 py-4 mb-4 flex-row items-center"
          onPress={() => router.push("/(pro)/kyc")}
        >
          <Shield color="#0D0870" size={20} strokeWidth={1.5} />
          <Text
            className="flex-1 text-primary ml-3"
            style={{ fontFamily: "DMSans_500Medium" }}
          >
            Documents KYC
          </Text>
          <ChevronRight color="#888780" size={18} strokeWidth={1.5} />
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity
          className="bg-primary py-4 rounded-2xl items-center mb-4"
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#EDE5CC" />
          ) : (
            <Text
              className="text-surface"
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              Sauvegarder
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity
          className="flex-row items-center justify-center py-4 rounded-2xl border border-red-200 mb-8"
          onPress={handleSignOut}
        >
          <LogOut color="#EF4444" size={18} strokeWidth={1.5} />
          <Text
            className="text-red-500 ml-2"
            style={{ fontFamily: "DMSans_500Medium" }}
          >
            Se déconnecter
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
