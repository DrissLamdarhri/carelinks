/**
 * App entry — redirects to the right portal based on auth state.
 */
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../shared/auth-context";

export default function AppEntry() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/login");
    } else if (role === "pro") {
      router.replace("/(pro)");
    } else {
      router.replace("/(patient)");
    }
  }, [loading, user, role]);

  return (
    <View className="flex-1 items-center justify-center bg-primary">
      <ActivityIndicator size="large" color="#EDE5CC" />
    </View>
  );
}
