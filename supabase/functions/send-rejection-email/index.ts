import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name, reason } = await req.json();

    // Send email using a service (e.g., Resend)
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "admin@carelinks.app",
        to: email,
        subject: "Concernant votre candidature CareLinks",
        html: `
          <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #0D0870 0%, #5BB8D4 100%); color: white; padding: 30px 20px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 10px 10px; }
                .alert-badge { display: inline-block; background: #FDE8E8; color: #E24B4A; padding: 10px 20px; border-radius: 20px; font-weight: bold; margin: 15px 0; }
                .reason-box { background: white; border-left: 4px solid #E24B4A; padding: 15px; margin: 20px 0; }
                .button { display: inline-block; background: #0D0870; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
                .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Mise à jour concernant votre candidature</h1>
                  <p>Équipe CareLinks</p>
                </div>
                <div class="content">
                  <h2>Bonjour ${name},</h2>
                  <p>Merci d'avoir postulé en tant que professionnel sur CareLinks.</p>
                  
                  <div class="alert-badge">⚠ Candidature non approuvée</div>
                  
                  <h3>Motif:</h3>
                  <div class="reason-box">
                    <p><strong>${reason}</strong></p>
                  </div>
                  
                  <h3>Que faire maintenant?</h3>
                  <ul>
                    <li>Vérifiez que tous les documents requis ont été fournis</li>
                    <li>Assurez-vous que les informations sont correctes et à jour</li>
                    <li>Vous pouvez réessayer de candidater après correction</li>
                  </ul>
                  
                  <p>Si vous avez des questions ou souhaitez contester cette décision, contactez notre équipe support:</p>
                  <p><strong>Email:</strong> support@carelinks.app<br><strong>Tél:</strong> +212 (0)5 XX XX XX XX</p>
                  
                  <div class="footer">
                    <p>© 2024 CareLinks. Tous droits réservés.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Email sending failed:", error);
      return new Response(
        JSON.stringify({ success: false, error: error }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
