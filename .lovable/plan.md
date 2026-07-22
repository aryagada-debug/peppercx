## Goal
Restrict the SEO KRAs section to admins plus Mayur and Vedanga (identified by their login emails), and record who filled each review.

## Access control
- Define an allowlist constant: `SEO_KRA_REVIEWER_EMAILS = ["mayur@peppercontent.io", "vedanga@peppercontent.io"]` (confirm exact addresses on implementation; will match case-insensitively).
- New hook `useCanAccessSeoKras()` returning true if user is admin OR their auth email is in the allowlist.
- `src/App.tsx`: replace admin-only guard on `/seo-kras` with the new hook.
- `src/components/layout/AppSidebar.tsx`: show the "SEO KRAs" link when `useCanAccessSeoKras()` is true (not admin-only).

## Reviewer selector on Enter Review tab
- Add a "Reviewer" dropdown to `src/components/seo-kras/EnterReviewTab.tsx` next to the existing scorecard/year/quarter selects.
- Options: Mayur, Vedanga (label = display name, value = email). Admins see both plus their own name if outside the allowlist.
- Default: the current signed-in user's email if it's in the allowlist; otherwise first option.
- Value is passed to `useSaveSeoKraReview` and persisted on the review row.

## Data model
- Add `reviewer_email text` (nullable) and `reviewer_name text` (nullable) columns to `public.seo_kra_reviews`.
- Update `useSeoKraReviews` select + `useSaveSeoKraReview` payload to include these fields.
- Surface "Reviewed by …" chip on the summary card and (small text) in the Dashboard table row tooltip.

## Out of scope
- No changes to scoring logic, scorecards, or Dashboard trend charts.
- No new user_roles entry — allowlist stays in code so it's easy to edit later.

## Technical notes
- Auth email available via `supabase.auth.getUser()` or existing `AuthProvider` context (`useAuth()`).
- RLS on `seo_kra_reviews` currently restricts writes to admins; will extend policy so allowlisted emails can insert/update/select via a `has_role` OR `auth.jwt() ->> 'email' = ANY(...)` check. Simplest: a SECURITY DEFINER function `public.is_seo_kra_reviewer()` used inside the RLS policy.
