# Sales → Delivery Handover — Wizard Rebuild

Rebuild the **Submit handover** tab on `/deal-handover` as a multi-step wizard exactly per spec. The existing Queue tab, drawer (Priyanka edits Deal ID/Name; Anirudh confirms VSD), auto-create trigger, and lead notifications stay as-is.

## 1. Database (migration)

Extend `public.deal_handovers`:

- Add `reference text` (unique, nullable until first submit so old rows survive; new inserts always set it).
- Add CHECK constraints with the **exact** option lists from the spec:
  - `stage` ∈ {Pre-Proposal, Proposal, Negotiation, (Free) Pilot before SLA, (Paid) Pilot before SLA, SLA back-and-forth, SLA signed; awaiting contraction, SLA signed & contraction is on the platform, SLA signed & contraction is on the platform AND escalated, ''}
  - `bu` ∈ {Pepper SEO/GEO + Content, Pepper Content, Pepper Creative, Integrated, Content Studios, Others, Not Applicable, ''}
  - `capability` ∈ the 13 listed lines + Other + ''
  - `deal_type` ∈ {Retainer, Non-retainer, ''}
  - `vsd_suggested` ∈ {Aamir Khan, Aditya Shaw, Sneha Iyer, Neema Jayadas, Sumit Shekhawat, ''}
- Add CHECK: when `deal_type = 'Retainer'` then `mrr IS NOT NULL`; when `'Non-retainer'` then `mrr IS NULL`.
- Keep `mrr` / `total_amount` as `numeric` storing integer rupees (form rounds before save).
- Empty strings ('') stay allowed so the legacy rows + drafts continue to load.

No changes to RLS, the auto-create trigger, or email templates.

## 2. Frontend wizard (`src/pages/DealHandover.tsx` + new `src/components/handover/`)

Replace the existing single-page submit form with a wizard:

```
[ 1 Salesperson ] → [ 2 Client ] → [ 3 Documents ] → [ 4 Deal ] → [ Review ] → [ Submitted ]
```

Shared shell:
- Progress indicator (5 dots + labels). Completed steps are clickable to jump back; future steps locked until reached.
- Sticky footer: **Back** / **Continue** (Continue → **Submit** on Review).
- Per-step validation on Continue: collect errors, scroll to + focus the first invalid field (using refs map keyed by field id).
- Form state held in a single object via `useState`; not persisted across reloads.

### Step 1 — Salesperson
Fields: `sp_name*`, `sp_email*` (email regex), `sp_team`, `handover_date*` (date, defaults today).

### Step 2 — Client
Fields: `company_name*`, `industry`, `website*`.
Contacts (JSONB on row): repeatable list, min 1. "Add another contact" appends; "Remove" shows only when >1. Each contact: `name*`, `role`, `email*` (regex), `phone`.

### Step 3 — Documents
`sow_url*`, `strategy_deck_url`, `keywords_url`, `geo_audit_url`, `fireflies_url`, `docs_notes` (textarea).

### Step 4 — Deal
- `stage*`, `bu*`, `capability*` as Selects with the exact lists above.
- `deal_type*` as a 2-option radio/segmented control (Retainer | Non-retainer).
- `mrr` currency — visible & required only when Retainer; hidden + cleared on switch to Non-retainer.
- `total_amount*` currency.
- `duration_months` (number).
- `start_date*` (date, defaults today).
- `vsd_suggested` Select with the 5 names (optional, with "— None —").
- `deal_notes` textarea ("Special terms / context").

**Currency input** (`CurrencyInput` component): masks input to digits, formats display with `Intl.NumberFormat('en-IN')`, stores integer rupees in form state. Helper text below shows `= ₹X.XX Cr` when value ≥ 1,00,00,000 else `= ₹X.XX L` (hidden when 0/empty).

### Review step
Read-only summary, grouped into 4 cards (Salesperson / Client / Documents / Deal) each with an **Edit** button that jumps to its step. Contacts rendered as a list. Currency values shown formatted.

### Submit
On Submit:
1. Generate `reference = HND-${year}-${5 alphanum upper}` and `submitted_at = new Date().toISOString()` (we still rely on DB `created_at` server-side, but show this in the UI).
2. Insert into `deal_handovers` with all spec fields + `reference`.
3. Fire the existing `sendAppEmail` `handover_submitted` notification (unchanged).
4. Move to **Submitted** step.

### Submitted step
- Shows the reference prominently.
- **Copy handover summary** → builds a plain-text digest of all fields + contacts and writes to clipboard (toast on success).
- **New handover** → resets form (dates back to today, `deal_type` cleared, MRR hidden, contacts reset to single empty row) and returns to Step 1.
- Link to the Queue tab.

## 3. Files touched

- New migration: constraints + `reference` column on `deal_handovers`.
- `src/pages/DealHandover.tsx` — replace the Submit-tab body with `<HandoverWizard />`; Queue tab and drawer untouched.
- New `src/components/handover/HandoverWizard.tsx` (state + step routing + submit).
- New `src/components/handover/steps/{Step1Salesperson,Step2Client,Step3Documents,Step4Deal,StepReview,StepSubmitted}.tsx`.
- New `src/components/handover/CurrencyInput.tsx` (Indian grouping + L/Cr helper).
- New `src/components/handover/constants.ts` (option lists, VSD names, contact factory, reference generator).

## Out of scope
Visual polish beyond default shadcn components, draft autosave, edit-after-submit, and any change to the Queue/drawer behavior or the auto-create trigger.
