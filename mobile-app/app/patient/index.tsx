import { View, Text, TouchableOpacity, ScrollView, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { MapPin, Zap, Syringe, Brain, Activity, Flower2 } from "lucide-react-native";
import { useState } from "react";

export default function PatientHomeScreen() {
  const router = useRouter();
  const [city, setCity] = useState("Fès");

  const services = [
    { id: "infirmier", label: "Infirmier", sub: "À domicile · Dès 60 MAD", icon: Syringe, color: "#0D0870" },
    { id: "psy", label: "Psychologue", sub: "En ligne ou à domicile", icon: Brain, color: "#5B21B6" },
    { id: "yoga", label: "Yoga", sub: "Séances individuelles", icon: Flower2, color: "#0891B2" },
    { id: "kine", label: "Kiné", sub: "Rééducation à domicile", icon: Activity, color: "#065F46" },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F6F5F0" }} contentContainerStyle={{ flexGrow: 1 }}>
      {/* Header */}
      <View style={{ backgroundColor: "linear-gradient(160deg, #0D0870 0%, #1A1585 70%, #0D0870 100%)", paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 20, backgroundColor: "rgba(91,184,212,0.3)", justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>D</Text>
            </View>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Bonjour 👋</Text>
              <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>Driss Alaoui</Text>
            </View>
          </View>
        </View>

        {/* Location */}
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(91,184,212,0.3)", justifyContent: "center", alignItems: "center" }}>
            <MapPin size={13} color="#5BB8D4" />
          </View>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "500" }}>
            {city}
          </Text>
        </TouchableOpacity>

        {/* Heading */}
        <Text style={{ color: "white", fontSize: 20, fontWeight: "700", marginTop: 12, fontFamily: "DMSerifDisplay_400Regular" }}>
          Quel soin recherchez-vous ?
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          Des professionnels certifiés disponibles maintenant
        </Text>
      </View>

      {/* Quick actions */}
      <View style={{ paddingHorizontal: 20, marginTop: -12, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={{ flex: 1, flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12, backgroundColor: "#EDE5CC", borderRadius: 16 }}>
            <Zap size={14} color="#0D0870" />
            <Text style={{ fontSize: 12, color: "#0D0870", fontWeight: "600" }}>Urgence</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12, backgroundColor: "#EDE5CC", borderRadius: 16 }}>
            <Syringe size={14} color="#0D0870" />
            <Text style={{ fontSize: 12, color: "#0D0870", fontWeight: "600" }}>Pansement</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Services grid */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <Text style={{ fontSize: 14, color: "#1A1A1A", fontWeight: "700", marginBottom: 12 }}>
          Choisissez votre service
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <TouchableOpacity
                key={service.id}
                style={{ width: "48%", height: 140, borderRadius: 24, backgroundColor: service.color, overflow: "hidden", justifyContent: "space-between", padding: 16 }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" }}>
                    <Icon size={18} color="white" />
                  </View>
                </View>
                <View>
                  <Text style={{ color: "white", fontSize: 16, fontWeight: "700", marginBottom: 4 }}>
                    {service.label}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                    {service.sub}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <TouchableOpacity
          style={{ width: "100%", paddingVertical: 16, backgroundColor: "#5BB8D4", borderRadius: 24, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 }}
        >
          <Zap size={18} color="white" fill="white" />
          <Text style={{ fontSize: 16, color: "white", fontWeight: "700" }}>
            Demander un soin maintenant
          </Text>
        </TouchableOpacity>
        <Text style={{ textAlign: "center", fontSize: 12, color: "#888780", marginTop: 8 }}>
          ⚡ Réponse en moins de 5 minutes
        </Text>
      </View>
    </ScrollView>
  );
}
