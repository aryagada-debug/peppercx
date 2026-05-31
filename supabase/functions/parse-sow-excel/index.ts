import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authSupa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims, error: claimErr } = await authSupa.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { fileBase64 } = await req.json();
    if (!fileBase64 || typeof fileBase64 !== "string") {
      return new Response(JSON.stringify({ error: "Missing fileBase64" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (fileBase64.length > Math.ceil((MAX_FILE_BYTES * 4) / 3)) {
      return new Response(JSON.stringify({ error: "File too large (max 8 MB)" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Decode base64 → parse all sheets
    const binary = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
    const wb = XLSX.read(binary, { type: "array" });
    const sheetsDump: Record<string, unknown[][]> = {};
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      sheetsDump[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as unknown[][];
    }

    // Truncate huge sheets to keep token usage sane
    const trimmed: Record<string, unknown[][]> = {};
    for (const [k, rows] of Object.entries(sheetsDump)) {
      trimmed[k] = rows.slice(0, 200).map((r) => (r as unknown[]).slice(0, 30));
    }

    const sheetText = Object.entries(trimmed)
      .map(([name, rows]) => `### Sheet: ${name}\n${rows.map((r) => (r as unknown[]).join(" | ")).join("\n")}`)
      .join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are a Scope of Work (SoW) parser. Given Excel sheet contents from a marketing services SoW, extract every line item.

For each line item identify:
- scope: descriptive name of the deliverable / line item
- team_capability: short capability tag (e.g., "SEO", "Content", "Creative", "Video", "Account Management")
- revenue_share: percentage of total deal value as a number 0-100 (use 0 if not specified)
- line_item_value: monetary value in INR as a number (use 0 if not specified)
- suggested_teams: array picked from ["Account Management", "Content", "SEO", "Creative", "Video"]

Skip header rows, totals, and metadata. Return ALL line items found across all sheets.`,
          },
          { role: "user", content: `Parse the following workbook:\n\n${sheetText}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_sow_items",
            description: "Extract structured SoW line items",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      scope: { type: "string" },
                      team_capability: { type: "string" },
                      revenue_share: { type: "number" },
                      line_item_value: { type: "number" },
                      suggested_teams: { type: "array", items: { type: "string" } },
                    },
                    required: ["scope", "team_capability", "revenue_share", "line_item_value", "suggested_teams"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_sow_items" } },
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
    return new Response(JSON.stringify({ items: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-sow-excel error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
