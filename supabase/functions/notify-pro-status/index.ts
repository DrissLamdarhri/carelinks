// ============================================================================
// notify-pro-status — single source of truth for pro approval/rejection alerts.
// Called by BOTH admin panels (mobile app/admin/kyc.tsx + web KycModerationQueue)
// with just { proId, decision, reason? }. Runs with the service-role key so it
// can read the pro's contact details regardless of RLS, then fans out to:
//   1) in-app notification   2) email (Resend)   3) WhatsApp (Cloud API)
// Every channel is best-effort: a missing secret or a provider error never
// fails the call, so approving a pro always succeeds even before the email /
// WhatsApp providers are wired. Returns a per-channel status for debugging.
// ----------------------------------------------------------------------------
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (always present on Supabase).
// Optional — email:    RESEND_API_KEY, MAIL_FROM
// Optional — WhatsApp: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//                      WHATSAPP_TEMPLATE_APPROVED, WHATSAPP_TEMPLATE_REJECTED,
//                      WHATSAPP_TEMPLATE_LANG (default "fr")
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPECIALTY: Record<string, string> = {
  nurse: "Infirmier",
  psychologist: "Psychologue",
  yoga_instructor: "Instructeur Yoga",
  physiotherapist: "Kinésithérapeute",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { proId, decision, reason } = await req.json();
    if (!proId || (decision !== "approved" && decision !== "rejected")) {
      return json({ error: "proId and decision ('approved'|'rejected') are required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    // ── Look up the recipient (service role → bypasses RLS) ──────────────────
    const [profile] = await rest(`profiles?id=eq.${proId}&select=full_name,email,phone`).then((r) => r.json());
    const [pro] = await rest(`professionals?id=eq.${proId}&select=specialty`).then((r) => r.json());
    const name: string = profile?.full_name ?? "";
    const email: string | null = profile?.email ?? null;
    const phone: string | null = profile?.phone ?? null;
    const specialtyText = SPECIALTY[pro?.specialty] ?? pro?.specialty ?? "";

    const result: Record<string, string> = { notification: "skipped", email: "skipped", whatsapp: "skipped" };

    // ── 1) In-app notification ───────────────────────────────────────────────
    try {
      const r = await rest("notifications", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: proId,
          kind: "system",
          title: decision === "approved" ? "Compte approuvé ✅" : "Dossier à corriger",
          body:
            decision === "approved"
              ? "Votre dossier a été validé. Vous pouvez maintenant recevoir des demandes."
              : reason || "Votre dossier nécessite des corrections. Merci de re-soumettre vos documents.",
          payload: { decision },
        }),
      });
      result.notification = r.ok ? "sent" : `error: ${await r.text()}`;
    } catch (e) {
      result.notification = `error: ${e instanceof Error ? e.message : String(e)}`;
    }

    // ── 2) Email (Resend) ────────────────────────────────────────────────────
    const RESEND = Deno.env.get("RESEND_API_KEY");
    if (RESEND && email) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: Deno.env.get("MAIL_FROM") || "CareLink <onboarding@resend.dev>",
            to: email,
            subject:
              decision === "approved"
                ? "Votre compte professionnel a été approuvé ! ✅"
                : "Votre dossier CareLink nécessite une action",
            html: decision === "approved" ? approvedHtml(name, specialtyText) : rejectedHtml(name, reason),
          }),
        });
        result.email = r.ok ? "sent" : `error: ${await r.text()}`;
      } catch (e) {
        result.email = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    // ── 3) WhatsApp (Cloud API) — pre-approved template message ──────────────
    const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
    const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    if (WA_TOKEN && WA_PHONE_ID && phone) {
      try {
        const template =
          decision === "approved"
            ? Deno.env.get("WHATSAPP_TEMPLATE_APPROVED") || "pro_approved"
            : Deno.env.get("WHATSAPP_TEMPLATE_REJECTED") || "pro_rejected";
        const lang = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "fr";
        const to = phone.replace(/[^\d]/g, ""); // Cloud API wants digits only (E.164 without '+')
        const r = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: template,
              language: { code: lang },
              // Body variable {{1}} = the pro's name. Keep the template's body to
              // one variable so it matches the approved WhatsApp template.
              components: [{ type: "body", parameters: [{ type: "text", text: name || "professionnel" }] }],
            },
          }),
        });
        result.whatsapp = r.ok ? "sent" : `error: ${await r.text()}`;
      } catch (e) {
        result.whatsapp = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    return json({ success: true, result }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// ── Email templates ──────────────────────────────────────────────────────────
const shell = (inner: string) => `
<html><head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f6f5f0; margin:0; }
  .container { max-width: 600px; margin: 0 auto; padding: 24px; }
  .header { background: linear-gradient(135deg, #0D0870 0%, #5BB8D4 100%); color: white; padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center; }
  .content { background: #ffffff; padding: 28px 24px; border-radius: 0 0 16px 16px; }
  .badge { display: inline-block; padding: 10px 18px; border-radius: 999px; font-weight: 700; margin: 8px 0 16px; }
  .ok { background:#DCFCE7; color:#16A34A; } .warn { background:#FEF3C7; color:#B45309; }
  .button { display:inline-block; background:#0D0870; color:white; padding:12px 28px; border-radius:10px; text-decoration:none; font-weight:700; margin:16px 0; }
  .footer { margin-top:20px; padding-top:16px; border-top:1px solid #eee; font-size:12px; color:#999; text-align:center; }
</style></head><body><div class="container">${inner}</div></body></html>`;

const approvedHtml = (name: string, specialty: string) =>
  shell(`
    <div class="header"><h1>Bienvenue ${name} ! 🎉</h1><p>Votre compte professionnel CareLink est approuvé</p></div>
    <div class="content">
      <span class="badge ok">✓ Compte approuvé${specialty ? ` — ${specialty}` : ""}</span>
      <p>Votre dossier a été examiné et validé. Vous êtes maintenant un professionnel vérifié sur CareLink.</p>
      <h3>Prochaines étapes :</h3>
      <ul>
        <li>Ouvrez l'application et accédez à votre tableau de bord</li>
        <li>Passez en ligne pour recevoir des demandes</li>
        <li>Complétez votre RIB pour être payé (Revenus → Retrait)</li>
      </ul>
      <p>Une question ? Écrivez-nous à <strong>support@carelink.ma</strong></p>
      <div class="footer">© CareLink — Soins à domicile, Maroc.</div>
    </div>`);

const rejectedHtml = (name: string, reason?: string) =>
  shell(`
    <div class="header"><h1>Bonjour ${name}</h1><p>Votre dossier nécessite une action</p></div>
    <div class="content">
      <span class="badge warn">Dossier à corriger</span>
      <p>${reason || "Après examen, votre dossier ne peut pas encore être validé. Merci de vérifier et de re-soumettre vos documents (CIN, diplôme, licence)."}</p>
      <p>Rendez-vous dans l'application : <strong>Profil → Documents</strong> pour mettre à jour votre dossier.</p>
      <p>Besoin d'aide ? <strong>support@carelink.ma</strong></p>
      <div class="footer">© CareLink — Soins à domicile, Maroc.</div>
    </div>`);
