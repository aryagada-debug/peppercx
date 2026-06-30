## Changes to Deal Handover wizard

### Step 2 — Client
- **New first selector**: "Existing client?" toggle / radio with two options: *Existing client* or *New client*.
  - If *Existing*: show a searchable dropdown of `clients` (name + pc_code). On select, autofill `company_name`, `industry`, `website` (read-only/locked, with an "edit" override). Also tag the handover to that client id so downstream deal creation links to the existing client instead of creating a duplicate.
  - If *New*: show empty fields as today.
- **Industry**: replace free text with a dropdown — `FMCG`, `BFSI`, `US B2B`, `India B2B`, `Miscellaneous`. (For existing clients with a different stored industry, prefill best-match; else default to *Miscellaneous*.)

### Step 3 — Documents
Each document slot (SoW, Strategy deck, Keywords, GEO audit, Fireflies) becomes "**Link or Upload**":
- Toggle per row: *Paste link* | *Upload file*.
- Uploads go to a private Storage bucket `handover-docs/<reference-or-temp>/<filename>`; stored URL = the public/signed URL (resolved on read). The existing `*_url` columns are reused — no schema change.

### Step 4 — Deal
- **Remove** the "Assigned VSD (suggested)" field entirely. Drop `vsd_suggested` from the form & submit payload (column stays in DB, just unused — Anirudh still fills `vsd_confirmed` later).
- **Auto-calc Total amount** when `deal_type = Retainer`:
  - `total_amount = MRR × duration_months` (recompute whenever either changes).
  - Field becomes read-only for Retainer (with a small "auto-calculated" hint); editable for Non-retainer.
- **Rename** "Start date" → "Actual / Tentative start date" (label only; same field).

### Files touched
- `src/components/handover/constants.ts` — add `INDUSTRY_OPTIONS`, drop `vsd_suggested` from required usage (keep field for back-compat in type, optional).
- `src/components/handover/HandoverWizard.tsx` — Step2 existing/new client picker + industry select; Step3 link/upload toggle; Step4 remove VSD field, retainer auto-calc, relabel start date; Review section updated.
- `src/pages/DealHandover.tsx` — drawer "Sales suggested" line removed.
- New tiny helper for Storage upload (inline in Step3) using existing supabase client.
- Storage bucket `handover-docs` (private) created via `supabase--storage_create_bucket`, with RLS allowing authenticated users to upload/read their own org's files.

### Out of scope
No DB schema changes; no changes to how Priyanka/Anirudh complete the handover or how the deal is auto-created.
