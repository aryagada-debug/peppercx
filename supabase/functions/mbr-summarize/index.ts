import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require an authenticated caller — this fn burns AI credits.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims, error: claimErr } = await supa.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Transcript is too short or missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an MBR (Monthly Business Review) meeting analyst. Given a meeting transcript, produce:
1. A concise summary (3-5 bullet points) of key discussion topics, decisions, and outcomes.
2. Actionable to-do items with owner assignments and suggested deadlines.

Return a JSON object with this exact structure:
{
  "summary": "Concise bullet-point summary of the MBR",
  "actionItems": [
    {"task": "description", "owner": "person name", "deadline": "suggested date or timeframe", "done": false}
  ]
}`,
          },
          {
            role: "user",
            content: `Here is the MBR meeting transcript:\n\n${transcript}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_mbr_summary",
              description: "Extract structured MBR summary and action items from transcript",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "Concise bullet-point summary of the MBR meeting" },
                  actionItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        task: { type: "string" },
                        owner: { type: "string" },
                        deadline: { type: "string" },
                        done: { type: "boolean" },
                      },
                      required: ["task", "owner", "deadline", "done"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "actionItems"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_mbr_summary" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse content directly
    const content = result.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ summary: content, actionItems: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mbr-summarize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
