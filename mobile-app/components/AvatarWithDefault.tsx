import { Image, View, StyleSheet, Text } from "react-native";
import { Colors } from "@/lib/colors";

interface AvatarWithDefaultProps {
  avatarUrl?: string | null;
  initials?: string;
  size?: number;
  borderRadius?: number;
  useDefaultImage?: boolean;
}

export function AvatarWithDefault({
  avatarUrl,
  initials = "?",
  size = 64,
  borderRadius,
  useDefaultImage = false,
}: AvatarWithDefaultProps) {
  const radius = borderRadius ?? size / 2;
  const hasAvatar = Boolean(avatarUrl && avatarUrl.length > 0);

  if (hasAvatar && !useDefaultImage) {
    return (
      <Image
        source={{ uri: avatarUrl || "" }}
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: radius },
        ]}
        resizeMode="cover"
      />
    );
  }

  // Use default image from assets
  if (useDefaultImage || !hasAvatar) {
    return (
      <View
        style={[
          styles.defaultContainer,
          { width: size, height: size, borderRadius: radius },
        ]}
      >
        <Image
          source={require("@/assets/default-avatar.png")}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: radius,
          }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: Colors.input,
  },
  defaultContainer: {
    backgroundColor: "#F0F0F0",
    overflow: "hidden",
  },
});
