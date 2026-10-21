export const LANGUAGES = [
  { value: "fra", label: "Français" },
  { value: "eng", label: "Anglais" },
  { value: "ara", label: "Arabe" },
  { value: "fra+ara", label: "Français + Arabe" },
  { value: "fra+eng", label: "Français + Anglais" },
  { value: "fra+eng+ara", label: "Français + Anglais + Arabe" },
] as const;

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function LanguageSelect({ value, onChange, disabled }: Props) {
  return (
    <label className="field">
      Langue du texte
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
