import { View, Text, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, ChevronRight } from "lucide-react-native";
import { useState } from "react";

export default function PatientLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "white" }} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F3F5", justifyContent: "center", alignItems: "center", marginBottom: 24 }}
        >
          <ArrowLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>

        {/* Title */}
        <Text style={{ fontSize: 28, color: "#1A1A1A", fontWeight: "700", fontFamily: "DMSerifDisplay_400Regular", marginBottom: 8 }}>
          Bon retour !
        </Text>
        <Text style={{ fontSize: 14, color: "#888780", marginBottom: 24 }}>
          Connectez-vous pour accéder à vos soins
        </Text>

        {/* Email input */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: "#888780", fontWeight: "500", marginBottom: 8 }}>
            Email
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", height: 50, backgroundColor: "#F3F3F5", borderRadius: 12, paddingHorizontal: 12, gap: 12 }}>
            <Mail size={18} color="#888780" />
            <TextInput
              placeholder="votre@email.com"
              value={email}
              onChangeText={setEmail}
              style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}
              placeholderTextColor="#B0B0B0"
            />
          </View>
        </View>

        {/* Password input */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: "#888780", fontWeight: "500", marginBottom: 8 }}>
            Mot de passe
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", height: 50, backgroundColor: "#F3F3F5", borderRadius: 12, paddingHorizontal: 12, gap: 12 }}>
            <Lock size={18} color="#888780" />
            <TextInput
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}
              placeholderTextColor="#B0B0B0"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff size={18} color="#888780" />
              ) : (
                <Eye size={18} color="#888780" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Forgot password */}
        <TouchableOpacity style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, color: "#0D0870", fontWeight: "500", textAlign: "right" }}>
            Mot de passe oublié ?
          </Text>
        </TouchableOpacity>

        {/* Sign in button */}
        <TouchableOpacity
          style={{
            width: "100%",
            paddingVertical: 16,
            backgroundColor: email && password ? "#0D0870" : "#E0E0E0",
            borderRadius: 16,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
          }}
          disabled={!email || !password}
        >
          <Text style={{ fontSize: 15, color: "white", fontWeight: "600", fontFamily: "DMSans_500Medium" }}>
            Se connecter
          </Text>
          <ChevronRight size={18} color="white" />
        </TouchableOpacity>

        {/* Demo hint */}
        <View style={{ backgroundColor: "#EDE5CC", borderRadius: 12, padding: 12 }}>
          <Text style={{ fontSize: 11, color: "#0D0870", fontWeight: "500" }}>
            💡 Première visite ? Créez un compte via l'onglet "Inscription" ci-dessus.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
