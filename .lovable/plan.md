## Goal
1. Promote **Slack Review** to a top-level sidebar page (own route), removing it as a sub-tab of RGY Health.
2. Fix the **Rebuild now** button, which currently fails because the `slack-health-rebuild` edge function imports a non-existent CORS module and never boots.

## Changes

### 1. New page + route
- Add `src/pages/SlackReview.tsx` — thin wrapper that renders the existing `SlackReviewTab` component inside `AppLayout`, with a page title/subtitle.
- Register `/slack-review` in `src/App.tsx` (lazy-loaded, wrapped in `ProtectedRoute`), gated to leadership viewers (admin/VSD/Cap lead/Sr/P BOPM) — same gate the tab already used.

### 2. Sidebar entry
- In `src/components/layout/AppSidebar.tsx`, under **Health & Reviews**, add `{ to: "/slack-review", icon: MessagesSquare, label: "Slack Review", routeKey: "rgy-health" }` right below "RGY Health". Add prefetch entry.

### 3. Remove from RGY Health
- In `src/pages/RGYHealth.tsx`, remove the `<TabsTrigger value="slack">` and the `<TabsContent value="slack">` block plus the `SlackReviewTab` import.

### 4. Fix Rebuild now
Root cause: `supabase/functions/slack-health-rebuild/index.ts` does `import { corsHeaders } from "npm:@supabase/supabase-js@2/cors"` — that subpath doesn't exist, so the function fails to boot and the button surfaces a generic error.

- Replace the import with an inline `corsHeaders` constant (same pattern every other function in this repo uses).
- Keep everything else in the function unchanged.

### 5. Verify
- After edits, click **Rebuild now** on the new Slack Review page and confirm it returns `{ ok: true, rows, hydrated }`; check edge function logs for a clean boot (no import error).
- Confirm the sidebar shows "Slack Review" for leadership users and the page renders the existing list + dashboard.

## Out of scope
- Any changes to the health computation logic, RGY rules, or UI of `SlackReviewTab` itself.
