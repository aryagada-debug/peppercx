import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authSupa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await authSupa.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { mbr_entry_id, notes } = await req.json();
    const text = typeof notes === "string" ? notes.trim() : "";
    if (!text || text.length < 10) {
      return new Response(JSON.stringify({ summary: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Summarize the given MBR notes as 3-5 scannable bullet points. Format EACH bullet EXACTLY as: `* **Title:** body` where Title is 1-3 words (e.g., Performance, Risks, Wins, Next Steps, Sentiment) and body is one concise sentence (max ~25 words). Output ONLY the bullets separated by newlines. No preamble, no closing remarks, no extra markdown.",
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await aiRes.json();
    const summary: string = (result.choices?.[0]?.message?.content || "").trim();

    // Persist to mbr_entries.ai_summary if id provided
    if (mbr_entry_id && summary) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        await admin.from("mbr_entries").update({ ai_summary: summary }).eq("id", mbr_entry_id);
      } catch (e) {
        console.error("persist ai_summary failed", e);
      }
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mbr-summarize-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});