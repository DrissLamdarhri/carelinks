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

/**
 * Care-type names are DATA: they are written to `bookings.care_type`, matched
 * against the `?care=` deep-link param, and can also arrive from
 * `public.services` at runtime — so the stored value stays French and only the
 * displayed label is translated. A name we don't recognise (anything an admin
 * adds to the services table later) falls through unchanged rather than being
 * dropped, which is why this is a lookup and not an exhaustive union.
 */
const CARE_TYPE_KEYS: Record<string, string> = {
  // nurse
  Pansement: "svc_dressing",
  Injection: "svc_injection",
  Perfusion: "svc_infusion",
  "Bilan sanguin": "svc_bloodtest",
  "Soins post-op": "focus_postop",
  "Sonde urinaire": "reg_svc_catheter",
  // physio
  "Rééducation motrice": "focus_motor",
  "Rééducation fonctionnelle": "care_functional_rehab",
  "Rééducation respiratoire": "focus_resp",
  "Massage thérapeutique": "focus_massage",
  "Mobilisation articulaire": "focus_mobil",
  "Drainage lymphatique": "focus_drainage",
  "Prévention des blessures": "care_injury_prevention",
  "Traitement anti-douleur": "reg_svc_pain",
  "Traitement de l'arthrose": "reg_svc_arthrosis",
  Traumatologie: "reg_svc_trauma",
};

export function careTypeLabel(name: string, t: (key: string) => string): string {
  const key = CARE_TYPE_KEYS[name];
  return key ? t(key) : name;
}

/**
 * Cancellation reasons the SYSTEM writes (as opposed to free text a human
 * typed). They are stored on `bookings.cancel_reason` and read back by a
 * different person than the one whose device wrote them — an admin cancels,
 * the patient reads — so the stored value is a fixed French sentinel and the
 * translation happens at display. Free-text reasons pass through untouched.
 */
export const CANCEL_REASON_ADMIN = "Annulée par l'administration";
export const CANCEL_REASON_NO_PRO = "Aucun professionnel disponible";

const CANCEL_REASON_KEYS: Record<string, string> = {
  [CANCEL_REASON_ADMIN]: "cancel_reason_admin",
  [CANCEL_REASON_NO_PRO]: "cancel_reason_no_pro",
};

export function cancelReasonLabel(reason: string, t: (key: string) => string): string {
  const key = CANCEL_REASON_KEYS[reason];
  return key ? t(key) : reason;
}

export function careLabel(
  b: { specialty?: string | null; care_type?: string | null },
  t: (key: string) => string
): string {
  if (b.care_type && b.care_type.trim()) return careTypeLabel(b.care_type, t);
  const key = b.specialty ? SPEC_LABEL[b.specialty] : undefined;
  return key ? t(key) : (b.specialty ?? "").replaceAll("_", " ");
}
