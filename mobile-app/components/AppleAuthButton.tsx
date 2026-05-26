import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Svg, Path } from "react-native-svg";
import { Colors } from "@/lib/colors";

interface AppleAuthButtonProps {
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function AppleAuthButton({
  label = "Continuer avec Apple",
  loading = false,
  disabled = false,
  onPress,
}: AppleAuthButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <>
          <View style={styles.logoWrap}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M16.365 1.43c0 1.14-.42 2.07-1.26 2.8-.84.73-1.84 1.17-3 1.07-.1-1.09.36-2.07 1.2-2.8.86-.75 1.98-1.22 3.06-1.07ZM20.9 8.67c-.1.08-2.4 1.4-2.37 4.15.03 3.32 2.97 4.42 3 4.43-.02.08-.47 1.63-1.55 3.23-.94 1.4-1.92 2.8-3.43 2.83-1.48.02-1.97-.87-3.67-.87-1.7 0-2.24.84-3.64.9-1.45.05-2.56-1.46-3.52-2.85-1.97-2.85-3.47-8.02-1.45-11.53.99-1.71 2.77-2.8 4.7-2.83 1.47-.03 2.86.98 3.67.98.8 0 2.31-1.22 3.9-1.04.66.03 2.53.27 3.74 2.02-.1.06-2.23 1.3-2.21 3.58Z"
                fill="white"
              />
            </Svg>
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
    borderColor: "#111111",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111111",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  logoWrap: {
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: "600",
    fontFamily: "DMSans_500Medium",
  },
});
