// ============================================================================
// Turns the raw text Tesseract read on a KYC document into the CinData /
// DiplomaData shape the cross-check uses. Pure (no DOM), rule-based, and
// deliberately conservative: a field it isn't sure about stays null. Results
// are flagged `approximate`: the cross-check then searches names in the raw
// text (texte_brut) and tolerates one misread digit instead of trusting an
// exact field-to-field equality.
//
// Tuned on real readings: a CNIE verso ("N° 596274", "jusqu'au 09102026",
// "Fils de …"), a Moroccan university licence ("L'étudiant(e) : … LAMDARHRI",
// "CIN : 0595274", "Né(e) le : 27 mars 2003").
// ============================================================================
import type { CinData, DiplomaData } from "./kycCrossCheck";

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
const toLatinDigits = (s: string) =>
  s.replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10));

const lines = (text: string) =>
  toLatinDigits(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};
const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function isoDate(d: number, mo: number, y: number): string | null {
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Dates as OCR returns them → YYYY-MM-DD: "05/07/2031", "12.03.1991",
 * "09.102020" (lost separator), "09102026" (none at all), "2025/06/30",
 * "27 mars 2003".
 */
function datesIn(line: string): string[] {
  const out: string[] = [];
  const push = (v: string | null) => v && out.push(v);
  for (const m of line.matchAll(/\b(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]?\s*((?:19|20)\d{2})\b/g)) {
    push(isoDate(+m[1], +m[2], +m[3]));
  }
  for (const m of line.matchAll(/\b(\d{2})(\d{2})((?:19|20)\d{2})\b/g)) push(isoDate(+m[1], +m[2], +m[3]));
  for (const m of line.matchAll(/\b((?:19|20)\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})\b/g)) {
    push(isoDate(+m[3], +m[2], +m[1]));
  }
  for (const m of stripAccents(line).toLowerCase().matchAll(/\b(\d{1,2})\s+([a-z]+)\s+((?:19|20)\d{2})\b/g)) {
    if (MONTHS[m[2]]) push(isoDate(+m[1], MONTHS[m[2]], +m[3]));
  }
  return out;
}

// Not "Royaume du Maroc": state diplomas carry it too. The verso of a CNIE
// has no "carte nationale" but "Fils de …" and the civil-status number.
const CIN_MARKERS = /carte\s+nationale|identit[ée]\s+[ée]lectronique|fils\s*de|n[°o]\s*[ée]tat\s+civil|البطاقة\s*الوطنية|للتعريف|رقم\s*الحالة\s*المدنية/i;
const CIN_VERSO = /fils\s*de|adresse|n[°o]\s*[ée]tat\s+civil|العنوان|رقم\s*الحالة\s*المدنية/i;
const DIPLOMA_MARKERS = /dipl[oô]m|licence|master|doctorat|brevet|certificat|attestation\s+de\s+r[ée]ussite|\bDUT\b|\bBTS\b|شهادة|دبلوم|الإجازة/i;
const EXPIRY_CONTEXT = /valable|validit|expir|jusqu|صالحة|صلاحية/i;
const BIRTH_CONTEXT = /n[ée]\(?e?\)?\s+le|naissance|birth|ازداد|الازدياد|مزداد|المزداد|تاريخ\s*الولادة/i;
const CIN_NUMBER = /\b([A-Z]{1,2})\s?(\d{4,7})\b/g;
const CIN_NUMBER_CONTEXT = /\bC\.?\s?I\.?\s?N\b|carte\s+nationale|n[°o]\s*(de\s+)?(la\s+)?(cin|carte)|ب\.?\s?ت\.?\s?و|بطاقة\s*التعريف|رقم\s*البطاقة/i;

/** "D595274", "AB 123456" anywhere in the text. */
function cinNumbers(text: string): string[] {
  return [...toLatinDigits(text).toUpperCase().matchAll(CIN_NUMBER)]
    .map((m) => `${m[1]}${m[2]}`)
    .filter((n) => n.length >= 6 && n.length <= 8);
}

/**
 * A number printed after a label ("N° 596274" on a CNIE verso, "CIN : 0595274"
 * on a diploma). OCR often drops the letter or reads it as 0, so a bare 5–8
 * digit number is accepted here — only because the label vouches for it.
 */
function labelledNumber(line: string, label: RegExp): string | null {
  const at = line.search(label);
  if (at < 0) return null;
  const after = toLatinDigits(line.slice(at)).toUpperCase();
  const m = after.match(/[:°O.\s]\s*([A-Z]{0,2}\s?\d{5,8})\b/);
  return m ? m[1].replace(/\s+/g, "") : null;
}

// Words of a CNIE / diploma that are never part of a person's name
const NOT_NAME_WORDS = new Set([
  "ROYAUME", "MAROC", "CARTE", "NATIONALE", "NATIONAL", "D", "DE", "DU", "DES", "LA", "LE", "L", "A", "AU", "ET",
  "IDENTITE", "ELECTRONIQUE", "NEE", "NE", "VALABLE", "JUSQU", "SEXE", "NATIONALITE", "MAROCAINE",
  "MAROCAIN", "FILS", "FILLE", "ADRESSE", "CAN", "CIN", "N", "NO", "DATE", "LIEU", "EXPIRATION", "SIGNATURE",
  "M", "F", "ETAT", "CIVIL", "NAISSANCE", "VALIDITE", "TITULAIRE", "NOM", "PRENOM", "PRENOMS", "KINGDOM",
  "MOROCCO", "IDENTITY", "CARD", "BEN", "BENT", "IMM",
]);
const LABELLED_NAME = /^(nom|pr[ée]noms?)\s*[:.]?\s+([A-Za-zÀ-ÿ' -]{2,40})$/i;

/** A line that is only a name: Latin capitals, no digit, no card wording. */
function isNameLine(line: string): boolean {
  const l = stripAccents(line).replace(/[’`]/g, "'").trim();
  if (!/^[A-Z][A-Z' -]{1,34}$/.test(l)) return false;
  const words = l.split(/[\s'-]+/).filter(Boolean);
  return words.some((w) => w.length >= 2) && words.every((w) => !NOT_NAME_WORDS.has(w));
}

/**
 * Name on a CIN: "Nom : X / Prénom : Y" on older cards; on the CNIE recto,
 * the capital-letter lines (given name, family name) printed above "Née le".
 * The verso carries no holder name (only the parents').
 */
function cinName(ls: string[], verso: boolean): { nom: string | null; prenom: string | null; nom_complet: string | null } {
  let nom: string | null = null;
  let prenom: string | null = null;
  for (const l of ls) {
    const m = l.match(LABELLED_NAME);
    if (!m) continue;
    if (/^nom/i.test(m[1])) nom ??= m[2].trim();
    else prenom ??= m[2].trim();
  }
  if (nom || prenom) return { nom, prenom, nom_complet: [prenom, nom].filter(Boolean).join(" ") };
  if (verso) return { nom: null, prenom: null, nom_complet: null };
  const birthAt = ls.findIndex((l) => BIRTH_CONTEXT.test(l));
  const zone = birthAt > 0 ? ls.slice(0, birthAt) : ls;
  const names = zone.filter(isNameLine).slice(-2); // the two lines just above "Née le"
  return { nom: null, prenom: null, nom_complet: names.length ? names.join(" ") : null };
}

const cleanLatinName = (s: string) =>
  s.replace(/^(?:M\.|Mr\.?|Mme\.?|Mlle\.?|Monsieur|Madame|Mademoiselle)\s+/i, "")
    .split(/,|\bn[ée]\(?e?\)?\s+le\b|\bC\.?\s?I\.?\s?N\b|[؀-ۿ]/i)[0]
    .replace(/[^A-Za-zÀ-ÿ' -]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !NOT_NAME_WORDS.has(stripAccents(w).toUpperCase()))
    .join(" ")
    .trim();

/**
 * Holder of a diploma: "décerné à Mme Sara ALAMI", "L'étudiant(e) : …",
 * "Nom et prénom : …", "Titulaire : …". Latin and Arabic separately.
 */
function diplomaHolder(ls: string[]): { latin: string | null; arabic: string | null } {
  const patterns: [RegExp, number][] = [
    [/(?:d[ée]cern[ée]e?|d[ée]livr[ée]e?|attribu[ée]e?|conf[ée]r[ée]e?)\s+(?:à|a)\s+(.+)$/i, 2],
    [/(?:l['’]\s?)?[ée]tudiant\s*\(?e?\)?\s*[:.]\s*(.+)$/i, 1],
    [/^(?:nom\s+et\s+pr[ée]noms?|nom\s+complet|titulaire|candidat\s*\(?e?\)?)\s*[:.]\s*(.+)$/i, 2],
    [/^(?:M\.|Mr\.?|Mme\.?|Mlle\.?|Monsieur|Madame|Mademoiselle)\s+(.+)$/, 2],
  ];
  let latin: string | null = null;
  for (const l of ls) {
    for (const [re, minWords] of patterns) {
      const m = l.match(re);
      if (!m) continue;
      const name = cleanLatinName(m[1]);
      // An explicit "Étudiant(e) :" label vouches for a single readable word
      // (OCR often garbles the first name next to it).
      if (name.split(" ").filter((w) => w.length >= 3).length >= minWords) {
        latin = name.slice(0, 60);
        break;
      }
    }
    if (latin) break;
  }
  // Arabic: "الطالب(ة) : ادريس لمدغري", "السيد(ة) …", "لفائدة …"
  let arabic: string | null = null;
  for (const l of ls) {
    const m = l.match(/(?:الطالب|السيد|لفائدة|المترشح)\S*\s*[:：]?\s*([ء-ي]+(?:\s+[ء-ي]+){1,3})/);
    if (m) {
      arabic = m[1].trim();
      break;
    }
  }
  return { latin, arabic };
}

/** Drop OCR crumbs around a phrase ("ut LICENCE ul" → "LICENCE", "| TM 0." …). */
function tidy(s: string): string {
  const words = s.replace(/[|‎‏]/g, " ").split(/\s+/).filter(Boolean);
  const crumb = (w: string) => w.replace(/[^A-Za-zÀ-ÿء-ي]/g, "").length < 3;
  while (words.length && crumb(words[0])) words.shift();
  while (words.length && crumb(words[words.length - 1])) words.pop();
  return words.join(" ").slice(0, 160);
}

function detectType(text: string): "cin" | "diplome" | null {
  const cin = CIN_MARKERS.test(text);
  const dip = DIPLOMA_MARKERS.test(text);
  if (cin && !dip) return "cin";
  if (dip && !cin) return "diplome";
  return null;
}

export type OcrReading = { text: string; confidence: number };

function common(reading: OcrReading, expected: "cin" | "diplome"): Pick<CinData, "type_document" | "lisible" | "alertes" | "texte_brut"> {
  const alertes: string[] = [];
  const detected = detectType(reading.text);
  if (!detected) alertes.push("Type de document non reconnu automatiquement — vérifiez qu'il s'agit bien du bon document.");
  const letters = (reading.text.match(/[A-Za-zء-ي]/g) ?? []).length;
  const lisible = reading.confidence >= 45 && letters >= 30;
  if (lisible && reading.confidence < 65) {
    alertes.push(`Lecture automatique peu fiable (confiance ${Math.round(reading.confidence)} %) — vérifiez sur le document.`);
  }
  return {
    // Unrecognised → assume the expected type rather than flag a wrong document
    type_document: detected ?? expected,
    lisible,
    alertes,
    texte_brut: reading.text.trim() || null,
  };
}

export function parseCin(reading: OcrReading, today = new Date().toISOString().slice(0, 10)): CinData {
  const ls = lines(reading.text);
  const verso = CIN_VERSO.test(reading.text) && !BIRTH_CONTEXT.test(reading.text);
  let birth: string | null = null;
  const expiries: string[] = [];
  const all: string[] = [];
  ls.forEach((line, i) => {
    // A label is often on the line above its date
    const context = `${ls[i - 1] ?? ""} ${line}`;
    for (const d of datesIn(line)) {
      all.push(d);
      if (EXPIRY_CONTEXT.test(context)) expiries.push(d);
      else if (!birth && BIRTH_CONTEXT.test(context)) birth = d;
    }
  });
  // The same "valable jusqu'au" date is often read twice, once badly
  // ("09.102020" for 09.10.2026): keep the latest, so an OCR slip can't make
  // a valid card look expired.
  let expiry: string | null = expiries.sort().at(-1) ?? null;
  // No labels read: the oldest plausible date is the birth date, the latest
  // one after it the expiry (a CNIE is valid 10 years).
  const sorted = [...new Set(all)].sort();
  const adultYear = Number(today.slice(0, 4)) - 16;
  if (!birth && !verso) birth = sorted.find((d) => Number(d.slice(0, 4)) <= adultYear) ?? null;
  if (!expiry) {
    const last = sorted.at(-1);
    if (last && last !== birth && Number(last.slice(0, 4)) > adultYear) expiry = last;
  }

  // "N° 596274" (verso), else a letter+digits number anywhere (recto)
  const labelled = ls.map((l) => labelledNumber(l, /\bN[°o]\s*(?!\s*[ée]tat)/i)).find(Boolean) ?? null;
  const numero_cin = cinNumbers(reading.text)[0] ?? labelled;

  const base = common(reading, "cin");
  if (verso) {
    base.alertes.unshift(
      "Seul le verso de la CIN semble lisible : le nom, le prénom et la date de naissance figurent au recto — demandez le recto au professionnel.",
    );
  }
  return {
    kind: "cin",
    ...cinName(ls, verso),
    approximate: true,
    verso,
    nom_arabe: null,
    prenom_arabe: null,
    numero_cin,
    date_naissance: birth,
    lieu_naissance: null,
    date_expiration: expiry,
    ...base,
  };
}

export function parseDiploma(reading: OcrReading, today = new Date().toISOString().slice(0, 10)): DiplomaData {
  const ls = lines(reading.text);
  const intitule =
    ls.find((l) => /^\W*\w{0,3}\W*(licence|master|doctorat|dipl[oô]me|brevet|DUT|BTS)\b/i.test(l)) ??
    ls.find((l) => DIPLOMA_MARKERS.test(l)) ?? null;
  // French wording first: it reads far better than the Arabic line
  const SCHOOL_LATIN = /(institut|universit[ée]|[ée]cole|facult[ée]|ISPITS|IFCS|IFIAP|centre\s+de\s+formation)[^|؀-ۿ]*/i;
  const schoolLine = ls.find((l) => SCHOOL_LATIN.test(l));
  const etablissement = schoolLine
    ? schoolLine.match(SCHOOL_LATIN)![0]
    : ls.find((l) => /المعهد|جامعة|كلية|مدرسة/.test(l)) ?? null;
  const thisYear = Number(today.slice(0, 4));
  const years = [...toLatinDigits(reading.text).matchAll(/\b(19[5-9]\d|20\d{2})\b/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y <= thisYear);
  // Only a CIN number printed next to a CIN label — any other code would
  // produce a false "different CIN number" alarm.
  const cinLine = ls.find((l) => CIN_NUMBER_CONTEXT.test(l));
  const numero_cin = cinLine
    ? cinNumbers(cinLine)[0] ?? labelledNumber(cinLine, CIN_NUMBER_CONTEXT)
    : null;
  const holder = diplomaHolder(ls);

  return {
    kind: "diploma",
    approximate: true,
    nom_titulaire: holder.latin,
    nom_titulaire_arabe: holder.arabic,
    intitule: intitule ? tidy(intitule) : null,
    etablissement: etablissement ? tidy(etablissement) : null,
    annee: years.length ? String(Math.max(...years)) : null,
    numero_cin,
    ...common(reading, "diplome"),
  };
}
