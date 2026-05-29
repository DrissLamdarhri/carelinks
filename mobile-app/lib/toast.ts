import { Alert, Platform, ToastAndroid } from "react-native";

type ToastDuration = "short" | "long";

export function showToast(message: string, duration: ToastDuration = "short") {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, duration === "long" ? ToastAndroid.LONG : ToastAndroid.SHORT);
    return;
  }
  Alert.alert("Information", message);
}
