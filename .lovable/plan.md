# Contacts: per-deal rollup + role-scoped access

## Goals
1. Add a new "Deals" view inside `/contacts` that lists every deal the viewer can see, with an expandable row showing that deal's contacts pulled from Org Mapping (`deal_stakeholders`) in a tabular format.
2. Flag deals with **no contacts** and contacts with **missing values** (name, role, email, LinkedIn, function, seniority, city).
3. Allow inline **Add contact** on any deal row — writes to the same `deal_stakeholders` table used by Org Mapping, so both views stay in sync.
4. Open the Contacts page to **VSDs and BOPMs** (not just admins). They see only deals in their own scope.

## Scope of changes

### `src/pages/Contacts.tsx`
- Remove the admin gate. Replace `canView = isAdmin || isActuallyAdmin` with visibility for anyone who has at least one visible deal via `useDealAccess()`.
- Scope the queries: filter `staffing_deals` and `deal_stakeholders` to `visibleDealIds` when not admin. Admins keep the full view.
- Add a third tab **"By deal"** (default for non-admins) alongside existing Contacts / Insights tabs.
- The By-deal tab renders a table of deals (Deal, Client, VSD, BOPM, Region, Contact count, Missing-info count, Status). Each row expands to show that deal's stakeholders inline (Name, Designation, Team, Email, Phone, LinkedIn, Influence, Location) with an amber "Incomplete" chip when required fields are missing (reuse the completeness rule from `OrgMappingTab`).
- Each expanded row has an **Add contact** button that inserts a new `deal_stakeholders` row for that deal (mirrors `useStakeholders.add()` — sets `deal_id`, `client_name`, next `sort_order`) and opens a compact inline editor row (Name, Role, Email, LinkedIn, Function, Seniority, City, Phone, Influence) that saves on blur.
- Inline edit for existing contacts (same fields), saving via `supabase.from("deal_stakeholders").update(...)`.
- Empty-state row per deal: "No contacts mapped — Add contact".
- Refetch after mutations so the count/missing chips update; keep it consistent with `OrgMappingTab` by using the same table so opening a deal's Org Map afterwards shows the same rows.

### `src/components/layout/AppSidebar.tsx`
- Show the Contacts link whenever the viewer has any visible deal (drop the `isActuallyAdmin` gate). Admins still see everything.

### Access control
- Non-admins: filter deals by `useDealAccess().visibleDealIds`; filter stakeholders by `deal_id IN (visibleDealIds)`.
- Editing (add / update contact) is allowed for VSDs and BOPMs on their own deals — matches Org Mapping behavior (which already lets them edit stakeholders on deals they can view).

## Non-goals
- No schema change. `deal_stakeholders` already has all fields needed.
- No changes to the existing Org Mapping tab or `useStakeholders` hook — both views read/write the same rows so sync is automatic.
- No change to Insights tab logic beyond re-scoping to visible deals for non-admins.

## Technical notes
- Completeness check: reuse the `isStakeholderComplete` predicate from `OrgMappingTab.tsx` (extract to `src/components/deals/orgmap/useStakeholders.ts` so both files import it).
- Stakeholder writes go straight to Supabase (same pattern as `useStakeholders`), then a lightweight local refetch of `deal_stakeholders` scoped to `visibleDealIds`.
- Expand state kept in a `Set<string>` of deal IDs, same pattern already used for `expandedVsds` in Insights.
