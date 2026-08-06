import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

export interface ColumnMeta {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  ordinal_position: number;
}

/** Read the public-schema table/column catalogue via the read-only helper function. */
export async function fetchSchema(ctx: ToolContext): Promise<ColumnMeta[]> {
  const supabase = supabaseForUser(ctx);
  const { data, error } = await (supabase as any).rpc("mcp_list_tables");
  if (error) throw new Error(error.message);
  return (data ?? []) as ColumnMeta[];
}

export function groupByTable(rows: ColumnMeta[]): Record<string, ColumnMeta[]> {
  const out: Record<string, ColumnMeta[]> = {};
  for (const r of rows) (out[r.table_name] ??= []).push(r);
  return out;
}

/** Ensure the table exists; returns its column names. Throws a caller-safe error otherwise. */
export async function resolveTable(ctx: ToolContext, table: string): Promise<string[]> {
  const rows = await fetchSchema(ctx);
  const cols = rows.filter((r) => r.table_name === table).map((r) => r.column_name);
  if (cols.length === 0) {
    const known = Array.from(new Set(rows.map((r) => r.table_name))).sort();
    throw new Error(`Unknown table "${table}". Available tables: ${known.join(", ")}`);
  }
  return cols;
}

export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in" | "is_null" | "not_null";

export interface Filter {
  column: string;
  op: FilterOp;
  value?: string;
}

/** Apply validated filters to a PostgREST query builder. No raw SQL is ever constructed. */
export function applyFilters(query: any, filters: Filter[] | undefined, columns: string[]) {
  for (const f of filters ?? []) {
    if (!columns.includes(f.column)) {
      throw new Error(`Unknown column "${f.column}". Available columns: ${columns.join(", ")}`);
    }
    const v = f.value ?? "";
    switch (f.op) {
      case "eq": query = query.eq(f.column, v); break;
      case "neq": query = query.neq(f.column, v); break;
      case "gt": query = query.gt(f.column, v); break;
      case "gte": query = query.gte(f.column, v); break;
      case "lt": query = query.lt(f.column, v); break;
      case "lte": query = query.lte(f.column, v); break;
      case "contains": query = query.ilike(f.column, `%${v}%`); break;
      case "in": query = query.in(f.column, v.split(",").map((s) => s.trim()).filter(Boolean)); break;
      case "is_null": query = query.is(f.column, null); break;
      case "not_null": query = query.not(f.column, "is", null); break;
    }
  }
  return query;
}
