import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const MODEL = "google/gemini-2.5-flash";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const company_name = String(body?.company_name || "").trim();
    const website_hint = String(body?.website || "").trim();
    if (!company_name || company_name.length > 200) {
      return json({ error: "company_name is required" }, 400);
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const prompt = `You are researching a company for a sales handover.
Company: ${company_name}${website_hint ? `\nKnown website (hint): ${website_hint}` : ""}

Return concise, factual information as strict JSON matching this schema:
{
  "website": "official primary website URL (https://...)",
  "industry_guess": "one-line industry / sector",
  "what_they_do": "1-2 sentence description of what the company does",
  "products": ["short bullet", "short bullet", "..."]
}

Rules:
- If you are not confident about a field, return an empty string or empty array.
- No commentary, no markdown, only JSON.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You return strict JSON only, no prose." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: `AI gateway ${resp.status}: ${t.slice(0, 300)}` }, 502);
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    return json({
      website: typeof parsed.website === "string" ? parsed.website : "",
      industry_guess: typeof parsed.industry_guess === "string" ? parsed.industry_guess : "",
      what_they_do: typeof parsed.what_they_do === "string" ? parsed.what_they_do : "",
      products: Array.isArray(parsed.products) ? parsed.products.filter((p: any) => typeof p === "string").slice(0, 12) : [],
    }, 200);
  } catch (err) {
    return json({ error: (err as Error).message || String(err) }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}