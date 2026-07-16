import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_deals",
  title: "List deals",
  description:
    "List deals the signed-in user can access, honoring the app's row-level security. Optionally filter by a search string that matches deal id, VSD, or BOPM.",
  inputSchema: {
    search: z.string().trim().max(200).optional().describe("Optional substring filter"),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("staffing_deals")
      .select("id, client_id, vsd, principal_bopm, senior_bopm, bopm")
      .limit(limit ?? 50);
    if (search && search.length > 0) {
      const escaped = search.replace(/[%,]/g, "");
      query = query.or(
        `id.ilike.%${escaped}%,vsd.ilike.%${escaped}%,principal_bopm.ilike.%${escaped}%,senior_bopm.ilike.%${escaped}%,bopm.ilike.%${escaped}%`,
      );
    }
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { deals: data ?? [] },
    };
  },
});