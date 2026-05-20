## Trash & Restore System

A soft-delete + 7-day recovery pane covering deals and other deletable entities, with audit info (who deleted, when).

### Scope (entities covered)
Phase 1 — high-value entities most prone to accidents:
- `staffing_deals` (deals)
- `clients`
- `deal_tasks`
- `cx_tasks`
- `deal_stakeholders`
- `deal_sow_items`
- `staffing_assignments`
- `personal_todos`

(Architecture is generic — adding more tables later is one row in a registry.)

### Approach

**Single central `trash_items` table** (recommended over per-table `deleted_at` columns):
```
trash_items
  id uuid pk
  entity_type text         -- e.g. 'staffing_deal', 'client'
  entity_id text           -- original PK as text
  entity_label text        -- human label ("Acme - Q3 Retainer")
  snapshot jsonb           -- full row + related children (for restore)
  deleted_by uuid          -- auth.uid()
  deleted_by_name text
  deleted_at timestamptz
  expires_at timestamptz   -- deleted_at + 7 days
  restored_at timestamptz  -- null until restored
```

Why central: one Trash UI, one cleanup job, no schema churn per entity, full snapshots survive even if the source row is gone.

### Delete flow
Wrap every existing delete in a helper `softDelete(entityType, id)`:
1. Fetch the row (+ children where relevant, e.g. deal → tasks, stakeholders, financials).
2. Insert snapshot into `trash_items`.
3. Hard-delete the original row (so the rest of the app naturally hides it — no need to rewrite every query with `WHERE deleted_at IS NULL`).

This keeps the existing app behavior unchanged; only the delete path is intercepted.

### Restore flow
From the Trash pane → "Restore":
- Re-insert snapshot into the original table (and children).
- Mark `trash_items.restored_at = now()`.
- Conflict handling: if a row with same id exists, show "already exists" error.

### Permanent deletion
- Manual: "Delete forever" button (admin only) in Trash pane.
- Automatic: scheduled edge function `trash-cleanup` runs daily, deletes `trash_items` where `expires_at < now()`.

### Trash pane UI
New route `/trash` (admin + member roles), sidebar entry under settings:
- Filters: entity type, deleted by, date range.
- Columns: Type · Name · Deleted by · Deleted at · Expires in (Xd) · Actions (Restore / Delete forever).
- Empty state + countdown badge for items expiring <24h.

### Permissions
- Anyone authenticated can see items they deleted.
- Admins see everything.
- Only admins can "Delete forever"; original deleter or admin can restore.

### Technical details

**Migration**
- Create `trash_items` table + indexes on `(entity_type, expires_at)` and `deleted_by`.
- RLS:
  - SELECT: `deleted_by = auth.uid() OR has_role(auth.uid(),'admin')`
  - INSERT: authenticated
  - UPDATE/DELETE: admin only
- Scheduled cron via `pg_cron` calling cleanup edge function (or just SQL: `DELETE FROM trash_items WHERE expires_at < now() AND restored_at IS NULL`).

**Code**
- `src/lib/trash.ts` — entity registry mapping `entity_type` → `{ table, childTables[], labelFn }` + `softDelete` / `restore` helpers.
- Refactor existing delete mutations in:
  - `useDealsQuery.ts`, `useClientsQuery.ts`, `useStaffingMutations.ts`, `deal_tasks`/`cx_tasks` hooks, etc.
  to call `softDelete` instead of raw `.delete()`.
- New `useTrashQuery.ts` + `useTrashMutations.ts`.
- New page `src/pages/Trash.tsx` + route in `App.tsx` + sidebar link in `AppSidebar.tsx`.
- Edge function `supabase/functions/trash-cleanup/index.ts` (scheduled).

### Out of scope (for now)
- Trashing settings/config rows (capability_groups, route_visibility, etc.) — admin-only, low accident risk.
- Trashing approval_requests, slack_messages, mbr_reminder_log — system/log tables.
- Undo toast (can add later as a thin wrapper over the same `softDelete` + immediate `restore`).
