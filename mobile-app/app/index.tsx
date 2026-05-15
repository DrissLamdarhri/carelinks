import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/lib/colors";

export default function AppIndex() {
  const { loading, user, role } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color="#EDE5CC" />
      </View>
    );
  }

  if (!user) return <Redirect href="/auth" />;
  if (role === "pro") return <Redirect href="/pro" />;
  if (role === "admin") return <Redirect href="/admin" />;
  return <Redirect href="/patient" />;
}
