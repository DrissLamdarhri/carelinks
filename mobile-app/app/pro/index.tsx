import { View, Text, TouchableOpacity, ScrollView, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Wifi, WifiOff, TrendingUp, Star, Activity, Calendar, Check, Banknote, X } from "lucide-react-native";
import { useState } from "react";

export default function ProHomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [tab, setTab] = useState<"requests" | "schedule">("requests");

  const requests = [
    {
      id: "1",
      name: "Fatima",
      service: "Infirmier",
      price: 120,
      time: "14:30 - 15:00",
      address: "Fès, Maroc",
    },
    {
      id: "2",
      name: "Ahmed",
      service: "Kiné",
      price: 150,
      time: "16:00 - 17:00",
      address: "Fès, Maroc",
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#EDE5CC" }} contentContainerStyle={{ flexGrow: 1 }}>
      {/* Header */}
      <View style={{ backgroundColor: "#0D0870", paddingHorizontal: 20, paddingTop: 40, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 20, backgroundColor: "rgba(91,184,212,0.3)", justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>K</Text>
            </View>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Bonjour 👋</Text>
              <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>Karim</Text>
            </View>
          </View>

          {/* Online toggle */}
          <TouchableOpacity
            onPress={() => setIsOnline(!isOnline)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: isOnline ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)",
            }}
          >
            {isOnline ? (
              <Wifi size={14} color="#4ade80" />
            ) : (
              <WifiOff size={14} color="rgba(255,255,255,0.5)" />
            )}
            <Text style={{ fontSize: 11, color: isOnline ? "#4ade80" : "rgba(255,255,255,0.5)", fontWeight: "500" }}>
              {isOnline ? "En ligne" : "Hors ligne"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[
            { icon: TrendingUp, label: "Aujourd'hui", value: "450 MAD" },
            { icon: Star, label: "Note", value: "4.8" },
            { icon: Activity, label: "Ce mois", value: "12 missions" },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <View key={i} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 }}>
                <Icon size={14} color="rgba(255,255,255,0.6)" />
                <Text style={{ color: "white", fontSize: 14, fontWeight: "700", marginTop: 8 }}>
                  {stat.value}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>
                  {stat.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Tabs */}
      <View style={{ backgroundColor: "white", flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
        {(["requests", "schedule"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderBottomWidth: tab === t ? 2 : 0,
              borderBottomColor: tab === t ? "#0D0870" : "transparent",
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontSize: 14,
                color: tab === t ? "#0D0870" : "#888780",
                fontWeight: tab === t ? "600" : "400",
              }}
            >
              {t === "requests" ? `Demandes (${requests.length})` : "Mon planning"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
        {tab === "requests" ? (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: "white", borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
                {/* Badge */}
                <View style={{ backgroundColor: "#6BB8C8", paddingVertical: 8, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 11, color: "white", fontWeight: "600" }}>
                    Nouvelle demande
                  </Text>
                  <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>
                    14:00
                  </Text>
                </View>

                {/* Content */}
                <View style={{ padding: 16 }}>
                  {/* Patient info */}
                  <View style={{ flexDirection: "row", gap: 12, marginBottom: 12, alignItems: "center" }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#EDE5CC", justifyContent: "center", alignItems: "center" }}>
                      <Text style={{ color: "#0D0870", fontSize: 16, fontWeight: "700" }}>
                        {item.name[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, color: "#1A1A1A", fontWeight: "600", marginBottom: 4 }}>
                        {item.name}
                      </Text>
                      <View style={{ backgroundColor: "#EDE5CC", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" }}>
                        <Text style={{ fontSize: 11, color: "#0D0870", fontWeight: "500" }}>
                          {item.service}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 22, color: "#0D0870", fontWeight: "800" }}>
                        {item.price}
                      </Text>
                      <Text style={{ fontSize: 10, color: "#888780" }}>
                        MAD proposé
                      </Text>
                    </View>
                  </View>

                  {/* Time and location */}
                  <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Calendar size={12} color="#888780" />
                      <Text style={{ fontSize: 12, color: "#888780" }}>
                        {item.time}
                      </Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 12, backgroundColor: "#0D0870", borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}
                    >
                      <Check size={16} color="white" />
                      <Text style={{ fontSize: 13, color: "white", fontWeight: "600" }}>
                        Accepter
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        backgroundColor: "white",
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: "#0D0870",
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Banknote size={16} color="#0D0870" />
                      <Text style={{ fontSize: 13, color: "#0D0870", fontWeight: "600" }}>
                        Contre-offre
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ width: 48, paddingVertical: 12, backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: "#E0E0E0", justifyContent: "center", alignItems: "center" }}
                    >
                      <X size={18} color="#888780" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Calendar size={48} color="#D0D0D0" />
            <Text style={{ fontSize: 15, color: "#888780", fontWeight: "500", marginTop: 16 }}>
              Aucun rendez-vous
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
