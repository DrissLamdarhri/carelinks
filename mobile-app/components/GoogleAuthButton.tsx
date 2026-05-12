import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "@/lib/colors";

interface GoogleAuthButtonProps {
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function GoogleAuthButton({
  label = "Continuer avec Google",
  loading = false,
  disabled = false,
  onPress,
}: GoogleAuthButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.textPrimary} />
      ) : (
        <>
          <View style={styles.logoWrap}>
            <View style={[styles.logoStroke, { borderTopColor: "#EA4335", borderRightColor: "#EA4335" }]} />
            <View style={[styles.logoStroke, { borderBottomColor: "#34A853", borderLeftColor: "#34A853", transform: [{ rotate: "180deg" }] }]} />
            <View style={styles.logoBlueBar} />
            <View style={styles.logoYellow} />
          </View>
          <Text style={styles.text}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  logoWrap: {
    width: 18,
    height: 18,
    position: "relative",
  },
  logoStroke: {
    position: "absolute",
    inset: 0,
    borderRadius: 9,
    borderWidth: 3,
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
    borderTopColor: "transparent",
    borderRightColor: "transparent",
  },
  logoBlueBar: {
    position: "absolute",
    width: 8,
    height: 3,
    right: 0,
    top: 8,
    backgroundColor: "#4285F4",
    borderRadius: 2,
  },
  logoYellow: {
    position: "absolute",
    width: 8,
    height: 8,
    left: 0,
    top: 5,
    borderRadius: 4,
    borderWidth: 3,
    borderColor: "#FBBC05",
    borderRightColor: "transparent",
  },
  text: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
});
