# Add Deal Metadata Columns + Kindred Companion UX for Accounts Tab

## What Changes

### 1. Add visible columns for Business Unit, Capability Line, PC Code, Deal Name, Deal Master Status

These fields already exist on the `Deal` interface (`businessUnit`, `capabilityLine`, `pcCode`, `dealName`, `dealStatus`). They just need to be displayed as columns in the Accounts table and made editable via dropdowns.

**Columns to add** (after Deal ID, before Account):

- **PC Code** — editable text input (click-to-edit)
- **Pepper Business Unit** — dropdown with unique values from data: "Integrated", "Pepper SEO/GEO + Content", "Pepper Creative", "Content Studios", "Others"
- **Capability Line** — dropdown with unique values from data: "Integrated Retainers", "SEO + Content Retainer", "Campaign Assets", "Creative/Social Media Retainer", "Content Studio - Talent", "Website/SEO Content", "Heavy Video Production", "Light Video Production", "Campaigns - Influencer", etc.
- **Deal Name** — editable text input (click-to-edit, truncated)
- **Deal Master Status** — dropdown: "Active Deal", "Deal Completed Successfully", "Deal Churned / Lost", "Deal Disputed", "New Deal in SLA/PO", "New Deal"  
  
Also, ensure you take and pre-fill those dropdowns with data that already exists and should not be blank

### 2. Restyle inline staffing to match Kindred Companion UX

Replace the current staffing interaction (click person name list to assign) with the Kindred Companion pattern:

**In the role slot cells (table columns):** Show `PersonSel`-style dropdown selects directly — a `<select>` with `<optgroup>` for real people, leaving, and TBH. Next to each dropdown, a small `<input type="number">` for allocation % (like Kindred's `inp-n` pattern). A small "✕" button to remove.

**In the expanded deal row:** Same pattern — role-grouped sections with `<select>` dropdowns for person + `<input>` for %, plus "+ Add" buttons per role group. Revenue cards showing MRR/Deal Value. This replaces the current click-to-open person list.

**Key UX changes:**

- Person assignment uses `<select>` dropdown (not a scrollable button list)
- % is edited via a small inline number input (not click → separate input toggle)
- Dropdowns show optgroups: real people, ⚠ Leaving, 📋 TBH
- Both table cells and expanded row use the same dropdown pattern

### 3. Make deals state mutable

Change `const [deals] = useState(...)` to `const [deals, setDeals] = useState(...)` so business unit, capability line, PC code, deal name, and deal master status can be edited inline.

### Files Modified

- `src/pages/Staffing.tsx` — Add new columns to accounts table header/body, add dropdown/input editing for deal fields, restyle person assignment cells to use `<select>` + `<input>` pattern matching Kindred Companion, make deals mutable

### Technical Details

- Extract unique business units and capability lines from deals data via `useMemo` for dropdown options
- Deal Master Status options derived from the uploaded image: `["Active Deal", "Deal Completed Successfully", "Deal Churned / Lost", "Deal Disputed", "New Deal in SLA/PO", "New Deal", "Repeat Deal", "Pilot"]`
- `PersonSel`-like inline component: groups people by status (active / leaving / TBH) using `<optgroup>`
- Allocation % input: small 44px-wide number input with `%` suffix, updates on change
- The `colSpan` on expanded rows will increase to accommodate new columns