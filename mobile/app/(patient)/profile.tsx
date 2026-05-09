/**
 * Patient Profile screen — edit name, phone, city + language picker.
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LogOut, ChevronRight } from "lucide-react-native";

import { useAuth } from "../../../shared/auth-context";
import { useI18n } from "../../../shared/i18n";
import { db } from "../../../shared/db/dal";
import type { Locale } from "../../../shared/i18n";

const LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "ar", label: "العربية", flag: "🇲🇦" },
  { value: "dar", label: "Darija", flag: "🇲🇦" },
];

export default function PatientProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();

  const [fullName, setFullName] = useState(
    `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim()
  );
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await db.profiles.update(user.id, {
        full_name: fullName,
        phone: phone || null,
        city: city || null,
      });
      await refreshProfile();
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

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="bg-primary px-5 py-4">
        <Text
          className="text-surface text-xl"
          style={{ fontFamily: "DMSerifDisplay_400Regular" }}
        >
          Mon profil
        </Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled">
        {/* Avatar placeholder */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-primary items-center justify-center">
            <Text className="text-surface text-2xl">
              {(profile?.firstName ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text
            className="text-primary text-lg mt-3"
            style={{ fontFamily: "DMSerifDisplay_400Regular" }}
          >
            {profile?.firstName} {profile?.lastName}
          </Text>
          <Text
            className="text-muted text-sm"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            {user?.email}
          </Text>
        </View>

        {/* Form */}
        <View className="gap-4 mb-8">
          {[
            { label: "Nom complet", value: fullName, onChange: setFullName, placeholder: "Votre nom" },
            { label: "Téléphone", value: phone, onChange: setPhone, placeholder: "+212 6XX XXX XXX", keyboardType: "phone-pad" as const },
            { label: "Ville", value: city, onChange: setCity, placeholder: "Casablanca" },
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
                style={{ fontFamily: "DMSans_400Regular" }}
              />
            </View>
          ))}
        </View>

        {/* Language picker */}
        <Text
          className="text-primary text-sm mb-3"
          style={{ fontFamily: "DMSans_500Medium" }}
        >
          Langue de l'application
        </Text>
        <View className="bg-white rounded-2xl mb-8 overflow-hidden">
          {LOCALES.map((loc, i) => (
            <TouchableOpacity
              key={loc.value}
              className={`flex-row items-center px-4 py-4 ${
                i < LOCALES.length - 1 ? "border-b border-gray-100" : ""
              }`}
              onPress={() => setLocale(loc.value)}
            >
              <Text className="text-xl mr-3">{loc.flag}</Text>
              <Text
                className="flex-1 text-gray-800"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                {loc.label}
              </Text>
              {locale === loc.value && (
                <View className="w-5 h-5 rounded-full bg-mid items-center justify-center">
                  <Text className="text-white text-xs">✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Save button */}
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
          <LogOut color="#EF4444" size={18} strokeWidth={1.5} className="mr-2" />
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
