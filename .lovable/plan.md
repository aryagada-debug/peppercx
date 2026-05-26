## Goal

Treat a deal as "Staffed" only after Central CX (admins) explicitly **locks staffing** on it. Everything else is "Unstaffed". Add an analytics view on the Staffing page that makes it obvious which deals are still unstaffed so they can be closed out.

## Data model

Add three columns to `staffing_deals`:

- `staffing_locked_at timestamptz NULL`  → source of truth. NOT NULL = Staffed.
- `staffing_locked_by uuid NULL`         → admin who locked.
- `staffing_locked_by_name text NOT NULL DEFAULT ''` → display name snapshot.

No new table. A deal's "Staffed" state derives from `staffing_locked_at IS NOT NULL`.

Add a Postgres RPC `toggle_staffing_lock(_deal_id text, _lock boolean)` that:
- Verifies the caller is admin via `public.has_role(auth.uid(), 'admin')`.
- On lock: sets `staffing_locked_at = now()`, `staffing_locked_by = auth.uid()`, snapshots name from `profiles.display_name`.
- On unlock: clears all three fields.
- Errors with `permission denied` for non-admins.

This keeps the existing "Anyone can update staffing_deals" RLS intact (other fields still editable by the rest of the app) while gating the lock fields behind one tightly-scoped function.

## UI changes

### 1. Lock toggle in the Staffing table (`BopmStaffingFlatTable`)
- New right-aligned column **"Staffing"** showing one of two flat chips:
  - `Unstaffed` (amber dot) — clickable for admins → "Lock staffing"
  - `Staffed · Locked by <name> · <date>` (green dot) — admins get a small `×` to unlock
- Non-admins see the chip read-only (no click).
- Uses existing semantic colors (amber/green) and the flat-UI styling rules already in core memory.

### 2. New tab: **Lock Analytics**
Added to the existing tab strip on `/staffing` (admins + VSD/CapLead personas; BOPMs don't see it). Tab key `lock`.

Layout, top-down:

1. **Filters row** (chips/dropdowns, all multi-select where it makes sense):
   - VSD
   - Capability: SEO / Content / Creative / Other (derived from `seo_staffing`, `creative_staffing`, `capability_line`, `service_line_tagging`)
   - Deal Type: Retainer / Non-Retainer
   - Deal Status (uses `ACTIVE_DEAL_STATUSES` + the rest)
   - Pod
   - Account
   - Locked date range (only narrows the Staffed slice)
2. **KPI cards**: Total deals · Staffed · Unstaffed · % Staffed.
3. **Bar chart — Staffed vs Unstaffed by VSD** (stacked, Recharts). Click a bar → filters the table below to that VSD.
4. **Bar chart — by Capability** (SEO / Content / Creative / Other), same interaction.
5. **Unstaffed deals table** at the bottom — sortable, shows Deal ID, Account, Deal Name, VSD, Capability tags, MRR, Status, and a **Lock** action button (admins only). Locking from here updates the row in place and refreshes the charts.

### 3. Wiring
- New hook `useStaffingLockMutations` wrapping the RPC, with optimistic update of the deals cache.
- `useStaffingQueries` already loads `staffing_deals` — extend the select to include the three new columns and surface `staffingLockedAt / By / ByName` on the typed deal object.
- Tab routing: `?tab=lock` added to the existing `Tab` union in `src/pages/Staffing.tsx`.

## Out of scope

- No changes to assignments, capacity math, or the existing Deal / People / Table views beyond the new Staffing column and tab.
- No bulk-lock UI in v1 (single click per deal). Easy to add later.
- No audit log table — `staffing_locked_at/by` is the audit trail.

## Files touched

- `supabase/migrations/<ts>_staffing_lock.sql` — add columns + RPC.
- `src/hooks/queries/useStaffingQueries.ts` — select + map new fields.
- `src/hooks/queries/useStaffingLockMutations.ts` — **new**.
- `src/components/staffing/BopmStaffingFlatTable.tsx` — add Staffing column + lock toggle.
- `src/components/staffing/LockAnalyticsTab.tsx` — **new** (filters, KPIs, charts, unstaffed table).
- `src/pages/Staffing.tsx` — register `lock` tab for non-BOPM personas; mount `LockAnalyticsTab`.
- `src/data/staffingData.ts` (or equivalent types file) — extend `StaffingDeal` type.