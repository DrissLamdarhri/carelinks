import { useRef, useState, type DragEvent } from "react";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 15 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) {
    return `Format non pris en charge (${file.type || "inconnu"}). Utilisez JPG, PNG ou WEBP.`;
  }
  if (file.size > MAX_BYTES) return "Image trop lourde (15 Mo maximum).";
  return null;
}

interface Props {
  onFile: (file: File) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function UploadZone({ onFile, onError, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) onError(problem);
    else onFile(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handle(e.dataTransfer.files);
  };

  return (
    <div
      className={`upload-zone${dragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <p>Glissez-déposez une image ici</p>
      <p className="muted">JPG, PNG ou WEBP — 15 Mo max.</p>
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>
        Choisir un fichier
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        hidden
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = ""; // allow re-picking the same file
        }}
      />
    </div>
  );
}
