import * as ImagePicker from "expo-image-picker";
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
      mediaTypes: [ImagePicker.MediaType.Image],
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

    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      name: "selfie.jpg",
      type: mimeType,
    } as any);

    const { supabase } = await import("@/lib/supabase");

    const { data, error } = await supabase.storage
      .from("pro-documents")
      .upload(fileName, formData as any, {
        contentType: mimeType,
        upsert: true,
      } as any);

    if (error) {
      console.error("Upload selfie error:", error, {
        message: error.message,
        status: (error as any).status ?? null,
        details: (error as any).details ?? null,
      });
      if (error.message?.includes("row-level security")) {
        showToast("Erreur de sécurité. Veuillez réessayer ou contacter le support.");
      } else if (error.message?.includes("Bucket not found")) {
        showToast("Le bucket de stockage n'existe pas. Veuillez contacter le support.");
      } else if (error.message?.includes("Network")) {
        showToast("Erreur réseau. Vérifiez votre connexion internet.");
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
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("Network")) {
      showToast("Erreur réseau. Vérifiez votre connexion internet.");
    } else {
      showToast("Erreur lors de l'upload du selfie.");
    }
    return null;
  }
}
