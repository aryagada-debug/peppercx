## Add collapsible issue rows to the RGY Health Table

In `src/pages/RGYHealth.tsx` (Table tab, rows starting ~line 1753), add per-deal expandable rows that reveal the logged RGY issue inline.

### Changes
1. **Expand state** — add `const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set())` with a toggle helper.
2. **Chevron toggle** — in the Client cell (first visible column), prepend a small chevron button when the deal has any content in `rgy_issue_details` or `rgy_action_plan`. Clicking toggles that deal's id in `expandedIssues`. Deals without an issue show no chevron (no empty toggle).
3. **Collapsible detail row** — right after each `<tr>` in the map, render a second `<tr>` when the deal is expanded. It uses `colSpan={visibleColCount}` and contains a compact panel showing:
   - Issue date (formatted) + last updated by
   - Issue Details (whitespace-pre-wrap)
   - Action Plan (whitespace-pre-wrap) 
   - Any non-Green dimensions listed as pills for context
   - "Edit issue" button that calls `setCombinedIssuesDeal(deal)` (reusing existing dialog)
4. **Auto-expand on new issue** — after `setCombinedIssuesDeal` saves, no change needed; user can re-open via the same button in the collapsible.

### Notes
- Purely presentational; no schema or query changes.
- Uses existing tokens (`bg-secondary/30`, `border-border`) and existing `rgy_issue_*` fields already on `DealWithRGY`.
- The existing per-cell tooltip on RGY dimensions stays as-is.
