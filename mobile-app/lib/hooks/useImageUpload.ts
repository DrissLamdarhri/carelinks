import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { tr } from "@/lib/i18n";

export async function usePickImage() {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast(tr("perm_gallery_denied"));
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
    showToast(tr("image_pick_error"));
    return null;
  }
}

/** Camera capture — used for ID documents, where a live photo beats a gallery pick. */
export async function useCaptureImage(aspect: [number, number] = [3, 2]) {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showToast(tr("perm_camera_denied"));
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });
    if (result.canceled) return null;
    return result.assets[0];
  } catch (error) {
    console.error("Error capturing image:", error);
    showToast(tr("photo_capture_error"));
    return null;
  }
}

/** Gallery pick with a configurable aspect (the avatar picker is locked to 1:1). */
export async function usePickDocumentImage(aspect: [number, number] = [3, 2]) {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast(tr("perm_gallery_denied"));
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });
    if (result.canceled) return null;
    return result.assets[0];
  } catch (error) {
    console.error("Error picking document:", error);
    showToast(tr("image_pick_error"));
    return null;
  }
}

/**
 * Upload to a PRIVATE bucket and return the storage path (not a public URL —
 * these buckets have no public URL by design). The path must start with the
 * user's uid: every private-bucket policy checks foldername(name)[1] = auth.uid().
 */
export async function uploadPrivateDocument(
  bucket: string,
  userId: string,
  imageUri: string,
  fileName: string,
  mimeType: string = "image/jpeg",
): Promise<string | null> {
  try {
    const filePath = `${userId}/${fileName}`;
    const fileContent = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!fileContent) {
      showToast(tr("image_empty_retry"));
      return null;
    }
    const bytes = Buffer.from(fileContent, "base64");
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, bytes, { contentType: mimeType, cacheControl: "3600", upsert: true });
    if (error) {
      console.error("Private upload error:", error);
      showToast(tr("doc_send_error"));
      return null;
    }
    return filePath;
  } catch (error) {
    console.error("Error uploading private document:", error);
    showToast(tr("send_failed"));
    return null;
  }
}

export async function uploadAvatarToSupabase(
  userId: string,
  imageUri: string,
  mimeType: string = "image/jpeg"
): Promise<string | null> {
  try {
    // MUST live in a folder named after the user's UID: the avatars RLS policy
    // checks `storage.foldername(name)[1] = auth.uid()`. A flat "uid-123.jpg"
    // has no folder, so the insert was rejected → StorageApiError. Use "uid/…".
    const filePath = `${userId}/${Date.now()}.jpg`;

    // Read file as base64, then to bytes for a reliable binary upload in RN.
    const fileContent = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!fileContent) {
      showToast(tr("image_empty_retry"));
      return null;
    }
    const bytes = Buffer.from(fileContent, "base64");

    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, bytes, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      showToast(tr("image_upload_error"));
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error("Error uploading avatar:", error);
    showToast(tr("upload_failed"));
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
      showToast(tr("profile_update_error"));
      return false;
    }

    showToast(tr("avatar_updated"));
    return true;
  } catch (error) {
    console.error("Error updating profile:", error);
    showToast(tr("update_failed"));
    return false;
  }
}
