/**
 * Yoga catalog — upcoming sessions + enrollment.
 * Mirrors YogaCatalog.tsx (web).
 */

import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Calendar, Clock, Users, Wifi } from "lucide-react-native";

import { useAuth } from "../../../shared/auth-context";
import { db } from "../../../shared/db/dal";
import type { YogaSession } from "../../../shared/db/types";

export default function YogaScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<YogaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsData, enrollmentsData] = await Promise.all([
        db.yoga.listUpcoming(20),
        user ? db.yoga.myEnrollments(user.id) : Promise.resolve([]),
      ]);
      setSessions(sessionsData);
      setEnrolled(new Set(enrollmentsData.map((e) => e.session_id)));
    } catch (err: any) {
      Alert.alert("Erreur", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (session: YogaSession) => {
    if (!user) return;
    if (enrolled.has(session.id)) return;
    setEnrolling(session.id);
    try {
      await db.yoga.enroll(session.id, user.id);
      setEnrolled((prev) => new Set([...prev, session.id]));
      Alert.alert("Inscrit !", `Vous êtes inscrit à "${session.title}".`);
    } catch (err: any) {
      Alert.alert("Erreur", err.message);
    } finally {
      setEnrolling(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="bg-primary px-5 py-4">
        <Text
          className="text-surface text-xl"
          style={{ fontFamily: "DMSerifDisplay_400Regular" }}
        >
          Séances Yoga
        </Text>
        <Text
          className="text-accent text-sm mt-1"
          style={{ fontFamily: "DMSans_400Regular" }}
        >
          Sessions à venir
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0D0870" size="large" />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshing={loading}
          onRefresh={loadData}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-4xl mb-4">🧘</Text>
              <Text
                className="text-muted text-center"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                Aucune séance disponible pour le moment.
              </Text>
            </View>
          }
          renderItem={({ item: session }) => {
            const isEnrolled = enrolled.has(session.id);
            const isEnrolling = enrolling === session.id;
            const date = new Date(session.starts_at);

            return (
              <View className="bg-white rounded-2xl p-5 shadow-sm">
                {/* Online badge */}
                {session.is_online && (
                  <View className="flex-row items-center gap-1 mb-3">
                    <Wifi color="#5BB8D4" size={14} strokeWidth={1.5} />
                    <Text
                      className="text-mid text-xs"
                      style={{ fontFamily: "DMSans_500Medium" }}
                    >
                      En ligne
                    </Text>
                  </View>
                )}

                <Text
                  className="text-primary text-base mb-1"
                  style={{ fontFamily: "DMSans_500Medium" }}
                >
                  {session.title}
                </Text>

                {session.description && (
                  <Text
                    className="text-muted text-sm mb-3"
                    style={{ fontFamily: "DMSans_400Regular" }}
                    numberOfLines={2}
                  >
                    {session.description}
                  </Text>
                )}

                <View className="flex-row gap-4 mb-4">
                  <View className="flex-row items-center gap-1">
                    <Calendar color="#5BB8D4" size={14} strokeWidth={1.5} />
                    <Text
                      className="text-muted text-xs"
                      style={{ fontFamily: "DMSans_400Regular" }}
                    >
                      {date.toLocaleDateString("fr-MA", {
                        day: "numeric",
                        month: "short",
                      })}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Clock color="#5BB8D4" size={14} strokeWidth={1.5} />
                    <Text
                      className="text-muted text-xs"
                      style={{ fontFamily: "DMSans_400Regular" }}
                    >
                      {date.toLocaleTimeString("fr-MA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {session.duration_min} min
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Users color="#5BB8D4" size={14} strokeWidth={1.5} />
                    <Text
                      className="text-muted text-xs"
                      style={{ fontFamily: "DMSans_400Regular" }}
                    >
                      {session.capacity} places
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-primary text-lg"
                    style={{ fontFamily: "DMSerifDisplay_400Regular" }}
                  >
                    {session.price_mad} MAD
                  </Text>
                  <TouchableOpacity
                    className={`px-5 py-3 rounded-xl ${
                      isEnrolled
                        ? "bg-green-100"
                        : "bg-primary"
                    }`}
                    onPress={() => handleEnroll(session)}
                    disabled={isEnrolled || !!isEnrolling}
                  >
                    {isEnrolling ? (
                      <ActivityIndicator color="#EDE5CC" size="small" />
                    ) : (
                      <Text
                        className={
                          isEnrolled ? "text-green-700" : "text-surface"
                        }
                        style={{ fontFamily: "DMSans_500Medium" }}
                      >
                        {isEnrolled ? "✓ Inscrit" : "S'inscrire"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
