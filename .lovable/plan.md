## Goal
Move the Pulse / NPS surface out of the RGY Health tab bar and into its own left-sidebar entry, listed directly below "RGY Health" under Health & Reviews.

## Changes

1. **New page** `src/pages/PulseNPS.tsx`
   - Thin wrapper page that renders `PulseSurveyTab` with the same deals data RGY Health uses (reuse `useDealsQuery` + filters already used in `RGYHealth.tsx`, or just pass `deals` filtered by access — match current behavior so the recipient/CC logic is unchanged).
   - Same gating as today: only visible to users where `useCanEditRgy()` returns true; otherwise show a "Not authorized" empty state.

2. **Routing** `src/App.tsx`
   - Add lazy route `/pulse-nps` → `PulseNPS`, wrapped in `ProtectedRoute` like other Health routes.

3. **Sidebar** `src/components/layout/AppSidebar.tsx`
   - In the `Health & Reviews` section, insert a new item right after `RGY Health`:
     - `{ to: "/pulse-nps", icon: MessageSquare (or Sparkles), label: "Pulse / NPS", routeKey: "rgy-health" }`
   - Add a prefetch entry for `/pulse-nps`.
   - Reuses the `rgy-health` routeKey so existing role visibility rules apply (no access-control schema change needed).

4. **RGY Health page** `src/pages/RGYHealth.tsx`
   - Remove the `pulse` tab trigger and its `TabsContent`.
   - Drop `"pulse"` from the `activeTab` union and the `PulseSurveyTab` import.

## Out of scope
- No changes to `PulseSurveyTab` itself, edge functions, DB schema, or survey HTML.
- No new role/permission key.
