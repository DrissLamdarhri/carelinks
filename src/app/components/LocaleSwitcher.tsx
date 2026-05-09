import { Languages } from "lucide-react";
import { useI18n, Locale } from "../../lib/i18n";

const LABELS: Record<Locale, string> = { fr: "Français", ar: "العربية", dar: "Darija" };

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center gap-2 bg-white rounded-xl p-2">
      <Languages size={14} className="text-[#0D0870]" />
      <div className="flex gap-1">
        {(Object.keys(LABELS) as Locale[]).map((l) => (
          <button key={l} onClick={() => setLocale(l)}
            className={`px-2.5 py-1 rounded-lg text-[11px] ${locale === l ? "bg-[#0D0870] text-white" : "text-[#888780]"}`}
            style={{ fontWeight: 600 }}>
            {LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
