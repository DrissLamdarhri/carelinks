// ============================================================================
// KYC cross-check — what the OCR read on a pro's CIN and diploma, compared
// with each other and with profiles.full_name. Pure: no I/O, no framework.
//
// The SAME file lives in src/lib/kycCrossCheck.ts (web admin) and
// mobile-app/lib/kycCrossCheck.ts (mobile admin; mobile-app doesn't import
// shared/). Edit both together.
//
// An aid, never the decision: the admin checks the documents before deciding.
// ============================================================================

export type OcrStatus = "pending" | "processing" | "done" | "error";

export type CinData = {
  kind: "cin";
  nom: string | null;
  prenom: string | null;
  nom_arabe: string | null;
  prenom_arabe: string | null;
  numero_cin: string | null;
  date_naissance: string | null;
  lieu_naissance: string | null;
  date_expiration: string | null;
  type_document: "cin" | "diplome" | "autre";
  lisible: boolean;
  alertes: string[];
  /** Raw text (Tesseract readings) — searched for names when none was parsed. */
  texte_brut?: string | null;
  /** Full name as isolated from an unlabelled card (order unknown). */
  nom_complet?: string | null;
  /** Rule-based reading of raw OCR text: compare by searching, not by equality. */
  approximate?: boolean;
  /** Only the back of the card was read: no holder name (the names there are the parents'). */
  verso?: boolean;
};

export type DiplomaData = {
  kind: "diploma";
  nom_titulaire: string | null;
  nom_titulaire_arabe: string | null;
  intitule: string | null;
  etablissement: string | null;
  annee: string | null;
  numero_cin: string | null;
  type_document: "cin" | "diplome" | "autre";
  lisible: boolean;
  alertes: string[];
  texte_brut?: string | null;
  approximate?: boolean;
};

/** A row of public.pro_document_ocr (migrations 0056 + 0057). */
export type KycOcrRow = {
  document_id: string;
  professional_id: string;
  ocr_status: OcrStatus;
  ocr_data: CinData | DiplomaData | null;
  ocr_error: string | null;
  /** "tesseract.js …" (admin browser) or a Claude model id (edge function). */
  ocr_model?: string | null;
  requested_at: string;
  ocr_at: string | null;
};

export type KycDocument = { id: string; doc_type: string };

/** 'pending'/'processing' for longer than this = stuck (trigger not set up, crash). */
export const OCR_STALE_MS = 3 * 60 * 1000;

export const CROSS_CHECK_DISCLAIMER =
  "Aide à la vérification — contrôlez sur les documents avant de décider.";

// doc_type: the app writes 'cin' | 'diploma' | 'selfie'; the initial schema
// documented 'id' | 'diploma' | 'license'. Selfies are not analysed.
export function docKind(docType: string): "cin" | "diploma" | null {
  const t = docType.toLowerCase();
  if (t.includes("selfie")) return null;
  if (t === "id" || t.includes("cin") || t.includes("identit") || t.includes("national")) return "cin";
  return "diploma";
}

/** State to display for a document: no row yet = waiting for the trigger. */
export function ocrState(row: KycOcrRow | undefined): OcrStatus {
  return row?.ocr_status ?? "pending";
}

/**
 * Should the admin panel (which runs the OCR itself since 0057) analyse this
 * document now? Yes when it was never analysed, is waiting ('pending', set by
 * the upload trigger), is stuck in 'processing', or failed under the old
 * paid edge function (no key / no credit) — those are retried for free once.
 */
export function needsAnalysis(row: KycOcrRow | undefined, now = Date.now()): boolean {
  if (!row || row.ocr_status === "pending") return true;
  if (row.ocr_status === "processing") return now - new Date(row.requested_at).getTime() > OCR_STALE_MS;
  if (row.ocr_status === "error") return !(row.ocr_model ?? "").startsWith("tesseract");
  return false;
}

// ── Names ────────────────────────────────────────────────────────────────────
/** Lowercase, no accents/diacritics, letters only (Latin + Arabic), 1-letter tokens dropped. */
export function nameTokens(s: string | null | undefined): string[] {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "") // Latin accents, Arabic harakat
    .toLowerCase()
    .replace(/[^a-zء-ي]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 1);
}

export type NameMatch = "match" | "partial" | "mismatch" | "unknown";

/**
 * Order-independent ("Alami Sara" = "Sara Alami"): every token of the shorter
 * name must be in the longer one (a middle name on one side only is fine).
 */
export function compareNames(a: string | null | undefined, b: string | null | undefined): NameMatch {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return "unknown";
  const [short, long] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  const hits = short.filter((t) => long.has(t)).length;
  if (hits === short.length) return "match";
  return hits > 0 ? "partial" : "mismatch";
}

/** Same word allowing one OCR slip (a letter misread, dropped or added) on longer words. */
function closeEnough(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Is the profile name in a document's raw OCR text? For readings without a
 * parsed name (Tesseract). Never "mismatch": a name not found may just be
 * misread, so it's for the admin to check, not a red flag.
 */
export function nameInText(name: string | null | undefined, text: string | null | undefined): NameMatch {
  const want = nameTokens(name);
  const have = nameTokens(text);
  if (!want.length || !have.length) return "unknown";
  const hits = want.filter((w) => have.some((h) => closeEnough(w, h))).length;
  if (hits === want.length) return "match";
  return hits > 0 ? "partial" : "mismatch";
}

/**
 * Two CIN numbers as OCR read them. Moroccan CIN = 1–2 letters + up to 6
 * digits; OCR often drops the letter or reads it as "0" ("596274",
 * "0595274" for D595274), so the digits decide: equal → same, one digit
 * apart → close (probable misread), else different.
 */
export function compareCinNumbers(a: string, b: string): "same" | "close" | "different" {
  const split = (s: string) => {
    const t = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const letters = t.match(/^[A-Z]*/)![0];
    let digits = t.slice(letters.length).replace(/\D/g, "");
    if (!letters && digits.length === 7 && digits.startsWith("0")) digits = digits.slice(1); // letter read as 0
    return { letters, digits };
  };
  const x = split(a), y = split(b);
  if (!x.digits || !y.digits) return "different";
  const lettersAgree = !x.letters || !y.letters || x.letters === y.letters;
  if (x.digits === y.digits) return lettersAgree ? "same" : "close";
  if (x.digits.length !== y.digits.length) return "different";
  let diff = 0;
  for (let i = 0; i < x.digits.length; i++) if (x.digits[i] !== y.digits[i]) diff++;
  return diff === 1 && lettersAgree ? "close" : "different";
}

/** The more favourable of two comparisons (e.g. Latin vs Arabic script). */
const best = (...ms: NameMatch[]): NameMatch =>
  (["match", "partial", "mismatch"] as const).find((m) => ms.includes(m)) ?? "unknown";

const join = (...parts: (string | null | undefined)[]) =>
  parts.filter((p) => p && p.trim()).join(" ") || null;

// ── Cross-check ──────────────────────────────────────────────────────────────
/** "info": shown to the admin but neutral for the verdict (e.g. no CIN n° printed on the diploma). */
export type CheckStatus = "ok" | "warn" | "fail" | "unreadable" | "pending" | "info";

export type CheckKey =
  | "cin_read"
  | "diploma_read"
  | "name_profile_cin"
  | "name_profile_diploma"
  | "name_cin_diploma"
  | "cin_expiry"
  | "cin_number_diploma"
  | "diploma_specialty"
  | "alerts";

/** Why a check isn't ok, when there is no read/expected pair to show. */
export type CheckNote =
  | "missing"
  | "not_analyzed"
  | "processing"
  | "error"
  | "illegible"
  | "wrong_document"
  | "expired"
  | "not_found_on_document"
  /** The expected name wasn't found in the other document's text. */
  | "name_not_found"
  /** Only part of the expected name (e.g. the family name) was found. */
  | "name_partial"
  /** No name could be isolated on the CIN to compare with. */
  | "name_not_isolated"
  /** No CIN number readable on the diploma (many don't print it). */
  | "not_on_diploma"
  /** Almost the same (one character apart): probably a misread — compare by eye. */
  | "ocr_slip";

export type CheckItem = {
  key: CheckKey;
  status: CheckStatus;
  /** Value read on the document. */
  read?: string | null;
  /** Value it is compared with. */
  expected?: string | null;
  note?: CheckNote;
  /** Free text: the function's error, or the alerts. */
  detail?: string | null;
};

export type CrossCheckResult = {
  verdict: "ok" | "warn" | "fail" | "pending";
  checks: CheckItem[];
};

const SPECIALTY_KEYWORDS: Record<string, RegExp> = {
  nurse: /infirm|soins|nurs|تمريض|ممرض/i,
  physiotherapist: /kin[eé]|physio|r[ée][ée]ducation|ترويض|العلاج الطبيعي/i,
  psychologist: /psych|نفس/i,
  yoga_instructor: /yoga|يوغا/i,
};

const fromMatch = (m: NameMatch): CheckStatus =>
  m === "match" ? "ok" : m === "partial" ? "warn" : m === "mismatch" ? "fail" : "unreadable";

function readCheck(
  key: "cin_read" | "diploma_read",
  doc: KycDocument | undefined,
  row: KycOcrRow | undefined,
  expected: "cin" | "diplome",
): CheckItem {
  if (!doc) return { key, status: "fail", note: "missing" };
  const state = ocrState(row);
  if (state === "pending") return { key, status: "pending", note: "not_analyzed" };
  if (state === "processing") return { key, status: "pending", note: "processing" };
  if (state === "error" || !row?.ocr_data) return { key, status: "warn", note: "error", detail: row?.ocr_error };
  if (row.ocr_data.type_document !== expected) {
    return { key, status: "fail", note: "wrong_document", read: row.ocr_data.type_document, expected };
  }
  if (!row.ocr_data.lisible) return { key, status: "unreadable", note: "illegible" };
  return { key, status: "ok" };
}

/**
 * @param documents newest first (the first CIN / diploma is the current one)
 * @param ocrByDoc  pro_document_ocr rows keyed by document_id
 * @param today     YYYY-MM-DD, for the CIN expiry (defaults to now)
 */
export function crossCheckKyc(input: {
  fullName: string | null | undefined;
  specialty: string | null | undefined;
  documents: KycDocument[];
  ocrByDoc: Record<string, KycOcrRow | undefined>;
  today?: string;
}): CrossCheckResult {
  const { fullName, specialty, documents, ocrByDoc } = input;
  const today = input.today ?? new Date().toISOString().slice(0, 10);

  const cinDoc = documents.find((d) => docKind(d.doc_type) === "cin");
  const dipDoc = documents.find((d) => docKind(d.doc_type) === "diploma");
  const cinRow = cinDoc ? ocrByDoc[cinDoc.id] : undefined;
  const dipRow = dipDoc ? ocrByDoc[dipDoc.id] : undefined;

  const checks: CheckItem[] = [
    readCheck("cin_read", cinDoc, cinRow, "cin"),
    readCheck("diploma_read", dipDoc, dipRow, "diplome"),
  ];
  const cinUsable = checks[0].status === "ok" || checks[0].status === "unreadable";
  const dipUsable = checks[1].status === "ok" || checks[1].status === "unreadable";
  const cin = cinUsable && cinRow?.ocr_data?.kind === "cin" ? cinRow.ocr_data : null;
  const dip = dipUsable && dipRow?.ocr_data?.kind === "diploma" ? dipRow.ocr_data : null;

  const cinName = cin
    ? join(cin.prenom, cin.nom) ?? cin.nom_complet ?? join(cin.prenom_arabe, cin.nom_arabe)
    : null;
  const dipName = dip ? dip.nom_titulaire ?? dip.nom_titulaire_arabe : null;
  // Rule-based Tesseract readings: names are SEARCHED in the other document's
  // raw text (one OCR slip tolerated) instead of compared field to field.
  const approx = !!(cin?.approximate || dip?.approximate);
  // A difference only counts as a red flag when both documents read well;
  // on a poor reading it may be an OCR slip → "check it".
  const clearReading = !!(cin?.lisible && dip?.lisible);

  // Profile name searched in a document's raw text. Not found → "check it",
  // never a red flag (the profile name is typed by the pro, often abridged).
  const textCheck = (key: CheckKey, text: string | null | undefined): CheckItem => {
    const m = nameInText(fullName, text);
    return m === "match" ? { key, status: "ok", expected: fullName ?? null }
      : m === "unknown" ? { key, status: "unreadable", note: "illegible" }
      : { key, status: "warn", note: m === "partial" ? "name_partial" : "name_not_found", expected: fullName ?? null };
  };

  // CIN ↔ profiles.full_name — usually typed in Latin script, sometimes in Arabic
  if (cin && cinName && !cin.approximate) {
    const latin = join(cin.prenom, cin.nom);
    const arabic = join(cin.prenom_arabe, cin.nom_arabe);
    const m = best(compareNames(latin, fullName), compareNames(arabic, fullName));
    checks.push({ key: "name_profile_cin", status: fromMatch(m), read: latin ?? arabic, expected: fullName ?? null });
  } else if (cin?.verso) {
    checks.push({ key: "name_profile_cin", status: "unreadable", note: "name_not_isolated" });
  } else if (cin) {
    checks.push(textCheck("name_profile_cin", cin.texte_brut));
  }

  // Diploma ↔ profile, by raw text, when the holder name wasn't read reliably
  if (dip && (dip.approximate || !dipName)) checks.push(textCheck("name_profile_diploma", dip.texte_brut));

  // Name and first name on the CIN = those on the diploma
  if (cin && dip) {
    if (!approx && cinName && dipName) {
      const m = best(
        compareNames(dip.nom_titulaire, join(cin.prenom, cin.nom)),
        compareNames(dip.nom_titulaire_arabe, join(cin.prenom_arabe, cin.nom_arabe)),
      );
      checks.push({ key: "name_cin_diploma", status: fromMatch(m), read: dipName, expected: cinName });
    } else if (cinName) {
      const m = nameInText(cinName, join(dipName, dip.texte_brut));
      checks.push({
        key: "name_cin_diploma",
        status: m === "match" ? "ok"
          : m === "unknown" ? "unreadable"
          : m === "mismatch" && clearReading ? "fail" : "warn",
        read: dipName,
        expected: cinName,
        note: m === "match" ? undefined : m === "unknown" ? "illegible" : m === "partial" ? "name_partial" : "name_not_found",
      });
    } else {
      checks.push({ key: "name_cin_diploma", status: "unreadable", note: "name_not_isolated" });
    }
  }

  // CIN number on the CIN = the one printed on the diploma (when it is)
  if (cin?.numero_cin && dip) {
    const norm = (s: string) => s.replace(/[\s.-]+/g, "").toUpperCase();
    const want = norm(cin.numero_cin);
    if (dip.numero_cin) {
      const cmp = approx
        ? compareCinNumbers(dip.numero_cin, cin.numero_cin)
        : norm(dip.numero_cin) === want ? "same" : "different";
      checks.push({
        key: "cin_number_diploma",
        status: cmp === "same" ? "ok" : cmp === "close" || !clearReading ? "warn" : "fail",
        note: cmp === "close" ? "ocr_slip" : undefined,
        read: dip.numero_cin,
        expected: cin.numero_cin,
      });
    } else if (dip.texte_brut && norm(dip.texte_brut).includes(want)) {
      checks.push({ key: "cin_number_diploma", status: "ok", read: cin.numero_cin, expected: cin.numero_cin });
    } else {
      // Many diplomas don't print it: nothing to compare, nothing wrong
      checks.push({ key: "cin_number_diploma", status: "info", note: "not_on_diploma", expected: cin.numero_cin });
    }
  }

  // CIN still valid
  if (cin) {
    checks.push(!cin.date_expiration
      ? { key: "cin_expiry", status: "unreadable", note: "not_found_on_document" }
      : cin.date_expiration < today
        ? { key: "cin_expiry", status: "fail", note: "expired", read: cin.date_expiration }
        : { key: "cin_expiry", status: "ok", read: cin.date_expiration });
  }

  // Diploma matches the declared profession
  if (dip && specialty) {
    const text = join(dip.intitule, dip.etablissement, dip.texte_brut);
    const re = SPECIALTY_KEYWORDS[specialty];
    checks.push({
      key: "diploma_specialty",
      status: !text ? "unreadable" : re?.test(text) ? "ok" : "warn",
      read: dip.intitule,
      expected: specialty,
    });
  }

  // Alerts raised while reading (blur, signs of editing…)
  const alerts = [cin?.alertes, dip?.alertes].flatMap((a) => a ?? []);
  if (alerts.length) checks.push({ key: "alerts", status: "warn", detail: alerts.join(" · ") });

  const has = (s: CheckStatus) => checks.some((c) => c.status === s);
  const verdict = has("fail") ? "fail"
    : has("pending") ? "pending"
    : has("warn") || has("unreadable") ? "warn"
    : "ok";
  return { verdict, checks };
}
