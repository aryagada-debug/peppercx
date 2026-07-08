## Goal
Give sales a **shareable public URL** (like the NPS survey link) that opens a Handover form. Each submission creates a new row in `deal_handovers` that shows up automatically in the existing **Queue** tab.

## Pattern (mirrors Pulse NPS)
- Public survey: `/s/:token` → `PublicSurvey.tsx` → edge function `survey-submit` (verify_jwt=false) → inserts row.
- Public handover: `/h/handover` → new `PublicHandover.tsx` → new edge function `handover-submit` (verify_jwt=false) → inserts row into `deal_handovers`.

Unlike NPS, no per-recipient token is needed — it's an open intake form. One stable link that anyone in sales can bookmark/share.

## Changes

### 1. Route (public, no auth)
`src/App.tsx`
- Add `const PublicHandover = lazy(() => import("./pages/PublicHandover"))`.
- Add `<Route path="/h/handover" element={<PublicHandover />} />` **outside** `AuthProvider` gating — put it alongside `/login` so it never requires a session.
- Extend `isPublicSurveyRequest` (or add a sibling `isPublicHandoverRequest`) so `/h/handover` is served without redirecting to `/home`. Simplest: add a matching `RouterSwitch` branch that returns `<PublicHandover />` when the path starts with `/h/handover`.

### 2. Page `src/pages/PublicHandover.tsx`
- Standalone page (no `AppLayout`, no sidebar), same clean shell as `PublicSurvey.tsx`: centered card, Pepper heading, subtitle "Deal Handover".
- Renders `HandoverWizard` with a new `mode="public"` prop.
- On success: swap to a "Thanks — your handover has been submitted" confirmation card with a "Submit another" button.

### 3. `src/components/handover/HandoverWizard.tsx`
- Add optional prop `mode?: "authed" | "public"` (default `"authed"`) and `onSubmitted?: () => void`.
- In `authed` mode: current behavior (insert via `supabase.from("deal_handovers")`).
- In `public` mode: call `supabase.functions.invoke("handover-submit", { body: { payload } })`. No auth header needed — anon key is public.
- No other UX changes.

### 4. Edge function `supabase/functions/handover-submit/index.ts` (new)
- `verify_jwt = false` (register in `supabase/config.toml`).
- CORS: allow `*`, POST/OPTIONS.
- Validate payload with zod:
  - required: `company_name`, `sp_name`, `sp_email` (email), `stage`, `bu`, `capability`, `deal_type`
  - length caps on all strings, contacts array ≤ 20, urls ≤ 500 chars
- Anti-abuse: reject if same `sp_email` submitted > 5 times in the last hour (count query on `deal_handovers`).
- Insert with service role: `submitter_user_id = null`, `status = 'submitted'`, `submitted_via = 'public_link'`, everything else from payload.
- Return `{ ok: true, reference }`.

### 5. DB migration
- `ALTER TABLE public.deal_handovers ADD COLUMN IF NOT EXISTS submitted_via text NOT NULL DEFAULT 'app';`
- No RLS changes: reads stay authed (existing policies); writes for public submissions go through the service-role edge function so RLS is bypassed safely.

### 6. Queue surfacing — `src/pages/DealHandover.tsx`
- Existing `loadRows()` already returns all rows newest-first, so public submissions show up automatically.
- Add a **"Copy public form link"** button in the header row (copies `${window.location.origin}/h/handover`, toasts "Link copied").
- Add a small "Public link" badge next to Company when `submitted_via === 'public_link'`.
- Include `submitted_via` in the `HandoverRow` type.

## Files
- add `src/pages/PublicHandover.tsx`
- edit `src/App.tsx`
- edit `src/components/handover/HandoverWizard.tsx`
- edit `src/pages/DealHandover.tsx`
- add `supabase/functions/handover-submit/index.ts`
- edit `supabase/config.toml` (verify_jwt=false for the new function)
- migration adding `submitted_via` column

## Out of scope
- Captcha, email verification, per-user tokens — can add later if abuse appears.
- Editing public submissions from the link.
