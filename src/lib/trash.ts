/**
 * Central soft-delete + restore helper.
 *
 * Instead of hard-deleting rows, callers route through `softDelete()`, which:
 *   1. Snapshots the row (+ any registered child rows) into `trash_items`
 *   2. Hard-deletes the original row(s)
 *
 * Items live in trash for 7 days (`expires_at = deleted_at + 7d`) and can be
 * restored from the Trash pane or permanently deleted by an admin.
 */
import { supabase } from "@/integrations/supabase/client";

export type TrashEntityType =
  | "staffing_deal"
  | "client"
  | "deal_task"
  | "cx_task"
  | "deal_stakeholder"
  | "deal_sow_item"
  | "staffing_assignment"
  | "personal_todo";

interface ChildSpec {
  table: string;
  /** column on child table that references the parent's primary key */
  fk: string;
}

interface EntityConfig {
  /** Source table name */
  table: string;
  /** Primary-key column on the source table (default: `id`) */
  pk?: string;
  /** Child tables to snapshot+cascade-delete with the parent */
  children?: ChildSpec[];
  /** Build a human-readable label from the row */
  label: (row: any) => string;
  /** Display label for the entity type itself */
  displayName: string;
}

export const TRASH_REGISTRY: Record<TrashEntityType, EntityConfig> = {
  staffing_deal: {
    table: "staffing_deals",
    displayName: "Deal",
    label: (r) => r?.deal_name || r?.account || r?.id || "Deal",
    children: [
      { table: "deal_financials", fk: "deal_id" },
      { table: "deal_sow_items", fk: "deal_id" },
      { table: "deal_tasks", fk: "deal_id" },
      { table: "deal_onboarding_steps", fk: "deal_id" },
      { table: "deal_rgy_weekly", fk: "deal_id" },
      { table: "deal_revenue_monthly", fk: "deal_id" },
      { table: "deal_targets_monthly", fk: "deal_id" },
      { table: "mbr_entries", fk: "deal_id" },
      { table: "deal_stakeholders", fk: "deal_id" },
    ],
  },
  client: {
    table: "clients",
    displayName: "Client",
    label: (r) => r?.name || r?.id || "Client",
  },
  deal_task: {
    table: "deal_tasks",
    displayName: "Deal task",
    label: (r) => r?.title || "Task",
  },
  cx_task: {
    table: "cx_tasks",
    displayName: "CX task",
    label: (r) => r?.title || "Task",
  },
  deal_stakeholder: {
    table: "deal_stakeholders",
    displayName: "Stakeholder",
    label: (r) => r?.name || "Stakeholder",
  },
  deal_sow_item: {
    table: "deal_sow_items",
    displayName: "SoW line item",
    label: (r) => r?.scope || "SoW item",
  },
  staffing_assignment: {
    table: "staffing_assignments",
    displayName: "Staffing assignment",
    label: (r) => `${r?.role_key ?? "Role"} → ${r?.person_id ?? "?"}`,
  },
  personal_todo: {
    table: "personal_todos",
    displayName: "Personal todo",
    label: (r) => r?.title || "Todo",
  },
};

async function currentActor() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const name =
    (user?.user_metadata as any)?.full_name ||
    (user?.user_metadata as any)?.name ||
    user?.email ||
    "";
  return { id: user?.id ?? null, name: String(name) };
}

/**
 * Soft-delete a single entity by id. Snapshots the row (+ children) to
 * `trash_items` and removes the originals. Returns true on success.
 */
export async function softDelete(
  entityType: TrashEntityType,
  id: string,
  opts: { label?: string } = {},
): Promise<boolean> {
  const cfg = TRASH_REGISTRY[entityType];
  if (!cfg) {
    console.error("Unknown trash entity type", entityType);
    return false;
  }

  // 1. Fetch row
  const pk = cfg.pk ?? "id";
  const { data: row, error: rowErr } = await supabase
    .from(cfg.table as any)
    .select("*")
    .eq(pk, id)
    .maybeSingle();
  if (rowErr || !row) {
    console.error("softDelete: row not found", entityType, id, rowErr);
    return false;
  }

  // 2. Fetch children
  const children: Record<string, any[]> = {};
  if (cfg.children?.length) {
    await Promise.all(
      cfg.children.map(async (c) => {
        const { data } = await supabase
          .from(c.table as any)
          .select("*")
          .eq(c.fk, id);
        if (data?.length) children[c.table] = data;
      }),
    );
  }

  const actor = await currentActor();

  // 3. Insert trash record
  const { error: insErr } = await supabase.from("trash_items").insert({
    entity_type: entityType,
    entity_id: String(id),
    entity_label: opts.label ?? cfg.label(row),
    snapshot: { row, children },
    deleted_by: actor.id,
    deleted_by_name: actor.name,
  });
  if (insErr) {
    console.error("softDelete: trash insert failed", insErr);
    return false;
  }

  // 4. Hard-delete children then parent
  if (cfg.children?.length) {
    await Promise.all(
      cfg.children.map((c) =>
        supabase.from(c.table as any).delete().eq(c.fk, id),
      ),
    );
  }
  const { error: delErr } = await supabase
    .from(cfg.table as any)
    .delete()
    .eq(pk, id);
  if (delErr) {
    console.error("softDelete: parent delete failed", delErr);
    return false;
  }

  return true;
}

export interface TrashItem {
  id: string;
  entity_type: TrashEntityType;
  entity_id: string;
  entity_label: string;
  snapshot: { row: any; children?: Record<string, any[]> };
  deleted_by: string | null;
  deleted_by_name: string;
  deleted_at: string;
  expires_at: string;
  restored_at: string | null;
}

export async function restoreTrashItem(item: TrashItem): Promise<{ ok: boolean; error?: string }> {
  const cfg = TRASH_REGISTRY[item.entity_type];
  if (!cfg) return { ok: false, error: "Unknown entity type" };
  const { row, children } = item.snapshot || ({} as any);
  if (!row) return { ok: false, error: "Snapshot missing" };

  const { error: parentErr } = await supabase.from(cfg.table as any).insert(row);
  if (parentErr) return { ok: false, error: parentErr.message };

  if (children) {
    for (const [table, rows] of Object.entries(children) as [string, any[]][]) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const { error: childErr } = await supabase.from(table as any).insert(rows);
      if (childErr) {
        console.error("restore child failed", table, childErr);
      }
    }
  }

  await supabase
    .from("trash_items")
    .update({ restored_at: new Date().toISOString() })
    .eq("id", item.id);

  return { ok: true };
}

export async function purgeTrashItem(id: string): Promise<boolean> {
  const { error } = await supabase.from("trash_items").delete().eq("id", id);
  return !error;
}