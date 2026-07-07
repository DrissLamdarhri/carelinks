import * as DocumentPicker from "expo-document-picker";
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
    // Optionally resize large images to avoid timeouts
    let uploadUri = documentUri;
    if (documentType.startsWith("image/")) {
      try {
        const ImageManipulator = await import("expo-image-manipulator");
        if (ImageManipulator && ImageManipulator.manipulateAsync) {
          const manipResult = await ImageManipulator.manipulateAsync(uploadUri, [{ resize: { width: 1280 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
          if (manipResult && manipResult.uri) uploadUri = manipResult.uri;
        }
      } catch (manipErr) {
        console.warn("ImageManipulator not available or resize failed, continuing with original file:", manipErr);
      }
    }

    const fileName = `${userId}/${Date.now()}-${documentName}`;

    const formData = new FormData();
    formData.append("file", {
      uri: uploadUri,
      name: fileName.split("/").pop(),
      type: documentType || "application/octet-stream",
    } as any);

    const { supabase } = await import("@/lib/supabase");

    // Use the storage-js helper; passing FormData works on React Native via fetch
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, formData as any, {
        contentType: documentType,
        upsert: true,
      } as any);

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
