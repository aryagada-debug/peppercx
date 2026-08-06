import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { applyFilters, resolveTable, type Filter } from "../schema";

const filterSchema = z.object({
  column: z.string().trim().min(1).max(120),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "is_null", "not_null"]),
  value: z.string().max(500).optional(),
});

export default defineTool({
  name: "count_rows",
  title: "Count rows",
  description:
    "Count rows in one table, with the same filters as `query_table`. Useful for sizing a result before reading it. Counts only rows the signed-in user is allowed to see.",
  inputSchema: {
    table: z.string().trim().min(1).max(120).describe("Table name"),
    filters: z.array(filterSchema).max(10).optional().describe("Filters combined with AND"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ table, filters }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    try {
      const available = await resolveTable(ctx, table);
      const supabase = supabaseForUser(ctx);
      let query: any = (supabase as any).from(table).select("*", { count: "exact", head: true });
      query = applyFilters(query, filters as Filter[] | undefined, available);
      const { count, error } = await query;
      if (error) throw new Error(error.message);
      return {
        content: [{ type: "text", text: JSON.stringify({ table, count: count ?? 0 }) }],
        structuredContent: { table, count: count ?? 0 },
      };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }], isError: true };
    }
  },
});
