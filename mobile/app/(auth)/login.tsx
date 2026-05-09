/**
 * CareLink — Login screen
 * Google Sign-In AND email/password are shown side-by-side (per spec).
 * The `role` query param switches between patient and pro portals.
 *
 * Usage:
 *   router.push("/(auth)/login?role=patient")
 *   router.push("/(auth)/login?role=pro")
 */

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../shared/auth-context";
import { useI18n } from "../../../shared/i18n";

type Tab = "login" | "signup";

export default function LoginScreen() {
  const { role = "patient" } = useLocalSearchParams<{
    role: "patient" | "pro";
  }>();
  const router = useRouter();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { t } = useI18n();

  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const isPatient = role !== "pro";
  const accentColor = isPatient ? "#5BB8D4" : "#8ECFDF";

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle(role as "patient" | "pro");
    } catch (err: any) {
      Alert.alert("Google Sign-In", err.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert("Champs requis", "Veuillez remplir l'email et le mot de passe.");
      return;
    }
    setLoading(true);
    try {
      if (tab === "login") {
        await signInWithEmail(email, password, role as "patient" | "pro");
      } else {
        if (!fullName) {
          Alert.alert("Champs requis", "Veuillez entrer votre nom complet.");
          return;
        }
        await signUpWithEmail(
          email,
          password,
          fullName,
          role as "patient" | "pro"
        );
        Alert.alert(
          "Compte créé",
          "Vérifiez votre email pour confirmer votre compte."
        );
      }
    } catch (err: any) {
      Alert.alert("Erreur", err.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center pt-20 pb-10 px-6">
          <Text
            className="text-surface text-4xl mb-2"
            style={{ fontFamily: "DMSerifDisplay_400Regular" }}
          >
            CareLink
          </Text>
          <Text className="text-accent text-base text-center">
            {isPatient
              ? "Accédez aux soins à domicile"
              : "Gérez vos consultations"}
          </Text>
        </View>

        {/* Portal toggle */}
        <View className="flex-row mx-6 mb-8 bg-primary-light rounded-2xl p-1">
          <TouchableOpacity
            className={`flex-1 py-3 rounded-xl items-center ${
              isPatient ? "bg-surface" : ""
            }`}
            onPress={() => router.setParams({ role: "patient" })}
          >
            <Text
              className={`${
                isPatient ? "text-primary" : "text-accent"
              }`}
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              Patient
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 rounded-xl items-center ${
              !isPatient ? "bg-surface" : ""
            }`}
            onPress={() => router.setParams({ role: "pro" })}
          >
            <Text
              className={`${!isPatient ? "text-primary" : "text-accent"}`}
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              Professionnel
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card */}
        <View className="mx-6 bg-surface rounded-3xl p-6 shadow-lg">
          {/* Google button */}
          <TouchableOpacity
            className="flex-row items-center justify-center bg-white border border-gray-200 rounded-2xl py-4 mb-6 shadow-sm"
            onPress={handleGoogle}
            disabled={loading}
          >
            {/* Google "G" icon placeholder — replace with actual SVG */}
            <Text className="text-lg mr-2">G</Text>
            <Text
              className="text-gray-700"
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              Continuer avec Google
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-px bg-gray-300" />
            <Text className="mx-4 text-muted text-sm">ou</Text>
            <View className="flex-1 h-px bg-gray-300" />
          </View>

          {/* Login / Signup tabs */}
          <View className="flex-row mb-6 bg-gray-100 rounded-xl p-1">
            {(["login", "signup"] as Tab[]).map((t_) => (
              <TouchableOpacity
                key={t_}
                className={`flex-1 py-2 rounded-lg items-center ${
                  tab === t_ ? "bg-white shadow-sm" : ""
                }`}
                onPress={() => setTab(t_)}
              >
                <Text
                  className={`text-sm ${
                    tab === t_ ? "text-primary" : "text-muted"
                  }`}
                  style={{ fontFamily: "DMSans_500Medium" }}
                >
                  {t_ === "login" ? "Connexion" : "Inscription"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form fields */}
          {tab === "signup" && (
            <TextInput
              className="bg-gray-100 rounded-xl px-4 py-4 mb-4 text-gray-800"
              placeholder="Nom complet"
              placeholderTextColor="#888780"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              style={{ fontFamily: "DMSans_400Regular" }}
            />
          )}

          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-4 mb-4 text-gray-800"
            placeholder="Email"
            placeholderTextColor="#888780"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ fontFamily: "DMSans_400Regular" }}
          />

          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-4 mb-6 text-gray-800"
            placeholder="Mot de passe"
            placeholderTextColor="#888780"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{ fontFamily: "DMSans_400Regular" }}
          />

          {/* Submit */}
          <TouchableOpacity
            className="py-4 rounded-2xl items-center justify-center"
            style={{ backgroundColor: accentColor }}
            onPress={handleEmailAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0D0870" />
            ) : (
              <Text
                className="text-primary"
                style={{ fontFamily: "DMSans_500Medium" }}
              >
                {tab === "login" ? "Se connecter" : "Créer un compte"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer padding */}
        <View className="h-10" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
