import { useCallback, useEffect, useRef, useState } from "react";
import { createWorker, OEM, type ImageLike, type Worker } from "tesseract.js";

export type OcrStatus = "idle" | "running" | "done" | "error";

export interface OcrProgress {
  /** Human-readable step, in French. */
  label: string;
  /** 0..1 for the current step. */
  value: number;
}

export interface OcrResult {
  /** Changes on every recognition, so consumers can reset local state. */
  id: number;
  text: string;
  /** Mean word confidence, 0..100. */
  confidence: number;
}

const STEP_LABELS: Record<string, string> = {
  "loading tesseract core": "Chargement du moteur OCR",
  "initializing tesseract": "Initialisation",
  "initialized tesseract": "Initialisation",
  "loading language traineddata": "Téléchargement des données de langue",
  "loading language traineddata (from cache)": "Chargement des données de langue",
  "loaded language traineddata": "Données de langue prêtes",
  "initializing api": "Préparation",
  "initialized api": "Préparation",
  "recognizing text": "Reconnaissance du texte",
};

/**
 * One Tesseract worker, created lazily for the requested language(s) and kept
 * for the next image. It is terminated when the language changes, after a
 * failure (its state is unknown), and when the component unmounts — a worker
 * holds a Web Worker plus ~10–40 MB of WASM and language data.
 */
export function useOcr() {
  const workerRef = useRef<{ worker: Worker; lang: string } | null>(null);
  const runRef = useRef(0);
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [progress, setProgress] = useState<OcrProgress>({ label: "", value: 0 });
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const terminate = useCallback(async () => {
    const current = workerRef.current;
    workerRef.current = null;
    if (current) await current.worker.terminate().catch(() => {});
  }, []);

  useEffect(() => () => void terminate(), [terminate]);

  const getWorker = useCallback(
    async (lang: string) => {
      if (workerRef.current?.lang === lang) return workerRef.current.worker;
      await terminate();
      const worker = await createWorker(lang, OEM.LSTM_ONLY, {
        logger: (m) =>
          setProgress({ label: STEP_LABELS[m.status] ?? m.status, value: m.progress ?? 0 }),
      });
      workerRef.current = { worker, lang };
      return worker;
    },
    [terminate],
  );

  const recognize = useCallback(
    async (image: ImageLike, lang: string) => {
      const run = ++runRef.current;
      setStatus("running");
      setError(null);
      setResult(null);
      setProgress({ label: "Démarrage", value: 0 });
      try {
        const worker = await getWorker(lang);
        const { data } = await worker.recognize(image);
        if (run !== runRef.current) return; // reset meanwhile
        setResult({ id: run, text: data.text.trim(), confidence: Math.round(data.confidence) });
        setStatus("done");
      } catch (e) {
        await terminate();
        if (run !== runRef.current) return;
        const detail = e instanceof Error ? e.message : String(e);
        setError(
          `La reconnaissance a échoué (${detail}). Vérifiez votre connexion : ` +
            "les données de langue sont téléchargées à la première utilisation.",
        );
        setStatus("error");
      }
    },
    [getWorker, terminate],
  );

  const reset = useCallback(() => {
    runRef.current++;
    setStatus("idle");
    setResult(null);
    setError(null);
    setProgress({ label: "", value: 0 });
  }, []);

  return { status, progress, result, error, recognize, reset };
}
