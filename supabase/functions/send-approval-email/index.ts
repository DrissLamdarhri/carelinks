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
    const { email, name, specialty } = await req.json();

    const specialtyLabel: Record<string, string> = {
      nurse: "Infirmier",
      psychologist: "Psychologue",
      yoga_instructor: "Instructeur Yoga",
      physiotherapist: "Kinésithérapeute",
    };

    const specialtyText = specialtyLabel[specialty] || specialty;

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
        subject: "Votre compte professionnel a été approuvé! ✅",
        html: `
          <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #0D0870 0%, #5BB8D4 100%); color: white; padding: 30px 20px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 10px 10px; }
                .success-badge { display: inline-block; background: #DCFCE7; color: #16A34A; padding: 10px 20px; border-radius: 20px; font-weight: bold; margin: 15px 0; }
                .button { display: inline-block; background: #0D0870; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
                .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Bienvenue ${name}! 🎉</h1>
                  <p>Votre compte professionnel CareLinks a été approuvé</p>
                </div>
                <div class="content">
                  <h2>Excellente nouvelle!</h2>
                  <p>Votre candidature a été examinée et approuvée. Vous êtes maintenant un professionnel vérifié sur CareLinks.</p>
                  
                  <div class="success-badge">✓ Compte Approuvé - ${specialtyText}</div>
                  
                  <h3>Prochaines étapes:</h3>
                  <ul>
                    <li>Accédez à votre tableau de bord professionnel</li>
                    <li>Complétez votre profil si nécessaire</li>
                    <li>Commencez à recevoir des demandes de services</li>
                  </ul>
                  
                  <a href="${Deno.env.get("APP_URL")}/pro-dashboard" class="button">Accéder à mon tableau de bord</a>
                  
                  <p>Si vous avez des questions, contactez notre équipe support à <strong>support@carelinks.app</strong></p>
                  
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
