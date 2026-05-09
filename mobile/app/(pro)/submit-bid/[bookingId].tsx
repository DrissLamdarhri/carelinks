/**
 * Submit Bid screen — Pro places an offer on an open booking.
 * Mirrors NurseBooking.tsx (web).
 */

import { useState, useEffect } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, DollarSign, Clock, MessageSquare } from "lucide-react-native";

import { useAuth } from "../../../../shared/auth-context";
import { db } from "../../../../shared/db/dal";
import type { Booking } from "../../../../shared/db/types";

export default function SubmitBidScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);

  const [price, setPrice] = useState("");
  const [eta, setEta] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    db.bookings
      .get(bookingId)
      .then(setBooking)
      .catch((err) => Alert.alert("Erreur", err.message))
      .finally(() => setLoadingBooking(false));
  }, [bookingId]);

  const handleSubmit = async () => {
    if (!price) {
      Alert.alert("Prix requis", "Veuillez entrer votre prix.");
      return;
    }
    if (!user || !bookingId) return;

    const parsedPrice = parseFloat(price);
    if (
      booking?.budget_max_mad &&
      parsedPrice > booking.budget_max_mad
    ) {
      Alert.alert(
        "Prix trop élevé",
        `Le budget maximum du patient est ${booking.budget_max_mad} MAD.`
      );
      return;
    }

    setSubmitting(true);
    try {
      await db.bids.create({
        booking_id: bookingId,
        professional_id: user.id,
        price_mad: parsedPrice,
        eta_min: eta ? parseInt(eta) : undefined,
        message: message.trim() || undefined,
      });
      Alert.alert("Offre envoyée !", "Le patient sera notifié de votre offre.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Erreur", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingBooking) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#0D0870" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="bg-primary px-5 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <ArrowLeft color="#EDE5CC" size={22} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text
          className="text-surface text-lg"
          style={{ fontFamily: "DMSerifDisplay_400Regular" }}
        >
          Proposer une offre
        </Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled">
        {/* Booking summary */}
        {booking && (
          <View className="bg-white rounded-2xl p-5 mb-6">
            <Text
              className="text-muted text-xs mb-1 uppercase"
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              Demande patient
            </Text>
            <Text
              className="text-primary text-base mb-2 capitalize"
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              {booking.specialty.replace("_", " ")}
            </Text>
            {booking.address && (
              <Text
                className="text-muted text-sm mb-1"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                📍 {booking.address}
              </Text>
            )}
            {(booking.budget_min_mad || booking.budget_max_mad) && (
              <Text
                className="text-mid text-sm"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                💰 Budget : {booking.budget_min_mad ?? "?"} – {booking.budget_max_mad ?? "?"} MAD
              </Text>
            )}
            {booking.notes && (
              <Text
                className="text-muted text-sm mt-2 italic"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                "{booking.notes}"
              </Text>
            )}
          </View>
        )}

        {/* Bid form */}
        <Text
          className="text-primary text-xl mb-6"
          style={{ fontFamily: "DMSerifDisplay_400Regular" }}
        >
          Votre offre
        </Text>

        {/* Price */}
        <Text
          className="text-primary text-sm mb-2"
          style={{ fontFamily: "DMSans_500Medium" }}
        >
          Votre prix (MAD) *
        </Text>
        <View className="flex-row items-center bg-white rounded-2xl border border-gray-100 px-4 mb-4">
          <DollarSign color="#5BB8D4" size={18} strokeWidth={1.5} />
          <TextInput
            className="flex-1 py-4 ml-2 text-gray-800"
            placeholder="Ex: 200"
            placeholderTextColor="#888780"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            style={{ fontFamily: "DMSans_400Regular" }}
          />
          <Text
            className="text-muted"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            MAD
          </Text>
        </View>

        {/* ETA */}
        <Text
          className="text-primary text-sm mb-2"
          style={{ fontFamily: "DMSans_500Medium" }}
        >
          Temps d'arrivée estimé (minutes)
        </Text>
        <View className="flex-row items-center bg-white rounded-2xl border border-gray-100 px-4 mb-4">
          <Clock color="#5BB8D4" size={18} strokeWidth={1.5} />
          <TextInput
            className="flex-1 py-4 ml-2 text-gray-800"
            placeholder="Ex: 30"
            placeholderTextColor="#888780"
            value={eta}
            onChangeText={setEta}
            keyboardType="numeric"
            style={{ fontFamily: "DMSans_400Regular" }}
          />
          <Text
            className="text-muted"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            min
          </Text>
        </View>

        {/* Message */}
        <Text
          className="text-primary text-sm mb-2"
          style={{ fontFamily: "DMSans_500Medium" }}
        >
          Message (optionnel)
        </Text>
        <View className="flex-row items-start bg-white rounded-2xl border border-gray-100 px-4 mb-8">
          <MessageSquare
            color="#5BB8D4"
            size={18}
            strokeWidth={1.5}
            style={{ marginTop: 16 }}
          />
          <TextInput
            className="flex-1 py-4 ml-2 text-gray-800"
            placeholder="Présentez-vous brièvement..."
            placeholderTextColor="#888780"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ fontFamily: "DMSans_400Regular", minHeight: 80 }}
          />
        </View>
      </ScrollView>

      {/* Submit */}
      <View className="px-5 pb-6 pt-4 bg-surface border-t border-gray-200">
        <TouchableOpacity
          className="py-4 rounded-2xl items-center justify-center bg-primary"
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#EDE5CC" />
          ) : (
            <Text
              className="text-surface"
              style={{ fontFamily: "DMSans_500Medium" }}
            >
              Envoyer l'offre
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
