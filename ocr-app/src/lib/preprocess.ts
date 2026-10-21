// Image clean-up before OCR. Tesseract reads dark text on a light, evenly lit
// background best, at roughly 300 DPI — so: grayscale, stronger contrast, and
// upscale small images (a phone thumbnail's letters are too few pixels tall).

/** Below this width the image is upscaled (capped at MAX_UPSCALE ×). */
const MIN_WIDTH = 1200;
const MAX_UPSCALE = 3;
/** Larger images are scaled down: slower OCR, no accuracy gain, memory risk. */
const MAX_SIDE = 4000;
/** -255..255; 0 = unchanged. */
const CONTRAST = 50;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de lire cette image (fichier corrompu ?)."));
    img.src = src;
  });
}

export function preprocessImage(img: HTMLImageElement): HTMLCanvasElement {
  const { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h) throw new Error("L'image est vide.");

  let scale = 1;
  if (w < MIN_WIDTH) scale = Math.min(MIN_WIDTH / w, MAX_UPSCALE);
  if (Math.max(w, h) * scale > MAX_SIDE) scale = MAX_SIDE / Math.max(w, h);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D indisponible dans ce navigateur.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  const factor = (259 * (CONTRAST + 255)) / (255 * (259 - CONTRAST));
  for (let i = 0; i < px.length; i += 4) {
    // Perceptual luminance (ITU-R BT.601), then contrast around mid-gray.
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const v = Math.max(0, Math.min(255, factor * (gray - 128) + 128));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
