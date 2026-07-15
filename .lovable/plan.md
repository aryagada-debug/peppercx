# Contacts: unified filters + polished By-deal view

## Global filter bar (persists across all sub-tabs)
Move filters out of individual tabs into a single toolbar that lives above the `Tabs` control. All three tabs (By deal, Contacts, Insights) read from the same state:

- **Search** — free-text (matches client, deal, VSD, BOPM, and — in Contacts tab — contact name/email/role)
- **VSD** — single-select from deals in scope
- **BOPM** — single-select from deals in scope (splits comma-joined names)
- **Status** — single-select (defaults to "Active Deal")
- **Show missing only** — toggle. In By-deal: deals with 0 contacts OR any incomplete contact. In Contacts: incomplete contacts. In Insights: deals with 0 contacts.

Remove per-tab duplicates:
- Contacts tab: drop Team / Region / VSD / Influence selects and its own search (keep Export button).
- Insights tab: drop status/VSD/"missing only" row (keep the summary counter).
- By-deal tab: drop its status/search/missing toggle added last iteration.

## By-deal tab UI overhaul
Restructure to feel like a scrollable ledger:

- Column order: **Client → Deal → VSD → BOPM → Region → Status → Contacts → Incomplete** (chevron on the far left).
- Wrap the table in a fixed-height scroll container (`max-h-[calc(100vh-320px)] overflow-auto`) with a sticky header row (`sticky top-0 bg-muted/40 z-10`) so the header stays visible while scrolling.
- Sortable column headers using the existing `ColHeader` component (already used in Insights) — sort by client, deal, VSD, BOPM, status, contact count, incomplete count.
- Remove the inline "Add" button from the deal row.

### Expanded deal panel (Org-Mapping style)
When a deal row expands, render an Org-Mapping-style card list of contacts (not a subtable):

- Each contact is a row card matching `OrgMappingTab`'s `Row` component: avatar with initials + tinted background, name + inline "Incomplete" chip + tags, role beneath, function dot + name, seniority, 5-dot influence meter, contact icons (mail/phone), and a `…` dropdown (Duplicate / Copy email / Delete).
- Clicking a contact expands an inline `DetailPanel` identical to the one in Org Mapping (Identity & contact + Tags & notes columns, Field components, tag popover, save/delete buttons).
- **"Add contact" button appears at the bottom** of the contact list (like Org Mapping's "Add another person" strip), not on the deal row.
- Empty state: dashed panel with "No contacts mapped yet" + a prominent "Add contact" button.

### Reuse strategy
Extract the shared pieces from `OrgMappingTab.tsx` into `src/components/deals/orgmap/StakeholderList.tsx`:
- `Row`, `DetailPanel`, `Field`, `Stat`, and the constants (`FUNCTIONS`, `SENIORITIES`, `FUNCTION_DOT`, `TAG_STYLES`, `AVATAR_COLORS`, `initials`, `avatarColor`).
- Component API: `<StakeholderList stakeholders={list} onAdd={fn} onUpdate={(id, patch) => …} onDelete={fn} onDuplicate={fn} showHeader />`.
- `OrgMappingTab` becomes a thin wrapper (Header + Toolbar + Stats + `<StakeholderList>`).
- `ByDealTab` mounts `<StakeholderList>` inside each expanded deal row, wired to inline Supabase writes on `deal_stakeholders`.

## Files touched
- `src/pages/Contacts.tsx` — lift filter state to page level; pass shared filters to all three tab components; remove per-tab filter UI.
- `src/components/contacts/ByDealTab.tsx` — new column order, sticky sortable header, scroll container, Org-Mapping-style expanded contacts, filter props.
- `src/components/deals/orgmap/StakeholderList.tsx` — new shared component (extracted from `OrgMappingTab.tsx`).
- `src/components/deals/orgmap/OrgMappingTab.tsx` — refactor to use `StakeholderList`.

## Non-goals
- No schema changes.
- No changes to Insights sub-table layout beyond filter/scoping consolidation.
- No change to the Contacts tab table columns beyond removing its local filters.
