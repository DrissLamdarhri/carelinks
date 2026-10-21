import { useState } from "react";

interface Props {
  src: string;
  name: string;
  /** The grayscale/contrast image actually sent to Tesseract, once computed. */
  processedSrc: string | null;
}

export function ImagePreview({ src, name, processedSrc }: Props) {
  const [showProcessed, setShowProcessed] = useState(false);
  const shown = showProcessed && processedSrc ? processedSrc : src;

  return (
    <figure className="preview">
      <img src={shown} alt={`Aperçu : ${name}`} />
      <figcaption>
        <span className="muted" title={name}>{name}</span>
        {processedSrc && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={showProcessed}
              onChange={(e) => setShowProcessed(e.target.checked)}
            />
            Voir l'image prétraitée
          </label>
        )}
      </figcaption>
    </figure>
  );
}
