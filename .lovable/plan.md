## Goal

Align the Staffing & Capacity header counts with the Clients & Deals page so "active deals" matches everywhere. People count will be left alone — it will drop to 133 automatically when you re-upload the people list.

## Change

**`src/data/staffingData.ts`** — Tighten `ACTIVE_DEAL_STATUSES` to match the Clients page rule (drop `"Deal in Renewal Process"`):

```ts
export const ACTIVE_DEAL_STATUSES: ReadonlySet<string> = new Set([
  "Active Deal",
  "New Deal in SLA/PO",
  "Deal Disputed",
]);
```

This constant is the single source of truth used by `Staffing.tsx`, `BopmStaffingFlatTable`, the Dashboard, etc., so the header count, the deals table, and every downstream tab will all move together.

## What this fixes

- Staffing header "X active deals" now uses the same definition as the Clients & Deals page (today the DB has 152 Active + 24 New Deal in SLA/PO + 7 Deal Disputed = **183**). After your refreshed upload it should land at 158.
- People count (`people.filter(p => !p.tbh).length`) is left untouched — it will display 133 once you re-upload the cleaned people list.

## Out of scope

- No DB / RLS / edge-function changes. The Postgres helper `_is_active_staffing_status` keeps its 4-status set (used only by the trigger that wipes staffing on a deal closing) — narrowing that would unexpectedly delete assignments on Renewal deals.
- No changes to people filtering logic; the re-upload handles that.
