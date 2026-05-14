# Staffing page — performance audit

## What the page actually has to render

Live Cloud counts: **227 people · 759 deals · 1,028 assignments · 37 revenue targets**. The matrix is the BOPM flat table at 759 rows × ~50 role columns ≈ **38,000 interactive cells**, each wrapping a Popover / picker.

## Root causes (ordered by impact)

### 1. All three heavy tabs mount at once for admin / VSD / capability roles
`src/pages/Staffing.tsx` renders **`DealViewTab`**, **`PeopleViewTab`**, and **`BopmStaffingFlatTable`** simultaneously, hidden via `className="hidden"`. The "switching feels like a reload" comment explains the intent, but the cost is that the very first paint runs **all three** big tables (each does its own O(deals × assignments) memos and renders thousands of DOM nodes). On the current dataset that single paint is multi-second and is the most common cause of the white-screen / unresponsive tab.

### 2. `BopmStaffingFlatTable.dealRoleMap` is O(deals × assignments × people)
- For each of 759 deals: `assignments.filter(a => a.dealId === d.id)` over 1,028 rows ≈ **~780 k iterations** per render.
- Then for each of 3 BOPM virtual columns: `allPeople.filter(... dealCellMatchesPerson(...))` over 227 people, where `dealCellMatchesPerson` does string normalisation + regex tests. That's **~1.5 M extra regex calls per render**, repeated on every keystroke in search, every draft change, every realtime tick.
- Build it once: pre-index `assignments` by `dealId` (single pass) and pre-tokenise the BOPM cells.

### 3. Per-cell hierarchy recomputation in `renderEntry`
At ~38 k cells, every render calls `resolvePeopleForRole` → `getDescendantPersonIds` (which walks the org graph). Even at 0.1 ms/call that's seconds of layout + thousands of identical Popover trees. Memoise candidates by `(dealId, roleKey)` and lift them out of `renderEntry`.

### 4. No virtualization on a 759-row × ~50-col table
Renders ~38 k `<td>` plus their Popover triggers, drag handles, date pickers. We need either row virtualization (`@tanstack/react-virtual` over `<tbody>`) **or** built-in pagination/lazy grouping (e.g. accordion per VSD/account, expand on demand). Until then any data growth makes the crash worse.

### 5. `useStaffingData.loadAll` fetches everything unbounded
Six parallel `select("*")` calls on first mount with no column projection or pagination, then a single `setState` cascade re-renders all three mounted tabs. The realtime channel re-runs the full `select("*")` for the changed table on every burst (300 ms debounce helps but it still pulls **all 1,028 assignments** per change).

### 6. Dangerous auto-seed on read path
`loadAll` triggers `seedDatabase()` whenever `staffing_people.count < 200` and **deletes every assignment + person first**. If a count check ever returns low (RLS hiccup, partial outage), the page nukes live data and re-inserts mock defaults. This is also why a slow/large response can appear as "the page wiped my work and crashed".

### 7. Smaller but additive issues
- `totals` memo: O(unique_people × assignments) = ~200 × 1,028 ≈ 200 k filter ops per render.
- `filteredDeals`: copies + re-sorts the deal list and reflows on every keystroke; depends on `dealRoleMap` so any draft edit triggers it.
- `Staffing.tsx` `scopedAssignments` rebuilds Sets of all deal/person ids every render.
- `useDealAccess` runs a chain of awaits for every non-admin user before the page can show its loader; only after that can the data hooks start.
- Realtime subscription refetches **all** rows on any change to any of three tables — multiplied by 38 k cells re-rendering.

## Fix plan (incremental, no behaviour change)

```text
P0 — stop the crash
1. Lazy-mount tab panels in src/pages/Staffing.tsx
   - keep state via useRef draft caches, but only render the active panel;
     mount a tab the first time it is opened (keep mounted afterwards).
2. Index assignments by dealId in BopmStaffingFlatTable (single useMemo) and
   reuse inside dealRoleMap, filteredDeals, renderEntry, totals.
3. Pre-resolve BOPM virtual entries with a single pass over assignments +
   one per-deal tokenisation (drop the per-cell allPeople.filter loop).

P1 — make 759×50 sustainable
4. Virtualize <tbody> with @tanstack/react-virtual (overscan 8 rows) OR
   group rows by VSD/account with collapsible sections (default collapsed
   below N=50 visible).
5. Memoise candidate lists per (dealId, roleKey); compute once in a useMemo
   built from dealRoleMap + ROLE_SLOTS, not inside renderEntry.
6. React.memo the row component (DealRow) keyed by dealId, with stable
   handler refs from useCallback.

P2 — tighten data layer
7. Project columns explicitly in loadAll() instead of select("*"); cap
   assignments fetch with a server-side filter when persona is BOPM/VSD.
8. Realtime: on row change, patch the in-memory list (insert/update/delete
   by id) instead of refetching the whole table.
9. Remove the destructive auto-seed branch from loadAll(); move seeding
   behind an explicit admin action / migration. At minimum, gate it by
   isActuallyAdmin AND a confirmation flag.

P3 — small wins
10. Replace totals' O(n²) loop with a single pass:
    Σ allocation_pct grouped by personId.
11. In Staffing.tsx, build deal-id and person-id Sets once via useMemo
    keyed on identity; share them with downstream tabs via context/props.
```

## Verification

- Devtools Profiler: initial commit on `/staffing` (admin) drops from "long task" (>3 s) to under 300 ms after P0+P1.
- `Performance` panel: no main-thread block >50 ms while typing in the search box.
- Open the page on a throttled CPU 4× profile — page must remain interactive (no `Page Unresponsive`).
- Confirm realtime still propagates: change one assignment in another tab → only that row re-renders.
- Confirm seed path no longer deletes data unless explicitly invoked.

## Out of scope

- UI redesign of the staffing tables.
- Schema changes to `staffing_*` tables.
- Touching DealViewTab/PeopleViewTab internals beyond what P0 lazy-mount requires (their own perf passes can follow).
