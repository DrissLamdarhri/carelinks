import { View, Text, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, ChevronRight, Stethoscope } from "lucide-react-native";
import { useState } from "react";

export default function ProLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "white" }} contentContainerStyle={{ flexGrow: 1 }}>
      {/* Header with background */}
      <View style={{ backgroundColor: "#0D0870", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 24 }}
        >
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" }}>
            <Stethoscope size={24} color="white" />
          </View>
          <View>
            <Text style={{ fontSize: 24, color: "white", fontWeight: "700", fontFamily: "DMSerifDisplay_400Regular" }}>
              Espace Pro
            </Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              Infirmier · Psychologue · Kiné · Yoga
            </Text>
          </View>
        </View>
      </View>

      {/* Form */}
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        <Text style={{ fontSize: 15, color: "#1A1A1A", fontWeight: "600", marginBottom: 20 }}>
          Connectez-vous à votre compte professionnel
        </Text>

        {/* Email input */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 11, color: "#888780", fontWeight: "500", marginBottom: 8 }}>
            Email professionnel
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", height: 52, backgroundColor: "#F3F3F5", borderRadius: 12, paddingHorizontal: 12, gap: 12 }}>
            <Mail size={18} color="#888780" />
            <TextInput
              placeholder="karim@carelink.ma"
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
          <View style={{ flexDirection: "row", alignItems: "center", height: 52, backgroundColor: "#F3F3F5", borderRadius: 12, paddingHorizontal: 12, gap: 12 }}>
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

        {/* Account verification notice */}
        <View style={{ backgroundColor: "#EDE5CC", borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <Text style={{ fontSize: 13, color: "#0D0870", fontWeight: "600", marginBottom: 4 }}>
            Compte vérifié requis
          </Text>
          <Text style={{ fontSize: 11, color: "rgba(13,8,112,0.7)" }}>
            Seuls les professionnels approuvés peuvent se connecter
          </Text>
        </View>

        {/* Register link */}
        <TouchableOpacity
          onPress={() => router.push("/auth/registration")}
          style={{
            width: "100%",
            paddingVertical: 14,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: "#0D0870",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 14, color: "#0D0870", fontWeight: "600" }}>
            Créer un compte professionnel
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
