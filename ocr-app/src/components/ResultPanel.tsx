import { useState } from "react";

interface Props {
  /** Initial text; the panel keeps the user's edits. Remount (key) to reset. */
  text: string;
  confidence: number;
  fileName: string;
  onRestart: () => void;
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for non-secure contexts (plain HTTP on a LAN IP).
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("copy failed");
}

function confidenceLevel(c: number) {
  if (c >= 80) return "good";
  if (c >= 55) return "medium";
  return "low";
}

export function ResultPanel({ text: initialText, confidence, fileName, onRestart }: Props) {
  const [text, setText] = useState(initialText);
  const [feedback, setFeedback] = useState<string | null>(null);

  const flash = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2000);
  };

  const copy = () =>
    copyToClipboard(text).then(
      () => flash("Texte copié !"),
      () => flash("Copie impossible — sélectionnez le texte manuellement."),
    );

  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\.[^.]+$/, "") || "texte-ocr"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="result">
      <header>
        <h2>Texte extrait</h2>
        <span className={`confidence ${confidenceLevel(confidence)}`}>
          Confiance : {confidence} %
        </span>
      </header>
      {initialText === "" && (
        <p className="muted">
          Aucun texte détecté. Essayez une image plus nette ou une autre langue.
        </p>
      )}
      <textarea
        dir="auto"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        spellCheck={false}
        aria-label="Texte extrait (modifiable)"
      />
      <div className="actions">
        <button type="button" onClick={copy} disabled={!text}>
          Copier
        </button>
        <button type="button" onClick={download} disabled={!text}>
          Télécharger .txt
        </button>
        <button type="button" className="secondary" onClick={onRestart}>
          Recommencer
        </button>
        {feedback && <span className="muted" role="status">{feedback}</span>}
      </div>
    </section>
  );
}
