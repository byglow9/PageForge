import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_NOTIFICATION_EMAIL = "contato@renovaturismo.com.br";

// Server-side allowlist: maps campaign identifier -> destination email.
// Never trust a client-supplied destination address.
const CAMPAIGN_RECIPIENTS: Record<string, string> = {
  "turquia-padre-leudo": "nayara@renovaturismo.com.br",
  "mexico-padre-leudo": "nayara@renovaturismo.com.br",
  "viagem áfrica do sul": "nayara@renovaturismo.com.br",
  "viagem turquia": "contato@renovaturismo.com.br",
  "viagem portugal": "contato@renovaturismo.com.br",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BodySchema = z.object({
  nome: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().min(5).max(20),
  campaign: z.string().trim().max(100).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { nome, email, telefone, campaign } = parsed.data;
    const campaignKey = campaign?.toLowerCase().trim() ?? "";
    const toEmail = CAMPAIGN_RECIPIENTS[campaignKey] ?? DEFAULT_NOTIFICATION_EMAIL;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store submission in database (service role bypasses RLS)
    const { error: dbError } = await supabase
      .from("contact_submissions")
      .insert({ nome, email, telefone });

    if (dbError) {
      console.error("Database insert error:", dbError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar dados." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send notification email via Resend (if API key is configured)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Renova Turismo <noreply@renovaturismo.com.br>",
          to: [toEmail],
          subject: `Novo contato - ${escapeHtml(campaign || "Viagem")}: ${escapeHtml(nome)}`,
          html: `
            <h2>Novo contato pelo site</h2>
            <p><strong>Campanha:</strong> ${escapeHtml(campaign || "—")}</p>
            <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
            <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
            <p><strong>Telefone:</strong> ${escapeHtml(telefone)}</p>
            <p><em>Enviado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</em></p>
          `,
        }),
      });

      if (!emailResponse.ok) {
        console.error("Email send error:", await emailResponse.text());
      }
    } else {
      console.log("RESEND_API_KEY not configured. Submission stored in database only.");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
