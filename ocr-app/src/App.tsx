import { useEffect, useRef, useState } from "react";
import { ImagePreview } from "./components/ImagePreview";
import { LanguageSelect } from "./components/LanguageSelect";
import { ResultPanel } from "./components/ResultPanel";
import { UploadZone } from "./components/UploadZone";
import { WebcamCapture } from "./components/WebcamCapture";
import { useOcr } from "./hooks/useOcr";
import { loadImage, preprocessImage } from "./lib/preprocess";

interface SelectedImage {
  src: string;
  name: string;
  /** Object URLs must be revoked; webcam data URLs need not. */
  isObjectUrl: boolean;
}

export default function App() {
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);
  const [lang, setLang] = useState("fra");
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const ocr = useOcr();
  const running = ocr.status === "running";

  // Free the previous object URL whenever the image changes or on unmount.
  const imageRef = useRef(image);
  imageRef.current = image;
  useEffect(
    () => () => {
      if (imageRef.current?.isObjectUrl) URL.revokeObjectURL(imageRef.current.src);
    },
    [],
  );

  const selectImage = (next: SelectedImage) => {
    if (image?.isObjectUrl) URL.revokeObjectURL(image.src);
    setImage(next);
    setProcessedSrc(null);
    setInputError(null);
    setWebcamOpen(false);
    ocr.reset();
  };

  const runOcr = async () => {
    if (!image) return;
    setInputError(null);
    try {
      const canvas = preprocessImage(await loadImage(image.src));
      setProcessedSrc(canvas.toDataURL("image/png"));
      await ocr.recognize(canvas, lang);
    } catch (e) {
      setInputError(e instanceof Error ? e.message : String(e));
    }
  };

  const restart = () => {
    if (image?.isObjectUrl) URL.revokeObjectURL(image.src);
    setImage(null);
    setProcessedSrc(null);
    setInputError(null);
    ocr.reset();
  };

  const error = inputError ?? ocr.error;

  return (
    <main className="app">
      <header className="app-header">
        <h1>OCR dans le navigateur</h1>
        <p className="muted">
          Extraction de texte d'une image avec Tesseract — l'image ne quitte pas votre appareil.
        </p>
      </header>

      <div className="layout">
        <section className="panel">
          {webcamOpen ? (
            <WebcamCapture
              onCapture={(src) =>
                selectImage({ src, name: `capture-${Date.now()}.jpg`, isObjectUrl: false })
              }
              onCancel={() => setWebcamOpen(false)}
            />
          ) : image ? (
            <ImagePreview src={image.src} name={image.name} processedSrc={processedSrc} />
          ) : (
            <UploadZone
              disabled={running}
              onError={setInputError}
              onFile={(file) =>
                selectImage({ src: URL.createObjectURL(file), name: file.name, isObjectUrl: true })
              }
            />
          )}

          <div className="controls">
            <LanguageSelect value={lang} onChange={setLang} disabled={running} />
            <div className="actions">
              {!webcamOpen && (
                <button
                  type="button"
                  className="secondary"
                  disabled={running}
                  onClick={() => setWebcamOpen(true)}
                >
                  Utiliser la webcam
                </button>
              )}
              {image && !webcamOpen && (
                <>
                  <button type="button" className="secondary" disabled={running} onClick={restart}>
                    Changer d'image
                  </button>
                  <button type="button" disabled={running} onClick={runOcr}>
                    {running ? "Analyse…" : "Extraire le texte"}
                  </button>
                </>
              )}
            </div>
          </div>

          {running && (
            <div className="progress">
              <div className="progress-label">
                <span>{ocr.progress.label}</span>
                <span>{Math.round(ocr.progress.value * 100)} %</span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(ocr.progress.value * 100)}
                aria-label={ocr.progress.label}
              >
                <div
                  className="progress-bar"
                  style={{ width: `${Math.round(ocr.progress.value * 100)}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="panel">
          {ocr.result ? (
            <ResultPanel
              key={ocr.result.id}
              text={ocr.result.text}
              confidence={ocr.result.confidence}
              fileName={image?.name ?? "texte-ocr"}
              onRestart={restart}
            />
          ) : (
            <div className="placeholder muted">
              {running
                ? "Reconnaissance en cours…"
                : "Le texte extrait apparaîtra ici, modifiable avant copie ou téléchargement."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
