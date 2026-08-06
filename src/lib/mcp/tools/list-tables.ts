import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fetchSchema, groupByTable } from "../schema";

export default defineTool({
  name: "list_tables",
  title: "List tables",
  description:
    "List every table in the app's database with its columns and column types, so you can discover the schema before querying. Structure only — returns no row data.",
  inputSchema: {
    table: z.string().trim().max(120).optional().describe("Optional: return columns for just this one table"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ table }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    try {
      const rows = await fetchSchema(ctx);
      const filtered = table ? rows.filter((r) => r.table_name === table) : rows;
      if (table && filtered.length === 0) {
        const known = Array.from(new Set(rows.map((r) => r.table_name))).sort();
        return {
          content: [{ type: "text", text: `Unknown table "${table}". Available tables: ${known.join(", ")}` }],
          isError: true,
        };
      }
      const grouped = groupByTable(filtered);
      const tables = Object.entries(grouped).map(([name, cols]) => ({
        table: name,
        columns: cols.map((c) => ({ name: c.column_name, type: c.data_type, nullable: c.is_nullable })),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(tables, null, 2) }],
        structuredContent: { tables },
      };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }], isError: true };
    }
  },
});
