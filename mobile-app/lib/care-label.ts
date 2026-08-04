// Shared "what is this booking actually for" label — prefers the specific
// care the patient picked (0050, e.g. "Pansement" / "Injection IM") over the
// coarse specialty ("Soins infirmiers"), which used to be the only thing any
// screen could show (patient home, pro's demand feed/missions, tracking).
export const SPEC_LABEL: Record<string, string> = {
  nurse: "spec_nurse",
  physiotherapist: "spec_physio",
  psychologist: "spec_psy",
  yoga_instructor: "spec_yoga",
};

export function careLabel(
  b: { specialty?: string | null; care_type?: string | null },
  t: (key: string) => string
): string {
  if (b.care_type && b.care_type.trim()) return b.care_type;
  const key = b.specialty ? SPEC_LABEL[b.specialty] : undefined;
  return key ? t(key) : (b.specialty ?? "").replaceAll("_", " ");
}
