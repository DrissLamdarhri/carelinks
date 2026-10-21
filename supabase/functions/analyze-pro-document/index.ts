// ============================================================================
// analyze-pro-document — OCR of one KYC document (Moroccan CIN or diploma)
// with Claude vision, for the admin review screens. Called with
//   { documentId }                       ← pro_documents insert trigger (0056)
//   { type: "INSERT", record: { id } }   ← or a Database Webhook, same table
//   { documentId }                       ← admin panels ("Relancer l'analyse",
//                                           catch-up of stuck documents)
// The trigger / webhook authenticate with the `x-ocr-secret` header; any other
// caller must be signed in as an admin. Deploy with --no-verify-jwt (the
// trigger has no user JWT) — auth is checked here instead.
//
// Steps: read the pro_documents row → skip selfies → pro_document_ocr
// 'processing' → download storage_path from the private `pro-documents`
// bucket (service role) → Claude (image base64, or a "document" block for a
// PDF) → strict JSON → 'done' + ocr_data, or 'error' + ocr_error.
//
// The result is an AID for the admin (cross-checked client-side against
// profiles.full_name). It never approves or rejects anyone by itself.
// ----------------------------------------------------------------------------
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (always
//      present on Supabase) + ANTHROPIC_API_KEY (required)
//      + OCR_TRIGGER_SECRET (same value as the vault secret `ocr_trigger_secret`).
// Logs: Dashboard → Edge Functions → analyze-pro-document → Logs; every
//       failure is logged with the "[analyze-pro-document]" prefix.
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

const MODEL = "claude-sonnet-5-5";
const BUCKET = "pro-documents";
const LOG = "[analyze-pro-document]";

// Every header supabase-js 2.110 sends (see @supabase/supabase-js/cors) + ours.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, x-ocr-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Kind = "cin" | "diploma";

// doc_type: the app writes 'cin' | 'diploma' | 'selfie'; the initial schema
// documented 'id' | 'diploma' | 'license'. Older rows may hold a translated
// diploma title. Selfies aren't analysed.
function kindOf(docType: string): Kind | null {
  const t = docType.toLowerCase();
  if (t.includes("selfie")) return null;
  if (t === "id" || t.includes("cin") || t.includes("identit") || t.includes("national")) return "cin";
  return "diploma";
}

// Older uploads from the mobile app were stored as image/jpeg whatever the
// real format, so trust the bytes, not the stored content type.
function sniffMediaType(b: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  return null;
}

// ── Output schemas (strict JSON; null = absent or illegible, never guessed) ──
const str = { type: ["string", "null"] };
const common = {
  type_document: { type: "string", enum: ["cin", "diplome", "autre"] },
  lisible: { type: "boolean" },
  alertes: { type: "array", items: { type: "string" } },
};

const SCHEMAS: Record<Kind, Record<string, unknown>> = {
  cin: {
    type: "object",
    properties: {
      nom: str, prenom: str, nom_arabe: str, prenom_arabe: str,
      numero_cin: str, date_naissance: str, lieu_naissance: str, date_expiration: str,
      ...common,
    },
    required: [
      "nom", "prenom", "nom_arabe", "prenom_arabe", "numero_cin", "date_naissance",
      "lieu_naissance", "date_expiration", "type_document", "lisible", "alertes",
    ],
    additionalProperties: false,
  },
  diploma: {
    type: "object",
    properties: {
      nom_titulaire: str, nom_titulaire_arabe: str, intitule: str, etablissement: str,
      annee: str, numero_cin: str,
      ...common,
    },
    required: [
      "nom_titulaire", "nom_titulaire_arabe", "intitule", "etablissement", "annee",
      "numero_cin", "type_document", "lisible", "alertes",
    ],
    additionalProperties: false,
  },
};

const SYSTEM = `Tu assistes l'équipe de vérification (KYC) de CareLink, plateforme marocaine de soins à domicile. On te transmet un document envoyé par un professionnel de santé à son inscription : sa carte nationale d'identité électronique marocaine (CIN / CNIE, recto et/ou verso, en français et en arabe) ou son diplôme (infirmier, kinésithérapeute, psychologue, professeur de yoga…).

Règles :
- Recopie exactement ce qui est imprimé. N'invente rien, ne complète rien, ne corrige pas l'orthographe. Un champ absent, masqué ou illisible vaut null.
- Dates au format AAAA-MM-JJ ; « annee » au format AAAA.
- Noms en caractères latins dans nom / prenom / nom_titulaire, tels qu'imprimés ; l'écriture arabe dans les champs *_arabe s'ils figurent.
- numero_cin : le numéro de la CIN (ex. « AB123456 ») ; sur un diplôme, uniquement s'il y est imprimé.
- type_document : ce que le document est réellement, indépendamment de ce qui était attendu.
- lisible : false si le document est trop flou, coupé ou masqué pour être lu de manière fiable.
- alertes : en français, phrases courtes, uniquement ce qui doit alerter l'administrateur (photo floue ou coupée, document partiellement masqué, capture d'écran, photocopie de photocopie, incohérences de polices ou de dates pouvant suggérer une retouche, document qui n'est pas du type attendu). Liste vide si rien à signaler.
Réponds uniquement avec l'objet JSON.`;

// Keys pasted into the dashboard often carry a trailing newline/space or quotes.
const anthropicKey = () => (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim().replace(/^["']|["']$/g, "").trim();

// Enough to diagnose a bad paste without ever revealing the key.
function describeKey(key: string): string {
  const prefix = key.match(/^sk-ant-[a-z]+\d*-/)?.[0] ?? `${key.slice(0, 7)}…`;
  const hints: string[] = [`commence par « ${prefix} »`, `${key.length} caractères`];
  if (/[…]|\.\.\./.test(key)) hints.push("contient « … » : c'est la version tronquée de la liste, pas la clé complète");
  else if (key.length < 90) hints.push("trop courte : une clé complète fait ~108 caractères");
  if (prefix.startsWith("sk-ant-admin")) hints.push("c'est une clé Admin — il faut une clé API standard (sk-ant-api03-…)");
  if (/\s/.test(key)) hints.push("contient un espace");
  return hints.join(", ");
}

// Structured outputs already guarantee bare JSON; strip a ```json fence anyway
// in case the format option is ever dropped.
const cleanJson = (text: string) =>
  text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const rest = (path: string, init: RequestInit = {}) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

  const saveOcr = async (row: Record<string, unknown>) => {
    const r = await rest("pro_document_ocr?on_conflict=document_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error(`Enregistrement OCR impossible : ${await r.text()}`);
    const [saved] = await r.json();
    return saved;
  };

  let documentId: string | null = null;
  try {
    // ── Caller: trigger / webhook (shared secret) or a signed-in admin ───────
    const TRIGGER_SECRET = Deno.env.get("OCR_TRIGGER_SECRET");
    const fromTrigger = !!TRIGGER_SECRET && req.headers.get("x-ocr-secret") === TRIGGER_SECRET;
    if (!fromTrigger) {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: ANON_KEY, Authorization: req.headers.get("Authorization") ?? "" },
      });
      if (!userRes.ok) return json({ error: "Non authentifié" }, 401);
      const caller = await userRes.json();
      const [callerProfile] = await rest(`profiles?id=eq.${caller.id}&select=role`).then((r) => r.json());
      if (callerProfile?.role !== "admin") return json({ error: "Réservé aux administrateurs" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const candidate = body?.documentId ?? body?.record?.id;
    if (typeof candidate !== "string" || !/^[0-9a-f-]{36}$/i.test(candidate)) {
      return json({ error: "documentId requis" }, 400);
    }
    documentId = candidate;

    const [doc] = await rest(
      `pro_documents?id=eq.${documentId}&select=id,professional_id,doc_type,storage_path`,
    ).then((r) => r.json());
    if (!doc) return json({ error: "Document introuvable" }, 404);

    const kind = kindOf(doc.doc_type);
    if (!kind) return json({ success: true, skipped: "selfie" });

    if (!anthropicKey()) {
      const message = "ANTHROPIC_API_KEY n'est pas configurée sur la fonction";
      console.error(`${LOG} ${documentId}: ${message}`);
      const row = await saveOcr({
        document_id: doc.id, professional_id: doc.professional_id,
        ocr_status: "error", ocr_error: message, ocr_at: new Date().toISOString(),
      });
      return json({ success: false, row, error: message }, 500);
    }

    await saveOcr({
      document_id: doc.id, professional_id: doc.professional_id,
      ocr_status: "processing", ocr_error: null, requested_at: new Date().toISOString(),
    });

    try {
      const fileRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${doc.storage_path.split("/").map(encodeURIComponent).join("/")}`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      if (!fileRes.ok) throw new Error(`Fichier introuvable dans le stockage (HTTP ${fileRes.status}) : ${doc.storage_path}`);
      const bytes = new Uint8Array(await fileRes.arrayBuffer());
      const mediaType = sniffMediaType(bytes);
      if (!mediaType) throw new Error("Format de fichier non pris en charge (attendu : PDF, JPEG, PNG ou WebP)");
      const data = encodeBase64(bytes);

      const fileBlock = mediaType === "application/pdf"
        ? { type: "document" as const, source: { type: "base64" as const, media_type: mediaType, data } }
        : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data } };

      const client = new Anthropic({ apiKey: anthropicKey() });
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        output_config: { format: { type: "json_schema", schema: SCHEMAS[kind] } },
        system: SYSTEM,
        messages: [{
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: `Document attendu : ${kind === "cin" ? "carte nationale d'identité marocaine (CIN)" : "diplôme professionnel"}. Extrais les champs.`,
            },
          ],
        }],
      } as any);

      if (response.stop_reason === "refusal") throw new Error("L'analyse a été refusée par le modèle");
      if (response.stop_reason === "max_tokens") throw new Error("Réponse du modèle tronquée");
      const text = response.content.find((b: { type: string }) => b.type === "text") as { text: string } | undefined;
      if (!text) throw new Error("Réponse vide du modèle");

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(cleanJson(text.text));
      } catch {
        throw new Error(`Réponse du modèle non JSON : ${text.text.slice(0, 200)}`);
      }

      const row = await saveOcr({
        document_id: doc.id, professional_id: doc.professional_id,
        ocr_status: "done", ocr_data: { kind, ...parsed }, ocr_error: null,
        ocr_model: MODEL, ocr_at: new Date().toISOString(),
      });
      return json({ success: true, row });
    } catch (e) {
      let message = e instanceof Error ? e.message : String(e);
      if (e instanceof Anthropic.AuthenticationError) {
        message = `Clé ANTHROPIC_API_KEY refusée par Anthropic (la clé enregistrée ${describeKey(anthropicKey())}). ` +
          "Créez une clé sur console.anthropic.com → API Keys → Create Key, copiez-la en entier et remplacez-la dans Supabase → Edge Functions → Secrets.";
      } else if (e instanceof Anthropic.APIError && /credit balance/i.test(e.message)) {
        message = "Crédit Anthropic épuisé — ajoutez du crédit sur console.anthropic.com → Settings → Billing, puis relancez l'analyse.";
      } else if (e instanceof Anthropic.APIError) {
        message = `Erreur API Claude (${e.status ?? "réseau"}) : ${e.message}`;
      }
      console.error(`${LOG} ${doc.id} (${doc.doc_type}, pro ${doc.professional_id}) failed: ${message}`);
      const row = await saveOcr({
        document_id: doc.id, professional_id: doc.professional_id,
        ocr_status: "error", ocr_error: message, ocr_model: MODEL, ocr_at: new Date().toISOString(),
      });
      return json({ success: false, row, error: message });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG} ${documentId ?? "(no document)"}: ${message}`);
    return json({ error: message }, 500);
  }
});
