import { View, Text, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Shield, Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { Colors } from "@/lib/colors";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    if (email && password) {
      console.log("Admin login:", { email, password });
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "white" }} contentContainerStyle={{ flexGrow: 1 }}>
      {/* Header */}
      <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" }}>
            <Shield size={24} color="white" />
          </View>
          <View>
            <Text style={{ fontSize: 24, color: "white", fontWeight: "700", fontFamily: "DMSerifDisplay_400Regular" }}>
              CareLink
            </Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "DMSans_400Regular" }}>
              Tableau de bord admin
            </Text>
          </View>
        </View>
        <LocaleSwitcher compact />
      </View>

      {/* Form */}
      <View style={{ paddingHorizontal: 20, paddingTop: 32, flex: 1 }}>
        <Text style={{ fontSize: 20, color: Colors.textPrimary, fontWeight: "700", marginBottom: 8, fontFamily: "DMSerifDisplay_400Regular" }}>
          Connexion Admin
        </Text>
        <Text style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 32, fontFamily: "DMSans_400Regular" }}>
          Accès réservé aux administrateurs CareLink
        </Text>

        {/* Demo credentials */}
        <View style={{ backgroundColor: Colors.surfaceWarm, borderRadius: 16, padding: 16, marginBottom: 32, borderWidth: 1, borderColor: "rgba(13,8,112,0.1)" }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Shield size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "600", marginBottom: 8, fontFamily: "DMSans_500Medium" }}>
                🔐 Identifiants de démonstration
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(13,8,112,0.7)", marginBottom: 4, fontFamily: "Courier New" }}>
                admin@carelink.ma
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(13,8,112,0.7)", fontFamily: "Courier New" }}>
                CareLinkAdmin2024!
              </Text>
            </View>
          </View>
        </View>

        {/* Email input */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 12, color: Colors.textPrimary, fontWeight: "500", marginBottom: 8, fontFamily: "DMSans_500Medium" }}>
            Adresse email
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", height: 56, backgroundColor: "#F3F3F5", borderRadius: 16, paddingHorizontal: 16, gap: 12 }}>
            <Mail size={18} color={Colors.textMuted} />
            <TextInput
              placeholder="admin@carelink.ma"
              value={email}
              onChangeText={setEmail}
              style={{ flex: 1, fontSize: 14, color: Colors.textPrimary, fontFamily: "DMSans_400Regular" }}
              placeholderTextColor="#B0B0B0"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Password input */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: Colors.textPrimary, fontWeight: "500", fontFamily: "DMSans_500Medium" }}>
              Mot de passe
            </Text>
            <TouchableOpacity>
              <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "500", fontFamily: "DMSans_500Medium" }}>
                Oublié ?
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", height: 56, backgroundColor: "#F3F3F5", borderRadius: 16, paddingHorizontal: 16, gap: 12 }}>
            <Lock size={18} color={Colors.textMuted} />
            <TextInput
              placeholder="••••••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={{ flex: 1, fontSize: 14, color: Colors.textPrimary, fontFamily: "DMSans_400Regular" }}
              placeholderTextColor="#B0B0B0"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff size={18} color={Colors.textMuted} />
              ) : (
                <Eye size={18} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit button */}
        <TouchableOpacity
          onPress={handleLogin}
          style={{
            width: "100%",
            height: 56,
            borderRadius: 16,
            backgroundColor: email && password ? Colors.primary : "#D0D0D0",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            marginTop: 32,
            marginBottom: 24,
          }}
          disabled={!email || !password}
        >
          <Shield size={18} color="white" />
          <Text style={{ fontSize: 15, color: "white", fontWeight: "600", fontFamily: "DMSans_500Medium" }}>
            Accéder au tableau
          </Text>
        </TouchableOpacity>

        {/* Security notice */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Shield size={14} color="#B0B0B0" />
          <Text style={{ fontSize: 12, color: "#B0B0B0", fontFamily: "DMSans_400Regular" }}>
            Connexion sécurisée · Accès protégé
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
