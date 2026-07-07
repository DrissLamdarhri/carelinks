import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { showToast } from "@/lib/toast";

export interface CameraAsset {
  uri: string;
  width: number;
  height: number;
  type: "image" | "video";
}

export async function useTakePhoto(): Promise<CameraAsset | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showToast("Permission d'accès à la caméra refusée.");
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      type: "image",
    };
  } catch (error) {
    console.error("Error taking photo:", error);
    showToast("Erreur lors de la prise de photo.");
    return null;
  }
}

export async function uploadSelfieToSupabase(
  userId: string,
  imageUri: string,
  mimeType: string = "image/jpeg"
): Promise<{ url: string; path: string } | null> {
  try {
    const fileName = `${userId}/selfie-${Date.now()}.jpg`;

    let fileData: Uint8Array | null = null;

    try {
      const base64Content = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileData = bytes;
    } catch (readErr) {
      console.error("Failed to read selfie as base64:", readErr);
      showToast("Erreur lors de la lecture du selfie.");
      return null;
    }

    if (!fileData) {
      console.error("No selfie data to upload");
      return null;
    }

    const { supabase } = await import("@/lib/supabase");

    const { data, error } = await supabase.storage
      .from("pro-documents")
      .upload(fileName, fileData, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error("Upload selfie error:", error, {
        message: error.message,
        status: (error as any).status ?? null,
      });
      if (error.message?.includes("row-level security")) {
        showToast("Erreur de sécurité.");
      } else if (error.message?.includes("Network")) {
        showToast("Erreur réseau.");
      } else {
        showToast("Erreur lors de l'upload du selfie.");
      }
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from("pro-documents")
      .getPublicUrl(fileName);

    return { url: publicUrl.publicUrl, path: fileName };
  } catch (error) {
    console.error("Exception uploadSelfieToSupabase:", error);
    showToast("Erreur lors de l'upload du selfie.");
    return null;
  }
}
