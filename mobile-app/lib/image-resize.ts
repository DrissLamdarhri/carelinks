import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Longest side of KYC photos sent to storage (and on to the OCR). */
const MAX_SIDE = 1600;

/**
 * Shrink a photo to MAX_SIDE px on its longest side (JPEG, 85 %) before
 * upload: phone photos are 4000+ px and several MB, which slows the upload and
 * the server-side OCR without making the text any more legible. PDFs and
 * small images are returned unchanged; on any failure the original is used.
 */
export async function shrinkImageForUpload(
  uri: string,
  mimeType: string,
): Promise<{ uri: string; mimeType: string }> {
  if (!mimeType.startsWith("image/")) return { uri, mimeType };
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    if (Math.max(original.width, original.height) <= MAX_SIDE) return { uri, mimeType };
    const resized = await ImageManipulator.manipulate(uri)
      .resize(original.width >= original.height ? { width: MAX_SIDE } : { height: MAX_SIDE })
      .renderAsync();
    const saved = await resized.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    return { uri: saved.uri, mimeType: "image/jpeg" };
  } catch (e) {
    console.warn("shrinkImageForUpload: keeping the original image", e);
    return { uri, mimeType };
  }
}
