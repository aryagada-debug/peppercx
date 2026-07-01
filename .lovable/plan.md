## Handover form changes + richer notification email

### 1. Sales team region → dropdown (India / Global)
`src/components/handover/HandoverWizard.tsx` Step 1
- Replace the free-text "Sales team / region" input with a `Select` limited to **India** and **Global**.
- Make it required (add to `validateStep(0)`).

### 2. Industry: rename "Miscellaneous" → "Others" + specify
`src/components/handover/constants.ts`
- Change `INDUSTRY_OPTIONS`: replace `"Miscellaneous"` with `"Others"`.
- Add `industry_other: string` to `HandoverForm` + `emptyHandover()`.

Step 2 UI
- When `industry === "Others"`, show a second required "Please specify" text input bound to `industry_other`.
- Legacy path in `pickExisting`: if existing client industry isn't in the enum, set industry to `"Others"` and prefill `industry_other` with the original value.
- Persist `industry_other` in the insert payload (stored inside `deal_notes` prefix or as part of `industry` string like `"Others: <text>"` since we won't add a DB column unless asked — simplest: store the effective industry as `"Others: <text>"` in the `industry` column so downstream reads still work).

### 3. Client step upgrades
`Step2` (New client mode only; existing client keeps its behavior)

**Company location**
- Add required `company_location` dropdown (India cities + a "Global / Other" option → also allow free text via combobox). Concrete list: Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai, Pune, Kolkata, Ahmedabad, Singapore, Dubai, London, New York, San Francisco, Other. If "Other", show a text field.
- Add `company_location: string` + `company_location_other: string` in `HandoverForm`.

**Website auto-pull from web**
- Add a "Fetch from web" button beside the Website field. Calls a new **edge function `handover-company-lookup`** with `{ company_name }`.
- Edge function uses the Lovable AI gateway (`google/gemini-2.5-flash` with Google Search grounding) to return `{ website, summary, industry_guess, products[] }`.
- On success, prefill `website` (if empty) and populate an AI summary card (below).

**AI company summary**
- New read-only card under company fields showing three sub-sections filled by the edge function:
  - **Industry** (what sector)
  - **What they do** (1–2 sentences)
  - **Products / offerings** (bullet list)
- Store the whole summary as `company_ai_summary: string` on the form; include it in the payload (append to `deal_notes` prefixed with `"AI summary:\n…"` so no schema change is needed).
- "Regenerate" button to re-run the lookup.

### 4. Total amount always editable
`Step4`
- Remove the `disabled={totalLocked}` on the total-amount `CurrencyInput`.
- Keep the auto-compute effect but treat it as a suggestion: only auto-fill when `total_amount` is currently `null`, not on every MRR/duration change. Change hint to "Suggested = MRR × Duration (editable)".

### 5. Notification email includes all form details
`src/lib/appEmail.ts`
- Extend `sendAppEmail` call in `HandoverWizard.submit` to send the full payload (sales region, all documents, contacts, deal details, AI summary, etc.) under `payload.details`.

`supabase/functions/send-app-email/index.ts` — `handover_received` branch
- Render an HTML details table listing every submitted field:
  - Salesperson block (name, email, region, handover date)
  - Client block (company, industry [+ specify], location, website, AI summary)
  - Contacts table (name / role / email / phone)
  - Documents (SoW, strategy deck, keywords, GEO audit, Fireflies) as clickable links
  - Deal block (stage, BU, capability, deal type, MRR, duration, total amount, start date, notes)
- Append this block below the existing CTA. Recipients stay as-is (Arya, Anirudh, Priyanka from `HANDOVER_LEADS`).

### Technical notes
- No DB migration required (industry-other and AI summary encoded into existing text columns).
- New edge function `handover-company-lookup` (public, `verify_jwt = false` default): uses `LOVABLE_API_KEY` already configured; returns JSON.
- Edge function output validated with Zod before returning.
- All new inputs added to `validateStep` for required-field enforcement.
