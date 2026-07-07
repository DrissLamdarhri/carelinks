import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { showToast } from "@/lib/toast";

export interface DocumentAsset {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

const ALLOWED_FORMATS = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function usePickDocument(): Promise<DocumentAsset | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets[0];
    
    if (!asset) return null;

    // Validate file type
    if (!ALLOWED_FORMATS.includes(asset.mimeType || "")) {
      showToast("Format non autorisé. Utilisez PDF, JPG ou PNG.");
      return null;
    }

    // Check file size
    if (asset.size && asset.size > MAX_FILE_SIZE) {
      showToast("Le fichier est trop volumineux (max 5MB).");
      return null;
    }

    return {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || "application/octet-stream",
      size: asset.size,
    };
  } catch (error) {
    console.error("Error picking document:", error);
    showToast("Erreur lors de la sélection du document.");
    return null;
  }
}

export async function uploadDocumentToSupabase(
  userId: string,
  documentUri: string,
  documentName: string,
  documentType: string,
  bucket: string = "pro-documents"
): Promise<{ url: string; path: string } | null> {
  try {
    const fileName = `${userId}/${Date.now()}-${documentName}`;

    let fileData: Uint8Array | null = null;

    try {
      const base64Content = await FileSystem.readAsStringAsync(documentUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileData = bytes;
    } catch (readErr) {
      console.error("Failed to read file as base64:", readErr);
      showToast("Erreur lors de la lecture du fichier.");
      return null;
    }

    if (!fileData) {
      console.error("No file data to upload");
      return null;
    }

    const { supabase } = await import("@/lib/supabase");

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileData, {
        contentType: documentType,
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error, {
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
        showToast("Erreur lors de l'upload du document.");
      }
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return { url: publicUrl.publicUrl, path: fileName };
  } catch (error) {
    console.error("Error uploading document:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("Network")) {
      showToast("Erreur réseau. Vérifiez votre connexion internet.");
    } else {
      showToast("Erreur lors de l'upload du document.");
    }
    return null;
  }
}
