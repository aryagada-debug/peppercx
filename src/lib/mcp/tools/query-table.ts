import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { applyFilters, resolveTable, type Filter } from "../schema";

const filterSchema = z.object({
  column: z.string().trim().min(1).max(120),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "is_null", "not_null"]),
  value: z.string().max(500).optional().describe("Comparison value. For `in`, a comma-separated list. Omit for null checks."),
});

export default defineTool({
  name: "query_table",
  title: "Query table",
  description:
    "Read rows from one table in the app's database. Supports column selection, filters, ordering and a row limit. Read-only; results are restricted to what the signed-in user is allowed to see. Call `list_tables` first to discover tables and columns.",
  inputSchema: {
    table: z.string().trim().min(1).max(120).describe("Table name, e.g. staffing_deals"),
    columns: z.array(z.string().trim().min(1).max(120)).max(60).optional().describe("Columns to return (default: all)"),
    filters: z.array(filterSchema).max(10).optional().describe("Filters combined with AND"),
    order_by: z.string().trim().max(120).optional().describe("Column to sort by"),
    descending: z.boolean().optional().describe("Sort descending (default false)"),
    limit: z.number().int().min(1).max(1000).optional().describe("Max rows to return (default 100, max 1000)"),
    offset: z.number().int().min(0).max(100000).optional().describe("Rows to skip, for paging"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ table, columns, filters, order_by, descending, limit, offset }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    try {
      const available = await resolveTable(ctx, table);
      for (const c of columns ?? []) {
        if (!available.includes(c)) {
          throw new Error(`Unknown column "${c}" on ${table}. Available columns: ${available.join(", ")}`);
        }
      }
      if (order_by && !available.includes(order_by)) {
        throw new Error(`Unknown column "${order_by}" on ${table}. Available columns: ${available.join(", ")}`);
      }

      const supabase = supabaseForUser(ctx);
      const take = limit ?? 100;
      const from = offset ?? 0;
      let query: any = (supabase as any).from(table).select((columns ?? ["*"]).join(","));
      query = applyFilters(query, filters as Filter[] | undefined, available);
      if (order_by) query = query.order(order_by, { ascending: !descending });
      query = query.range(from, from + take - 1);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        structuredContent: { table, row_count: rows.length, rows },
      };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }], isError: true };
    }
  },
});
