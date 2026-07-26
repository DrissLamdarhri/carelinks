import * as DocumentPicker from "expo-document-picker";
import { showToast } from "@/lib/toast";
import { tr } from "@/lib/i18n";

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

    if (!ALLOWED_FORMATS.includes(asset.mimeType || "")) {
      showToast(tr("format_not_allowed"));
      return null;
    }

    if (asset.size && asset.size > MAX_FILE_SIZE) {
      showToast(tr("file_too_large"));
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
    showToast(tr("doc_pick_error"));
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

    const formData = new FormData();
    formData.append("file", {
      uri: documentUri,
      name: documentName,
      type: documentType || "application/octet-stream",
    } as any);

    const { supabase } = await import("@/lib/supabase");

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
        showToast(tr("security_error_support"));
      } else if (error.message?.includes("Bucket not found")) {
        showToast(tr("bucket_missing_support"));
      } else if (error.message?.includes("Network")) {
        showToast(tr("network_error_check"));
      } else {
        showToast(tr("doc_upload_error"));
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
      showToast(tr("network_error_check"));
    } else {
      showToast(tr("doc_upload_error"));
    }
    return null;
  }
}
