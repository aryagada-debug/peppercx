## Goal
Hide these routes from both **Capability Lead** and **Capability Member** roles: Revenue, Central CX, Slack Health, Deal Desk, SEO Staffing, GM2 Calculator, Settings.

## Current state
Several rows in `route_visibility` currently grant these roles access (e.g. capability_lead has edit on central-cx, deal-desk, gm2-calculator, seo-staffing; both roles see central-cx and settings). The app's `ProtectedRoute` + sidebar both honor `visibleRoutes` derived from this table, so flipping the rows is sufficient.

## Change
Single DB migration updating `route_visibility`:

```sql
UPDATE public.route_visibility
SET visible = false, access_mode = 'hidden'
WHERE role IN ('capability_lead','capability_member')
  AND route_key IN ('revenue','central-cx','slack-health',
                    'deal-desk','seo-staffing','gm2-calculator','settings');
```

No code changes. Per-user overrides in `user_route_overrides` are preserved (admins can still grant exceptions individually).

## Verification
- Re-query `route_visibility` to confirm all 14 rows are `hidden`.
- Use the role switcher to view as Capability Lead and Capability Member — sidebar should hide the 7 routes, and direct URL navigation should redirect to `/clients`.
