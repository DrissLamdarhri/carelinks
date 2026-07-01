import { supabase } from "@/lib/supabase";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";
import type { UUID } from "./types";

const AVATAR_BUCKET = "avatars";

function inferExtension(imageType: string, imageUri: string): string {
  const normalizedType = imageType.toLowerCase();
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) return "jpg";
  if (normalizedType.includes("png")) return "png";
  if (normalizedType.includes("webp")) return "webp";
  if (normalizedType.includes("heic")) return "heic";
  if (normalizedType.includes("heif")) return "heif";
  if (normalizedType.includes("gif")) return "gif";

  const uriWithoutQuery = imageUri.split("?")[0];
  const fromUri = uriWithoutQuery.split(".").pop();
  return fromUri ? fromUri.toLowerCase() : "jpg";
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const buffer = Buffer.from(base64, "base64");
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Storage service for handling file uploads to Supabase Storage
 */
export const storage = {
  /**
   * Upload an avatar image for a user
   * @param userId - The user's ID
   * @param imageUri - The local URI of the image file
   * @param imageType - The MIME type of the image (e.g., "image/jpeg")
   * @returns The public URL of the uploaded image
   */
  async uploadAvatar(userId: UUID, imageUri: string, imageType: string = "image/jpeg"): Promise<string> {
    const base64FileData = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64FileData) {
      throw new Error("Avatar upload failed: empty image payload");
    }

    const fileExtension = inferExtension(imageType, imageUri);
    const fileName = `${Date.now()}.${fileExtension}`;
    const filePath = `${userId}/${fileName}`;
    const fileBody = base64ToArrayBuffer(base64FileData);

    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, fileBody, {
        contentType: imageType,
        upsert: false,
      });

    if (error) {
      if (/bucket.*not found/i.test(error.message)) {
        throw new Error(`Avatar upload failed: bucket "${AVATAR_BUCKET}" not found. Create it in Supabase Storage.`);
      }
      throw new Error(`Avatar upload failed: ${error.message}`);
    }

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  },

  /**
   * Delete an avatar from storage
   * @param avatarUrl - The public URL of the avatar to delete
   */
  async deleteAvatar(avatarUrl: string): Promise<void> {
    try {
      const marker = "/object/public/";
      const markerIndex = avatarUrl.indexOf(marker);
      if (markerIndex < 0) return;
      const bucketAndPath = avatarUrl.slice(markerIndex + marker.length);
      const firstSlash = bucketAndPath.indexOf("/");
      if (firstSlash < 0) return;
      const bucket = bucketAndPath.slice(0, firstSlash);
      const filePath = bucketAndPath.slice(firstSlash + 1);
      if (!bucket || !filePath) return;

      const { error } = await supabase.storage.from(bucket).remove([filePath]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }
    } catch (error) {
      console.error("Failed to delete avatar:", error);
      // Don't throw, as this is not critical
    }
  },
};
