# Plan: Service Line UI polish + Staffing picker filters by VSD pod & service-line eligibility

## 1. Deal Detail – "Service Line" row (Contract Details)

File: `src/pages/DealDetail.tsx` (~line 1451)

Match the row to the rest of the panel (Payment Terms / Duration / Start Date) — text only, no Select-trigger background or border. Add a small inline icon to indicate it is an editable dropdown.

- Replace the current `<Select><SelectTrigger className="h-7 ... w-[280px]">…</SelectTrigger></Select>` with a borderless trigger:
  - Use `SelectTrigger` with classes `h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 hover:text-primary text-xs text-foreground gap-1 w-auto max-w-[280px]` so it visually matches the `EditableCell` rows.
  - Place a small `<ChevronsUpDown className="h-3 w-3 text-muted-foreground" />` (or `Pencil` 3×3) at the right of the value as the affordance icon. Hide the default chevron by overriding `[&>svg]:hidden` or by using `<SelectPrimitive.Trigger>` directly. Simpler: keep `SelectTrigger`, but shrink default icon to `h-3 w-3` via `[&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60`.
  - Truncate long values with `truncate` and keep the `(legacy)` tag.
- Keep `SelectContent` and the `SERVICE_LINE_OPTIONS` list unchanged.

Result: the row reads as plain text aligned right, with a faint chevron icon — identical visual weight to Payment Terms / Duration cells.

## 2. Staffing – Filter person picker by VSD's pod & by service-line eligibility

Files:
- `src/components/staffing/MatrixTab.tsx` (PersonPicker, AddRoleRow, MatrixTab)
- (read-only reference) `src/data/staffingData.ts` for `Deal.serviceLineTagging`, `Deal.pod`, `Deal.vsd`

### 2a. Pass selected deal context to the picker

In `MatrixTab`, pass two new props down to every `<PersonPicker>` and `<AddRoleRow>`:
- `dealPod: string` — `selectedDeal?.pod || ""`
- `dealServiceLine: string` — `selectedDeal?.serviceLineTagging || selectedDeal?.capabilityLine || ""`
- `dealVsd: string` — `selectedDeal?.vsd || ""`

### 2b. Pod-restricted Sr/Principal BOPM and BOPM lists

Currently `peopleByVsd` is built only from existing assignments, so it misses unassigned BOPMs. Replace/augment with a true pod-membership map:

```ts
// In MatrixTab
const peopleByPod = useMemo(() => {
  const m: Record<string, Set<string>> = {};
  people.forEach(p => {
    const pod = (p.pod || "").trim();
    if (!pod) return;
    if (!m[pod]) m[pod] = new Set();
    m[pod].add(p.id);
  });
  return m;
}, [people]);
```

In `PersonPicker.filtered` (and `AddRoleRow`), when the role is one of `vsd | principal_bopm | senior_bopm | bopm` AND `dealPod` is set, intersect the candidate list with `peopleByPod[dealPod]`. Fall back gracefully if empty (show full list with a small note "No pod match — showing all").

### 2c. Service-line → designation/category eligibility

Add a Service-Line × Capability matrix (keys correspond to existing `ROLE_FILTER` group buckets). Booleans from the user's table:

```ts
// columns: Strategy, Content, SEO, Design, Video, Social, Performance, Influencer, CRM/Automation, ProjectMgmt
const SERVICE_LINE_CAPS: Record<string, Set<Capability>> = {
  "Integrated Retainers - Content + SEO + Social or Content Hubs":
      new Set(["Strategy","Content","SEO","Design","Social","ProjectMgmt"]),
  "Content Studio - Talent Onsite/Virtual":
      new Set(["Content","ProjectMgmt"]),
  "Pepper SEO - SEO + Content Retainer":
      new Set(["Strategy","Content","SEO","ProjectMgmt"]),
  "Pepper Content - Website/SEO Content":
      new Set(["Strategy","Content","SEO","ProjectMgmt"]),
  "Campaign Assets - Statics, Adapts, Asset Creation":
      new Set(["Design","ProjectMgmt"]),
  "Pepper Content - B2B Full Funnel":
      new Set(["Strategy","Content","SEO","Design","Performance","CRM","ProjectMgmt"]),
  "Light Video Production - Reels/YouTube/Podcast":
      new Set(["Strategy","Content","Video","Social","ProjectMgmt"]),
  "Creative/Social Media Retainer":
      new Set(["Strategy","Content","Design","Social","ProjectMgmt"]),
  "CRM/CLM Content - Lifecycle Marketing":
      new Set(["Strategy","Content","Design","CRM","ProjectMgmt"]),
  "Campaigns - Influencer Marketing/Social":
      new Set(["Strategy","Design","Social","Performance","Influencer","ProjectMgmt"]),
  "Heavy Video Production- Films/DVCs/TVCs":
      new Set(["Strategy","Content","Design","Video","ProjectMgmt"]),
  "Translation/Localisation":
      new Set(["Content","ProjectMgmt"]),
  "Other": new Set(["Strategy","Content","SEO","Design","Video","Social","Performance","Influencer","CRM","ProjectMgmt"]),
};
```

Map each `ROLE_COLS` group → capability bucket once:

```ts
const ROLE_GROUP_CAP: Record<string, Capability> = {
  "Leadership & PM": "ProjectMgmt",
  "Content": "Content",
  "SEO": "SEO",
  "Creative — Strategy": "Strategy",
  "Creative — Copy": "Content",
  "Creative — Art": "Design",
  "Production / Video": "Video",
  // Influencer Team → Influencer; Performance & Growth → Performance handled per-role
};
const ROLE_CAP_OVERRIDE: Record<string, Capability> = {
  influencer: "Influencer",
  perf_growth: "Performance",
};
```

Helper:
```ts
function isRoleAllowedForServiceLine(roleKey: string, serviceLine: string): boolean {
  if (!serviceLine) return true;                         // no SL set → don't restrict
  const caps = SERVICE_LINE_CAPS[serviceLine];
  if (!caps) return true;                                // legacy/unknown → don't restrict
  const grp = ROLE_BY_KEY[roleKey]?.group || "";
  const cap = ROLE_CAP_OVERRIDE[roleKey] || ROLE_GROUP_CAP[grp];
  if (!cap) return true;
  return caps.has(cap);
}
```

### 2d. Apply the filters

1. **AddRoleRow role dropdown** — filter `roles` prop through `isRoleAllowedForServiceLine(r.key, dealServiceLine)` so users can't pick a role outside the service-line scope. When the filter empties the list, show "No roles available for this service line".

2. **PersonPicker person list** — in `filtered`, after current `roleKey` narrowing:
   - For BOPM/VSD roles: intersect with `peopleByPod[dealPod]` when present.
   - For all roles: when service line is set, additionally restrict by capability. We already have category-based filtering via `ROLE_FILTER`; the SL check is an extra gate that only acts on the role's capability bucket (keeps existing designation matching intact).

3. Keep the existing "Show all" toggle (`showAllRoles`) — extend it to also bypass the pod and service-line restrictions, so users can override when needed.

### 2e. Visual cue

Below the picker search input, when filtering is active show a tiny muted line:
`Filtered by pod "<pod>" and service line "<short label>"` with a `Reset` link that toggles `showAllRoles`.

## Out of scope

- No DB schema changes.
- No changes to the matrix grid layout, only to the picker behavior.
- "Other" service line keeps the picker fully unrestricted.

## Files touched

- `src/pages/DealDetail.tsx` — Service Line row restyle.
- `src/components/staffing/MatrixTab.tsx` — pod map, SL→capability map, prop drilling, picker filtering, AddRoleRow filtering, visual cue.
