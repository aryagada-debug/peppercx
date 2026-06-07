## Leadership Intervention Needed (RGY)

A lightweight flag any user can raise on a deal when leadership help is needed, visible to Admin / VSDs / Capability Leads with a status workflow and comment thread.

### Data model

New table `rgy_leadership_interventions`:
- `deal_id` (FK → staffing_deals)
- `rgy_week` (date, optional — auto-stamped from current RGY snapshot if raised from RGY tab)
- `title`, `description`
- `urgency` — High / Medium / Low
- `status` — Open → Acknowledged → In Progress → Resolved
- `raised_by_user_id`, `raised_by_name`
- `resolved_at`, `resolved_by_user_id`
- standard `created_at` / `updated_at`

New table `rgy_leadership_intervention_comments`:
- `intervention_id` (FK, cascade delete)
- `user_id`, `author_name`
- `body`
- `created_at`

RLS:
- Any authenticated user can INSERT (raise) and SELECT their own raised items.
- Admin + users whose role matches VSD / Capability Lead patterns (reuse logic from `visible_deal_ids_for_user`) can SELECT/UPDATE all rows and post comments.
- Status changes restricted to leadership viewers; raiser can edit title/description while status = Open.

### UI

**Raise entry points (both):**
1. Deal Detail → RGY tab: a "Flag Leadership Intervention" button next to the weekly RGY header. Pre-fills `deal_id` + `rgy_week`.
2. RGY Health page: a small flag icon button on each deal row → opens same dialog pre-filled with that deal.

**Raise dialog (minimal):**
- Deal (locked when pre-filled, otherwise searchable)
- Title (required)
- Description (textarea, required)
- Urgency (High/Med/Low, default Medium)
- Submit → toast confirmation.

**Leadership queue — new page `/leadership-interventions`** (sidebar entry visible only to Admin + VSD + Capability Leads):
- Filter chips: Status, Urgency, Pod/VSD, Raised by me
- Table: Urgency · Deal · Title · Raised by · Raised on · Status · Comments count
- Row click → side drawer with full description, status switcher (Open/Ack/In Progress/Resolved), and a comment thread (textarea + post).
- Empty state when no items.

**Deal Detail RGY tab:** small badge under the week showing count of open interventions on this deal; clicking expands an inline list (same drawer).

### Access control

Sidebar visibility + page guard use the same "leadership viewer" check:
- `has_role(uid, 'admin')` OR
- user's `staffing_people` role matches VSD / Capability Lead patterns (group head, managing editor, SEO leader, principal/senior BOPM owning a tree — mirrors existing `visible_deal_ids_for_user` logic).

A new SQL helper `is_leadership_viewer(_user_id uuid)` will encapsulate this and be used in RLS + a `useIsLeadershipViewer()` hook in the client.

### Files to add / edit

- Migration: create both tables, GRANTs, RLS policies, `is_leadership_viewer()` SQL function, `updated_at` triggers.
- `src/hooks/useIsLeadershipViewer.ts`
- `src/components/rgy/RaiseInterventionDialog.tsx`
- `src/components/rgy/InterventionDrawer.tsx` (details + comments + status)
- `src/pages/LeadershipInterventions.tsx` (queue page)
- `src/App.tsx` — add route
- `src/components/layout/AppSidebar.tsx` — add gated nav entry
- `src/pages/RGYHealth.tsx` (or equivalent) — add flag button per row + count badge
- Deal Detail RGY tab component — add "Flag Leadership Intervention" button + open-count badge

### Out of scope (for this pass)

- Notifications/Slack pings on new interventions (can be added later via existing slack infra).
- Attachments, requested-leader field, target dates (deferred per "Minimal" choice).
