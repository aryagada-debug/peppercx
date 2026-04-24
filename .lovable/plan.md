## Goals

1. **Clients & Deals page**: Slim down the KPI strip (cards take less width).
2. **Type column**: Make it an inline editable Retainer / Non-Retainer dropdown.
3. **Deal Detail → Contract Details**: Convert "Service Line" from free text to a fixed-list dropdown.
4. **Deal Detail → RGY History**: Replace/augment the current week-list table with a trend-oriented view that shows what moved week-over-week.

---

## 1. Smaller KPI cards (`src/pages/Clients.tsx`)

Current KPI tiles use `flex-1 min-w-[120px]` so they stretch to fill all free space in row 1. We will:
- Drop `flex-1` and reduce `min-w-[120px]` → `min-w` ~88px so each card sizes to its content.
- Wrap the KPI group in `flex-none` (not `flex-1`), so the row can give extra space back to the title and action buttons.
- Tighten paddings: `px-2 py-1` → `px-1.5 py-0.5`; icon chip `p-1` → `p-0.5`; icon `h-3.5 w-3.5` → `h-3 w-3`.
- Keep the same tints, labels, and values — purely a sizing change.

---

## 2. Editable Type column (`src/pages/Clients.tsx`)

Currently the `dealType` cell is a static pill. Replace with a `Select` (same compact style as the Status cell already in the table):
- Options: `Retainer`, `Non-Retainer`.
- On change → call existing `updateDeal(deal.id, { dealType: v })` and toast "Type updated".
- Style preserved as a small pill (`text-[10px]`, accent for Retainer, secondary for Non-Retainer) by rendering the trigger as a borderless button colored to match the current pill.

---

## 3. Service Line dropdown in Deal Detail (`src/pages/DealDetail.tsx`)

Replace the free-text `EditableCell` for Service Line in Contract Details (line ~1280) with a `Select` bound to `serviceLineTagging`. Options (exact list, in order):

```
Integrated Retainers - Content + SEO + Social or Content Hubs
Content Studio - Talent Onsite/Virtual
Pepper SEO - SEO + Content Retainer
Pepper Content - Website/SEO Content
Campaign Assets - Statics, Adapts, Asset Creation
Pepper Content - B2B Full Funnel
Light Video Production - Reels/YouTube/Podcast
Creative/Social Media Retainer
CRM/CLM Content - Lifecycle Marketing
Campaigns - Influencer Marketing/Social
Heavy Video Production - Films/DVCs/TVCs
Translation/Localisation
Other
```

- Defined as a shared constant `SERVICE_LINE_OPTIONS` near the top of `DealDetail.tsx` so it can be reused if needed elsewhere.
- If the existing value is not in the list (legacy data), it is still shown as the current selection and a one-time "(legacy)" badge is appended in the trigger; selecting any new value migrates it via existing `handleDealFieldSave("serviceLineTagging", v)`.
- The trigger uses the same compact styling as other dropdowns on the page (h-7, text-xs, right-aligned).

---

## 4. RGY History → Trend view (`src/pages/DealDetail.tsx`)

Today `GroupedRGYHistory` renders one row per week with the latest snapshot per dimension. To answer "what moved", we will pivot the data: **rows = dimensions (Customer, Internal, Content, SEO, Supply, Copy, Design, Video), columns = weeks (most recent N on the right)**. This is a small heatmap that makes movement obvious at a glance.

### Layout

```text
Dimension   W-7  W-6  W-5  W-4  W-3  W-2  W-1  This wk   Δ
Customer     G    G    Y    Y    R    Y    G     G       ↑ improved
Internal     G    G    G    G    G    G    G     G       — stable
Content      Y    G    G    G    G    Y    Y     R       ↓ worsened
SEO          G    G    G    G    G    G    G     G       — stable
Supply       G    G    G    Y    G    G    G     G       — stable
Copy         G    G    G    G    G    G    G     G       — stable
Design       Y    Y    Y    G    G    G    G     G       ↑ improved
Video        G    G    G    G    G    G    G     G       — stable
```

- Each cell is the small G/Y/R/NA chip already used.
- Δ column compares this week vs the previous non-empty week using a numeric mapping G=3, Y=2, R=1, NA=0: `↑ improved` (green), `↓ worsened` (red), `— stable` (muted). Hover tooltip: "Was Y last week, now R".
- A second compact strip above the heatmap shows **"Movers this week"**: only the dimensions whose status changed vs the previous week, e.g. `Content: Y → R`, `Design: Y → G`. Empty state: "No changes this week".
- A view toggle at the top right of the RGY History card lets the user switch between **Trend** (new default) and **Weekly log** (the existing `GroupedRGYHistory` table), so historical drill-down with issue/action plan/status is still one click away.
- Issue / Action Plan / Due / Status columns are not lost — they remain available in the **Weekly log** view and are also surfaced as a small expander under any week column the user clicks in the trend heatmap (popover with that week's issueDetails / actionPlan / issueStatus).

### Data shape

Build a memoized structure from the existing `rgyWeekly` array:
1. Group by `weekStart`, keep the latest entry per week (sorted by `created_at desc`, take first).
2. Sort weeks ascending; take the last 8 (configurable) for the heatmap.
3. For each dimension key (`customer, internal, content, seo, supply, copy, design, video`), build an array of statuses aligned to the week list.
4. Compute Δ from the last two populated weeks per dimension.

No DB changes required.

---

## Files to edit

- `src/pages/Clients.tsx` — KPI sizing + editable Type cell.
- `src/pages/DealDetail.tsx` — Service Line dropdown + new `RGYTrendView` component and toggle in the RGY History section. `GroupedRGYHistory` is kept for the Weekly log view.

No database, hooks, or types changes are required.
