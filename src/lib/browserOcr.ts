// ============================================================================
// Free KYC OCR in the admin's browser (Tesseract.js) — replaces the paid
// analyze-pro-document edge function since migration 0057. Downloads a
// document from the private `pro-documents` bucket with the admin's session,
// renders PDFs (pdf.js, first 2 pages), cleans each image up (grayscale,
// contrast, upscale), reads it in French + Arabic, then extracts the fields
// with kycOcrParse. Nothing leaves the browser except the downloads; the
// first run fetches Tesseract's engine + language data from a CDN (cached).
// tesseract.js and pdf.js are loaded on demand, not in the main bundle.
// ============================================================================
import { supabase } from "./supabase";
import { docKind, type CinData, type DiplomaData } from "./kycCrossCheck";
import { parseCin, parseDiploma, type OcrReading } from "./kycOcrParse";

export const BROWSER_OCR_MODEL = "tesseract.js 7 (fra+ara)";
const LANGS = "fra+ara";
const MAX_PDF_PAGES = 2;

function sniff(b: Uint8Array): "pdf" | "image" | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b[0] === 0xff && b[1] === 0xd8) return "image"; // JPEG
  if (b[0] === 0x89 && b[1] === 0x50) return "image"; // PNG
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "image"; // WebP
  return null;
}

// Tesseract reads dark text on a light, even background at ~300 DPI best:
// grayscale, stronger contrast, small photos upscaled, huge ones scaled down.
function preprocess(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  let scale = width < 1400 ? Math.min(1400 / width, 3) : 1;
  if (Math.max(width, height) * scale > 3500) scale = 3500 / Math.max(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  const contrast = 40;
  const f = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = Math.max(0, Math.min(255, f * (gray - 128) + 128));
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function imagePages(blob: Blob): Promise<HTMLCanvasElement[]> {
  const bitmap = await createImageBitmap(blob).catch(() => {
    throw new Error("Image illisible ou corrompue");
  });
  try {
    return [preprocess(bitmap, bitmap.width, bitmap.height)];
  } finally {
    bitmap.close();
  }
}

async function pdfPages(blob: Blob): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  try {
    const pages: HTMLCanvasElement[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PDF_PAGES); n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 2.5 }); // ~180 DPI for an A4 page
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
      pages.push(preprocess(canvas, canvas.width, canvas.height));
    }
    return pages;
  } finally {
    void pdf.destroy();
  }
}

/**
 * One Tesseract worker for a batch of documents. Always call terminate() —
 * a worker holds a Web Worker plus tens of MB of WASM and language data.
 */
export async function createKycOcrSession() {
  const { createWorker, OEM } = await import("tesseract.js");
  const worker = await createWorker(LANGS, OEM.LSTM_ONLY);

  return {
    async analyze(doc: { doc_type: string; storage_path: string }): Promise<CinData | DiplomaData> {
      const kind = docKind(doc.doc_type);
      if (!kind) throw new Error("Les selfies ne sont pas analysés");

      const { data: blob, error } = await supabase.storage.from("pro-documents").download(doc.storage_path);
      if (error || !blob) throw new Error(`Fichier introuvable dans le stockage : ${error?.message ?? doc.storage_path}`);
      const type = sniff(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
      if (!type) throw new Error("Format non pris en charge (attendu : PDF, JPEG, PNG ou WebP)");

      const pages = type === "pdf" ? await pdfPages(blob) : await imagePages(blob);
      const texts: string[] = [];
      const confidences: number[] = [];
      for (const page of pages) {
        const { data } = await worker.recognize(page);
        texts.push(data.text);
        confidences.push(data.confidence);
      }
      const reading: OcrReading = {
        text: texts.join("\n"),
        confidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
      };
      return kind === "cin" ? parseCin(reading) : parseDiploma(reading);
    },

    terminate: () => worker.terminate(),
  };
}
