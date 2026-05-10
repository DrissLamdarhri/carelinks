import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0D0870" }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 40, paddingHorizontal: 20 }}>
        {/* Header */}
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 32, color: "white", fontWeight: "700", fontFamily: "DMSerifDisplay_400Regular", marginBottom: 10 }}>
            CareLink
          </Text>
          <View style={{ width: 32, height: 4, backgroundColor: "rgba(255,255,255,0.4)", borderRadius: 2 }} />
        </View>

        {/* Content */}
        <View style={{ alignItems: "center" }}>
          <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 32 }}>🏥</Text>
          </View>
          <Text style={{ fontSize: 24, color: "white", fontWeight: "700", fontFamily: "DMSerifDisplay_400Regular", marginBottom: 12 }}>
            Soins à domicile
          </Text>
          <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 22 }}>
            Infirmiers, kinés, et professionnels de santé viennent chez vous en quelques minutes.
          </Text>
        </View>

        {/* Buttons */}
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push("/auth/patient-login")}
            style={{ width: "100%", paddingVertical: 16, backgroundColor: "white", borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}
          >
            <Text style={{ fontSize: 15, color: "#0D0870", fontWeight: "600", fontFamily: "DMSans_500Medium" }}>
              Je suis patient
            </Text>
            <ChevronRight size={18} color="#0D0870" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/auth/pro-login")}
            style={{ width: "100%", paddingVertical: 16, backgroundColor: "transparent", borderRadius: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}
          >
            <Text style={{ fontSize: 15, color: "white", fontWeight: "500", fontFamily: "DMSans_400Regular" }}>
              Je suis professionnel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
