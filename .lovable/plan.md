## Add "Org Mapping" tab to each deal

A new tab inside Clients & Deals → Deal Detail that lets users map the client's stakeholders (champions, SPOCs, decision makers) with full CRUD, search, filters, and an inline detail editor.

### 1. Database (Lovable Cloud)

New table `deal_stakeholders`:
- `deal_id` (text, FK to deals)
- `name`, `role`, `function` (Marketing / Finance / Product / Technology / Legal / Ops / Other)
- `seniority` (e.g. C-1 · VP)
- `email`, `phone`, `linkedin_url`
- `decision_power` (int 1–5)
- `tags` (text[]) — SPOC / Champion / Not met / custom
- `notes` (text)
- `sort_order` (int)
- standard `id`, `created_at`, `updated_at`

RLS: same access pattern as other deal-scoped tables (any authenticated user with deal access can read/write; mirrors `deal_documents` policies).

### 2. New components

```
src/components/deals/orgmap/
  OrgMappingTab.tsx        // top-level: header, toolbar, stats, list
  StakeholderRow.tsx       // collapsed row + expandable inline detail
  StakeholderFilters.tsx   // search, function, power, export
  useStakeholders.ts       // CRUD hook (Supabase + react-query)
```

Reuses existing UI primitives (Input, Button, Badge, Popover, DropdownMenu, Textarea) so it inherits dark-mode tokens. The HTML mockup is used as a **layout reference only** — colors, fonts, borders are mapped to `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `primary`, etc. No hard-coded hex values.

### 3. Features (matching the mockup)

- **Header**: title "Org map · {client name}", subtitle "{n} stakeholders · last updated …", "All saved" indicator, primary "Add person" button.
- **Toolbar**: search by name/role/email, Function filter, Power-level filter, Export (CSV download of current view).
- **Stats strip**: Total stakeholders, Functions covered, SPOCs count, Not-yet-met count.
- **Table** with columns: Name & role (avatar with initials + tag chips), Contact (email/phone), Function (color dot), Seniority, Power (5-dot indicator), row menu.
- **Expandable detail row**: inline editable fields for email, phone, LinkedIn, function (Select), seniority (Select), 1–5 power picker, tags editor (add/remove chips), notes (textarea). Edits autosave on blur via the hook. Footer actions: Duplicate, Copy email, Delete (with confirm).
- **Add another person**: appends a new blank stakeholder, auto-opens its detail panel for editing.
- **Empty state** when a deal has no stakeholders yet.

### 4. Wiring

- Add `"Org Mapping"` to the `TABS` tuple in `src/pages/DealDetail.tsx` (between "MBR" and "Requests").
- Render `<OrgMappingTab dealId={dealId} clientName={deal.clientName} />` when `activeTab === "Org Mapping"`.
- No changes to other tabs.

### 5. Verification

After implementation: open a deal → switch to Org Mapping → add, edit (inline), filter, search, export, delete a stakeholder. Reload page and confirm persistence. Confirm dark-mode styling.

### Files to add/edit

- migration: `deal_stakeholders` table + RLS
- new: `src/components/deals/orgmap/OrgMappingTab.tsx`, `StakeholderRow.tsx`, `StakeholderFilters.tsx`, `useStakeholders.ts`
- edit: `src/pages/DealDetail.tsx` (add tab + render)
