# App-wide performance fixes

## What I measured (live preview, just now)

| Metric | Value | Verdict |
|---|---|---|
| First Paint | 7.6 s | poor |
| First Contentful Paint | 11.0 s | poor |
| DOMContentLoaded | 7.7 s | poor |
| CLS | 1.06 (4 shifts) | poor |
| Script requests on first load | **217 files / 2.7 MB** | poor |
| `user_roles` fetched | **3×** (2.0 s + 2.5 s + 2.8 s) | bug |
| `route_visibility` fetched | 3× | bug |
| `user_route_overrides` fetched | 3× | bug |
| `mbr_entries` fetched | 4× | bug |

The "feels like a reload" perception comes from three compounding things: a flood of script files, duplicate Supabase calls on every navigation, and a layout that visibly shifts (CLS 1.06) while data lands. None of the fixes below change behaviour — only how/when work runs.

## Root causes

1. **No code splitting in `src/App.tsx`** — every page (`DealDetail` 128 K, `RGYHealth` 68 K, `MBRTracker` 64 K, `Home` 59 K, `Clients` 53 K, `MyStaffingRequests` 37 K, `BopmStaffingFlatTable` 48 K, etc.) plus full data seeds (`allDeals.ts` 93 K, `staffingData.ts` 83 K) are imported at the top of `App.tsx`. The browser parses ~2.7 MB before the first route renders.

2. **Auth context creates a fresh `user` object every render.** In `AuthProvider`, `user: session?.user ?? null` is recomputed inline, so its reference changes on every render. `useUserRole.load` lists `user` in its `useCallback` deps, so `load` is recreated and its `useEffect` re-fires — that's why `user_roles` / `route_visibility` / `user_route_overrides` are each fetched 3×. After a `viewAsRole` localStorage hydration the effect fires again.

3. **No request-level cache.** Every page mounts its own `useStaffingData`, `useClients`, `useMBRData`, etc., and each does its own `supabase.from(...).select(...)`. Switching pages refetches the same rows. React Query is already installed (`QueryClientProvider`) but isn't used by these hooks.

4. **Eager realtime channels.** `useStaffingData` opens a `supabase.channel("staffing-sync")` and on **any** row change refetches the entire `staffing_assignments` / `staffing_people` / `staffing_deals` table. With ~550 deals this is wasteful when nothing on the visible page depends on it.

5. **Layout shift on the dashboard.** `src/pages/Index.tsx` renders KPI cards into a grid that grows after data resolves (no fixed-height skeleton), producing CLS 1.06.

6. **Tab panels remount on switch** (the issue you raised earlier on `/staffing`). Conditional rendering (`{tab === "table" && <Panel/>}`) tears down the panel's local state every switch, which feels like a reload.

## Fix plan (no functional changes)

### 1. Stabilise the auth/role pipeline (kills 3× duplicate fetches)
- `src/components/auth/AuthProvider.tsx`: memoise the context value with `useMemo`, and derive `user` once via `useMemo` so its reference is stable when `session` is unchanged.
- `src/hooks/useUserRole.ts`:
  - Read the `viewAsRole` from localStorage with a **lazy `useState` initialiser** instead of a separate `useEffect`, so we never start with `null` and immediately re-run.
  - Use `user.id` (string) — not the `user` object — in `load`'s deps.
  - Guard `load` with an in-flight ref so concurrent calls dedupe.

Expected effect: `user_roles` / `route_visibility` / `user_route_overrides` go from 3× to 1× per session.

### 2. Code-split routes (cuts initial JS by ~70%)
- `src/App.tsx`: convert every page import to `React.lazy(() => import(...))` and wrap `<Routes>` in a single `<Suspense fallback={<RouteFallback/>}>`. Public auth pages (`Login`, `Signup`) stay eager so the login screen paints instantly.
- The `RouteFallback` is a small skeleton matching `AppLayout`'s header/sidebar so there's no white flash.

Expected effect: initial bundle drops from 217 scripts / 2.7 MB to roughly the shell + the current route. Each subsequent route loads its chunk on demand and is cached.

### 3. Centralise heavy data hooks via React Query
React Query is already wired up, just unused. Migrate the three biggest offenders:
- `src/hooks/useStaffingData.ts` — split into `useStaffingPeople`, `useStaffingDeals`, `useStaffingAssignments` queries (each `staleTime: 5 min`, `gcTime: 30 min`).
- `src/hooks/useClients.ts`
- `src/hooks/useMBRData.ts`

Mutations (`updateAssignment`, `addAssignment`, etc.) call `queryClient.setQueryData` to patch the cache locally and `invalidateQueries` for the affected key only — no full refetch.

Expected effect: switching pages no longer refetches the same tables; staffing/MBR/clients data is shared across `Staffing`, `Settings`, `MBRTracker`, `Clients`, `DealDetail`.

### 4. Tame realtime
- Keep one realtime channel, but in the handler call `queryClient.invalidateQueries(['staffing_assignments'])` etc. instead of refetching the entire table inline.
- Subscribe only when the user is on a route that displays staffing data (move the channel into a small `useStaffingRealtime()` hook called from `Staffing.tsx` only).

### 5. Eliminate CLS on the dashboard
- `src/pages/Index.tsx`: give the KPI grid and chart areas explicit `min-h-*` placeholders that match the loaded content height. Use the existing `DashboardSkeleton` while data loads instead of an empty container.

### 6. Persist tab panels (the earlier "reload on tab switch" issue)
- `src/pages/Staffing.tsx`: render all permitted tab panels and toggle visibility with `hidden` so column widths, drafts, scroll, search, etc. survive a tab switch. Same pattern in `src/pages/Clients.tsx` and any other page using local-state tab panels.

### 7. Drop seed data from the main bundle
`src/data/staffingData.ts` (83 K) and `src/data/allDeals.ts` (93 K) are imported eagerly by `useStaffingData` purely as defaults / seeds. Convert their large arrays to a dynamic `import()` used only when seeding is actually needed (`count < EXPECTED_MIN`).

## Files touched (estimate)

- `src/App.tsx` (lazy routes + Suspense)
- `src/components/auth/AuthProvider.tsx` (memoise value + user)
- `src/hooks/useUserRole.ts` (lazy localStorage read, deps cleanup, in-flight guard)
- `src/hooks/useStaffingData.ts` (React Query, dynamic seed import, scoped realtime)
- `src/hooks/useClients.ts` (React Query)
- `src/hooks/useMBRData.ts` (React Query)
- `src/pages/Staffing.tsx` (persist tab panels)
- `src/pages/Clients.tsx` (persist tab panels)
- `src/pages/Index.tsx` (skeleton sizing → fix CLS)
- new `src/components/layout/RouteFallback.tsx`

## Out of scope / not changed
- No UI redesign, no behaviour changes, no removal of features.
- No DB / RLS / edge function changes.
- No upgrade of any library — purely usage changes.

## Expected impact (rough, based on the profile)

- Initial JS: **2.7 MB → ~700-900 KB** for the landing route.
- FCP: **11 s → ~2-3 s** on a warm cache, ~3-4 s cold.
- Duplicate Supabase calls per navigation: **3× → 1×** (auth/role) and **N× → 1×** (staffing/clients/mbr across pages within a session).
- CLS on dashboard: **1.06 → < 0.1**.
- Tab switches on Staffing/Clients: no remount, no spinner.

Approve to proceed and I'll implement in this order: (1) auth/role stabilisation → (2) lazy routes → (3) React Query for the three big hooks → (4) realtime + seed lazy import → (5) CLS skeletons → (6) tab persistence.
