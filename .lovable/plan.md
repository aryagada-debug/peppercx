## Goal

Today the app supports 3 effective personas (Admin, VSD, BOPM). Real users span **5 personas**:

1. **Admin / Central CX** — full org view (existing).
2. **VSD** — pod-wide deal & people scope (existing).
3. **BOPM** — own deals only (existing).
4. **Capability Leader** *(new)* — SEO Lead, Creative Lead (Art/Copy/Video), Editorial/Content Lead. Sees their **whole capability team** + every deal their team is staffed on.
5. **Capability Member** *(new)* — junior IC inside SEO / Creative / Editorial. Sees **only themselves** + the deals they are personally staffed on, with a heavy "my work" focus (tasks, allocations, hours).

Plus we wire all 5 into the admin Access Controls console, exactly the way VSD/BOPM are wired today.

---

## Persona-by-persona view spec

For each persona we define: **Home dashboard**, **Visible sections**, **Scope rule**, **Edit rights**.

### 1. Admin / Central CX (no change in scope, dashboard polished)

- Home: org KPIs, portfolio RGY heatmap, approvals queue, MBR compliance, hiring gaps, FX/revenue.
- Sections: all.
- Scope: everything.
- Edit: everything (governed by Access Controls).

### 2. VSD (existing — minor cleanup)

- Home: **My Pod** dashboard — deals in pod by RGY, MBR compliance for pod, pod revenue vs target, pod staffing utilisation, top risks.
- Sections: Dashboard, Clients, Staffing, Revenue, Targets, RGY, MBR, Slack, Onboarding, Deal Desk.
- Scope: deals where `vsd` matches OR a principal/senior BOPM that rolls up to them (current logic preserved). People scope: BOPMs in the pod + capability members staffed on pod deals.
- Edit: pod deals (RGY, MBR, staffing requests, targets).

### 3. BOPM (existing — minor cleanup)

- Home: **My Deals** dashboard — own deals by RGY, upcoming MBRs, my tasks, financial flags, staffing gaps on my deals.
- Sections: Dashboard, Clients, Staffing, RGY, MBR, Onboarding, Deal Desk, Central Cx.
- Scope: deals where their name appears in `principal_bopm` / `senior_bopm` / `bopm` (current logic preserved).
- Edit: own deals.

### 4. Capability Leader *(new)* — SEO Lead / Creative Lead / Editorial Lead

- Home: **My Team** dashboard
  - Team roster with utilisation bars (capacity heatmap filtered to their capability).
  - Deals their team is staffed on, grouped by RGY and by VSD pod.
  - Capability-specific quality signals (e.g. SEO: traffic delta if available; Creative: delivery RGY; Editorial: content RGY / consumption).
  - Hiring gaps for their capability.
  - Approvals queue scoped to their team's staffing requests.
- Sections: Dashboard, Clients (read), Staffing (full), Revenue (read, capability slice), Targets (read), RGY (capability dimension only — e.g. SEO Lead sees the SEO column prominently), MBR (read for deals their team is on), Onboarding (read), Deal Desk, SEO Staffing (SEO Lead only), Central Cx.
- **People scope:** any `staffing_people` whose `role_category` matches the leader's capability **and** who report into the leader (direct or transitive via `reporting_manager`). For SEO Lead → all `role_category='SEO'` people; Creative Lead → `Creative Art` + `Creative Copy` + `Video` (configurable); Editorial Lead → `Content` + `Content Strategy`.
- **Deal scope:** any deal where at least one person from their team scope appears in `staffing_assignments`. Deal cells (`bopm`/`vsd`) are NOT used to grant deal access for capability leaders — they're delivery leads, not account owners.
- Edit: assign/edit allocations for their team; mark hiring needs; edit their team's RGY dimension on a deal; cannot edit BOPM-owned fields (financials, contracts).

### 5. Capability Member *(new)* — junior SEO / Creative / Editorial IC

- Home: **My Work** dashboard
  - My weekly allocation grid (hours / % per deal).
  - My tasks (Kanban) across all my deals.
  - Upcoming MBRs on my deals (read-only).
  - Personal todos.
  - Smart nudges scoped to me.
- Sections: Home, Clients (own deals only, read), Staffing (only own row), MBR (own deals, read), RGY (own deals, read; can edit only their capability dimension if Access Controls allow), Central Cx, Onboarding (own deals, read).
- Hidden sections: Revenue, Targets, Deal Desk, SEO Staffing config, Hiring Gaps tab, Settings (except personal).
- **Deal scope:** deals where this person appears in `staffing_assignments` (we keep the current ghost-row guard by intersecting with deal sheet activity windows, see Tech notes).
- Edit: own task statuses, log hours, mark personal todos done, propose RGY for own capability on own deals.

---

## Operations flow between teams

```text
Admin/CX ──── governs ──── all
   │
   └── VSD ──── owns pod KPIs ──── BOPMs in pod
                                       │
                                       └── BOPM ──── owns deal P&L, RGY, MBR, contracts ──── deal-level
                                                       │
                                                       │ (requests delivery)
                                                       ▼
                              Capability Leader ──── owns delivery quality + team capacity ──── capability slice
                                       │
                                       └── Capability Member ──── executes work, logs hours ──── own slice
```

Concrete handoffs the app must support:

- **Staffing request:** BOPM raises a staffing review → routed to relevant Capability Leader(s) (SEO/Creative/Editorial) based on the SoW item's `team_capability`. Leader assigns a Capability Member from their roster. It has to then go to the Central CX for approval
- **RGY ownership split:** BOPM owns *Account Health, Customer, Finance/Billing, Receivables*. Capability Leader owns *their capability column* (SEO Lead → SEO/Consumption; Creative Lead → Design/Video/Copy; Editorial Lead → Content). VSD oversees all and can override.
- **MBR:** BOPM schedules + runs. Capability Leaders see read-only MBRs for their team's deals so they can prep delivery talking points.
- **Capacity alerts:** Capability Leader gets nudged when a member crosses 85% (yellow) or 100% (red); BOPM gets nudged when a deal has unfilled SoW lines past start date.
- **Hiring:** Capability Leader files `staffing_hiring_needs`; Admin approves; rolls into hiring gap dashboard.

---

## Data / role model changes

Add two roles to the `app_role` enum and surface them everywhere `member` / `user` are surfaced today:

```text
admin            → Admin / Central CX
member           → VSD                    (unchanged)
user             → BOPM                   (unchanged)
capability_lead  → Capability Leader      (NEW)
capability_member→ Capability Member      (NEW)
view_only        → Viewer                 (unchanged)
```

Two new tables to back capability scoping:

- `capability_groups` — `id`, `name` ("SEO", "Creative", "Editorial"), `role_categories text[]` (which `staffing_people.role_category` values belong), `lead_person_id`.
- `capability_memberships` — `person_id`, `capability_id`, `is_lead boolean`. Auto-seeded from `staffing_people.role_category` + `reporting_manager`; admin can edit in Settings.

Seed `route_visibility` rows for the two new roles for every `route_key` (mirroring the matrix in `AccessControlsTab.tsx`).

---

## Admin console changes (Access Controls + Users)

`src/pages/admin/AccessControlsTab.tsx`:

- Extend `PERSONA_COLUMNS` from 4 to **6** personas (Admin, VSD, BOPM, Capability Leader, Capability Member, Viewer). Each with icon, sublabel, and per-route view/edit option matrix.
- Extend `VIEW_OPTIONS` / `EDIT_OPTIONS` / `DEFAULT_SUMMARY` with sensible defaults for the two new roles (e.g. Capability Leader → Staffing "Own capability allocations", "Capacity heatmap"; RGY "Own capability dimension only").
- Persona pill grid: change `md:grid-cols-4` → `md:grid-cols-6`.
- Scope check ("refreshScope") add 2 demo personas — one SEO Lead and one SEO IC — so admins can verify deal counts the same way they do for VSDs/BOPMs today.

`src/pages/admin/UsersTab.tsx`:

- `Role` dropdown: add Capability Leader and Capability Member options. Auto-suggest the role when a newly-provisioned person's `role_category` is SEO/Content/Creative Art/Copy/Video and their `designation` matches a "Lead/Manager/Group Head/Director" pattern.
- Add a **Capability** column showing which capability_group the user belongs to (with an inline editor).

`src/hooks/useUserRole.ts`:

- Add `"capability_lead"` and `"capability_member"` to `AppRole`, `ROLE_LABELS`, `ROLE_ORDER`.
- New helpers: `isCapabilityLead`, `isCapabilityMember`, `myCapabilityIds`.

`src/hooks/useDealAccess.ts`:

- New branch for `capability_lead`: visible deals = union of deals having any assignment whose `person_id` is in the leader's team roster (from `capability_memberships` filtered by lead's capability).
- New branch for `capability_member`: visible deals = deals where `person_id = me` in `staffing_assignments`. We re-introduce the assignments-based path **only for this role** (BOPM still gated by deal-sheet cells per the previous fix), and add a freshness filter (`end_date IS NULL OR end_date >= now() - 30d`) to suppress ghost rows.

---

## Custom dashboards (page-level)

`src/pages/Index.tsx` already branches on role; add two more branches:

- `<CapabilityLeaderDashboard />` (new file under `src/components/dashboard/`): team utilisation, deals-by-RGY (capability-filtered), hiring gaps card, approvals card.
- `<CapabilityMemberDashboard />` (new file): my allocation grid (reuse `WeeklyStaffingGrid` filtered to me), my tasks Kanban (reuse `TaskKanban`), my MBR ticker, personal todos.

Home page (`src/pages/Home.tsx`) gets the same role-aware shell.

---

## Files to add / edit

**Add**

- `supabase/migrations/<ts>_capability_roles.sql` — enum values, `capability_groups`, `capability_memberships`, seed for SEO/Creative/Editorial, RLS, seed `route_visibility` rows.
- `src/components/dashboard/CapabilityLeaderDashboard.tsx`
- `src/components/dashboard/CapabilityMemberDashboard.tsx`
- `src/hooks/useCapability.ts` — exposes `myCapability`, `myTeamPersonIds`, `myTeamDealIds`.

**Edit**

- `src/hooks/useUserRole.ts` — new role types, labels, order.
- `src/hooks/useDealAccess.ts` — capability_lead and capability_member branches.
- `src/pages/admin/AccessControlsTab.tsx` — 6-persona matrix, defaults, scope check.
- `src/pages/admin/UsersTab.tsx` — new role options, Capability column.
- `src/components/layout/RoleSwitcher.tsx` — 5 personas in the "Viewing as" toggle for Admin.
- `src/pages/Index.tsx` and `src/pages/Home.tsx` — role-branched dashboards.
- `src/components/layout/AppSidebar.tsx` — already filters by `visibleRoutes`, no logic change beyond the new role's `route_visibility` seed.

No breaking changes to existing Admin / VSD / BOPM behaviour.

---

## Out of scope (future)

- Slack DM routing per persona (capability leaders get delivery alerts, BOPMs get account alerts).
- Capability-level revenue attribution (we'd need delivered hours × hourly_rate per capability per deal).
- Time-off / leave layer for capacity math.