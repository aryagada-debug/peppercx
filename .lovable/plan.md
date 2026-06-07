## Unified RGY Marking — One Card, One Combined Issue

Today every R/Y click triggers the issue dialog, so users get a pop-up per dimension. Rework it so all 8 dimensions are marked in a single card (like staffing), and a **single combined Issues card** appears only when the user clicks "Review issues" — never auto-popping per click.

### New behavior

**Marking (auto-save, no pop-ups):**
- Clicks on the R / Y / G / ⊘ / ⋯ toggles still save the dimension immediately (same as today's `EditableRGY`).
- We **remove the per-save dialog trigger** (`setShowIssueForm(newlyRorY)` and the resulting `<Dialog>` `RGYIssueForm`). No more dialog appearing on each click.
- A subtle "Saved" pulse / toast confirms the write; the dot color updates instantly.

**Status bar (new, inline below the dimension grid):**
- A thin row showing counts: `2 Red · 1 Yellow · 4 Green · 1 Not Required`.
- If any dim is **Red** with no open `[RGY Health]` task: a warning chip "Issues missing for X red dimension(s)" + a primary button **"Review issues"**.
- If any dim is **Yellow** without an issue: a quieter chip "Optional: log context for X yellow dimension(s)" + secondary button **"Add context"**.
- If everything is Green / NA: a small "All clear" line, no button.

**Combined Issues card (`RGYCombinedIssuesDialog`):**
- Opens only when the user explicitly clicks **Review issues** / **Add context** (or from a small "Edit issues" link on the status bar). No auto-open from toggle clicks.
- Header lists every non-green dim with its current colour chip; user does NOT pick a dim per issue.
- One combined form, applied to all reds (and optionally yellows) in one go:
  - Issue date (defaults today)
  - Issue details (textarea) — required
  - Action plan (textarea) — required
  - Resolution due date
  - Status (Open / In Progress / Blocked)
  - Assignees (multi-select from deal team)
  - Optional sub-tasks list
- **On Save** the dialog:
  - Writes `issue_date / issue_details / action_plan / resolution_due_date / issue_status` onto the current week's `deal_rgy_weekly` row (same fields the old form wrote).
  - Creates a **single** `[RGY Health]` task tagged with all affected dim labels in the title (e.g. `[RGY Health] Content, SEO — <summary>`), so the existing Tasks tab and Green-gate validation continue to work unchanged.
  - Closes; the status bar updates to "Issue logged" with a link to view/edit it.

**Editing an existing issue:**
- Clicking the status bar's "Issue logged" link reopens the same combined dialog pre-filled from the current week's `deal_rgy_weekly` issue fields + linked task, so editing is one form, not many.

**Green-gate stays as today:** moving a dim from R/Y → G still triggers the existing `ResolveIssuesDialog` to close out the open `[RGY Health]` tasks. That's separate from this change.

### Where it applies (both)

1. **Deal Detail → RGY Health tab** (`src/pages/DealDetail.tsx`):
   - Remove the `<RGYIssueForm>` mounts (lines ~2314 and ~2911) and the `showIssueForm` auto-open logic in `handleRGYSave`.
   - Insert the new `<RGYStatusBar>` directly under `<EditableRGY>` and wire its buttons to the new `<RGYCombinedIssuesDialog>`.
2. **RGY Health page** (`src/pages/RGYHealth.tsx`):
   - Replace `RGYIssueFormDialog` (the per-deal dialog used at ~line 1862) with the same combined dialog. Cell clicks on the table continue to auto-save the colour; the dialog only opens when the user clicks the deal's "Review issues" affordance on the row's hover/action area.

### Components to add

- `src/components/rgy/RGYStatusBar.tsx` — the inline counts + CTA strip (pure presentational; takes current dim values + open issue + callbacks).
- `src/components/rgy/RGYCombinedIssuesDialog.tsx` — the single combined form, replacing both `RGYIssueForm` (inline in `DealDetail.tsx`) and `RGYIssueFormDialog` (inline in `RGYHealth.tsx`). Shared by both pages.

### Files to edit

- `src/pages/DealDetail.tsx` — drop `RGYIssueForm` component + both mounts + `showIssueForm`/`prevRGYSnapshot` auto-open paths; add `<RGYStatusBar>` + `<RGYCombinedIssuesDialog>`.
- `src/pages/RGYHealth.tsx` — drop `RGYIssueFormDialog`; wire the new combined dialog to a "Review issues" action on the row/dialog.
- `src/components/deals/EditableRGY.tsx` — no behavioural change (still auto-saves), but remove the inline "re-toggle to capture details" hint copy since the flow is now explicit via the status bar.

### Data / migration

- **No schema changes.** We continue to use the existing `deal_rgy_weekly` issue fields and the `[RGY Health]` task convention. The Tasks tab, Green-gate, RGY Health page table, and Leadership Intervention flow keep working unchanged.

### Out of scope

- Per-Yellow / per-Red sub-blocks (user chose "Single combined issue").
- Bulk-edit RGY across multiple deals at once.
- Touching the RGY history/trend views.
