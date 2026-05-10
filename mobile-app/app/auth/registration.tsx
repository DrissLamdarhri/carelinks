import { View, Text, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, User, MapPin, ChevronRight, CheckCircle2 } from "lucide-react-native";
import { useState } from "react";

const MOROCCAN_CITIES = ["Fès", "Casablanca", "Rabat", "Marrakech", "Agadir"];

export default function RegistrationScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Fès");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

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
          Créer un compte
        </Text>
        <Text style={{ fontSize: 14, color: "#888780", marginBottom: 24 }}>
          Inscrivez-vous pour commencer à utiliser CareLink
        </Text>

        {/* Name fields */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: "#888780", fontWeight: "500", marginBottom: 8 }}>
              Prénom
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", height: 50, backgroundColor: "#F3F3F5", borderRadius: 12, paddingHorizontal: 12, gap: 8 }}>
              <User size={16} color="#888780" />
              <TextInput
                placeholder="Driss"
                value={firstName}
                onChangeText={setFirstName}
                style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}
                placeholderTextColor="#B0B0B0"
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: "#888780", fontWeight: "500", marginBottom: 8 }}>
              Nom
            </Text>
            <TextInput
              placeholder="Alaoui"
              value={lastName}
              onChangeText={setLastName}
              style={{ flex: 1, height: 50, backgroundColor: "#F3F3F5", borderRadius: 12, paddingHorizontal: 12, fontSize: 14, color: "#1A1A1A" }}
              placeholderTextColor="#B0B0B0"
            />
          </View>
        </View>

        {/* Phone input */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: "#888780", fontWeight: "500", marginBottom: 8 }}>
            Téléphone
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", height: 50, backgroundColor: "#F3F3F5", borderRadius: 12, overflow: "hidden" }}>
            <Text style={{ paddingHorizontal: 12, fontSize: 13, color: "#888780", borderRightWidth: 1, borderRightColor: "#E0E0E0" }}>
              +212
            </Text>
            <TextInput
              placeholder="6 12 34 56 78"
              value={phone}
              onChangeText={setPhone}
              style={{ flex: 1, paddingHorizontal: 12, fontSize: 14, color: "#1A1A1A" }}
              placeholderTextColor="#B0B0B0"
            />
          </View>
        </View>

        {/* Email input */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: "#888780", fontWeight: "500", marginBottom: 8 }}>
            Email
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", height: 50, backgroundColor: "#F3F3F5", borderRadius: 12, paddingHorizontal: 12, gap: 12 }}>
            <Mail size={16} color="#888780" />
            <TextInput
              placeholder="driss@email.com"
              value={email}
              onChangeText={setEmail}
              style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}
              placeholderTextColor="#B0B0B0"
            />
          </View>
        </View>

        {/* City picker (simplified) */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: "#888780", fontWeight: "500", marginBottom: 8 }}>
            Ville
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", height: 50, backgroundColor: "#F3F3F5", borderRadius: 12, paddingHorizontal: 12, gap: 12 }}>
            <MapPin size={16} color="#888780" />
            <ScrollView horizontal style={{ flex: 1 }}>
              {MOROCCAN_CITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCity(c)}
                  style={{ paddingRight: 8 }}
                >
                  <Text style={{ fontSize: 14, color: c === city ? "#0D0870" : "#888780", fontWeight: c === city ? "600" : "400" }}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Password input */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: "#888780", fontWeight: "500", marginBottom: 8 }}>
            Mot de passe
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", height: 50, backgroundColor: "#F3F3F5", borderRadius: 12, paddingHorizontal: 12, gap: 12 }}>
            <Lock size={16} color="#888780" />
            <TextInput
              placeholder="Min. 6 caractères"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}
              placeholderTextColor="#B0B0B0"
            />
          </View>
        </View>

        {/* Confirm password */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: "#888780", fontWeight: "500", marginBottom: 8 }}>
            Confirmer le mot de passe
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", height: 50, backgroundColor: "#F3F3F5", borderRadius: 12, paddingHorizontal: 12, gap: 12 }}>
            <Lock size={16} color="#888780" />
            <TextInput
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}
              placeholderTextColor="#B0B0B0"
            />
            {confirmPassword && confirmPassword === password && (
              <CheckCircle2 size={18} color="#0D0870" />
            )}
          </View>
        </View>

        {/* Terms checkbox */}
        <TouchableOpacity
          onPress={() => setAgreed(!agreed)}
          style={{ flexDirection: "row", gap: 12, marginVertical: 16 }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: agreed ? "#0D0870" : "transparent",
              borderWidth: agreed ? 0 : 2,
              borderColor: agreed ? "transparent" : "#D0D0D0",
              justifyContent: "center",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            {agreed && <CheckCircle2 size={12} color="white" />}
          </View>
          <Text style={{ flex: 1, fontSize: 12, color: "#888780", lineHeight: 18 }}>
            J'accepte les{" "}
            <Text style={{ color: "#0D0870", textDecorationLine: "underline" }}>
              conditions d'utilisation
            </Text>
            {" "}et la{" "}
            <Text style={{ color: "#0D0870", textDecorationLine: "underline" }}>
              politique de confidentialité
            </Text>
          </Text>
        </TouchableOpacity>

        {/* Submit button */}
        <TouchableOpacity
          style={{
            width: "100%",
            paddingVertical: 16,
            backgroundColor: firstName && lastName && phone && email && password && confirmPassword === password && agreed ? "#0D0870" : "#E0E0E0",
            borderRadius: 16,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
          }}
          disabled={!firstName || !lastName || !phone || !email || !password || confirmPassword !== password || !agreed}
        >
          <Text style={{ fontSize: 15, color: "white", fontWeight: "600", fontFamily: "DMSans_500Medium" }}>
            Créer mon compte
          </Text>
          <ChevronRight size={18} color="white" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
