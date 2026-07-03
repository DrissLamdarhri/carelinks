import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";

export async function usePickImage() {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("Permission d'accès à la galerie refusée.");
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0];
  } catch (error) {
    console.error("Error picking image:", error);
    showToast("Erreur lors de la sélection de l'image.");
    return null;
  }
}

export async function uploadAvatarToSupabase(
  userId: string,
  imageUri: string,
  mimeType: string = "image/jpeg"
): Promise<string | null> {
  try {
    const fileName = `${userId}-${Date.now()}.jpg`;
    
    // Read file as binary
    const fileContent = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to bytes
    const binaryString = atob(fileContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(fileName, bytes, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      showToast("Erreur lors de l'upload de l'image.");
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error("Error uploading avatar:", error);
    showToast("Erreur lors de l'upload.");
    return null;
  }
}

export async function updateProfileAvatar(
  userId: string,
  avatarUrl: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId);

    if (error) {
      console.error("Update error:", error);
      showToast("Erreur lors de la mise à jour du profil.");
      return false;
    }

    showToast("Photo de profil mise à jour.");
    return true;
  } catch (error) {
    console.error("Error updating profile:", error);
    showToast("Erreur lors de la mise à jour.");
    return false;
  }
}
