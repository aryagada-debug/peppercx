# Group Deals Under Client Rows with Collapsible Sections

## Summary

Restructure the Clients & Deals table so each client appears once as a parent row, with its deals nested underneath in a collapsible section. Currently every deal is a flat row repeating the client name.

## Changes — `src/pages/Clients.tsx`

### 1. Group deals by client

Add a `useMemo` that groups `filteredDeals` by `deal.account` into a `Map<string, Deal[]>` (or array of `{ client: string, deals: Deal[] }`), sorted alphabetically by client name.

### 2. Client parent row (collapsible)

For each client group, render a parent `<tr>` spanning the full table width:

- **Chevron** toggle icon (ChevronRight / ChevronDown)
- **Client name** (bold)
- **Deal count** badge (e.g., "3 deals")
- **Aggregated MRR** and **Total Revenue** summed across all deals for that client
- **Delete client** button (existing logic)
- **Add Deal** button scoped to that client

Track expanded clients in a `Set<string>` state (`expandedClients`). Clicking the row toggles visibility.

### 3. Deal child rows

When a client is expanded, render its deals as child `<tr>` rows below with slight left indentation. These keep ALL existing columns and editing functionality (Status, VSD, BOPM dropdowns, inline MRR/Revenue edit, RGY dot, delete). Remove the "Client" column from child rows since the parent already shows it.

### 4. Table header update

Remove the standalone "Client" column header. The first column becomes the client name / deal name depending on row level.

### 5. Expand/collapse all

Add a small "Expand All / Collapse All" toggle button near the filters.  
  
Add delete Deal button as well subtle to the side

## Files Modified


| File                    | Change                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `src/pages/Clients.tsx` | Group deals by client, collapsible parent rows with aggregated stats, indented child deal rows |
