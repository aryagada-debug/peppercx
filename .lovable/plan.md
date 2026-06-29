## Sales Handover → Deal Creation Flow

A new sidebar page **"Deal Handover"** where any signed-in user can submit a handover form. Arya, Anirudh and Priyanka receive an email, then complete their respective fields. Once both `Deal ID + Deal Name` (Priyanka) and `VSD` (Anirudh) are filled, the deal is auto-created in Clients & Deals.

---

### 1. Database (one migration)

New table `public.deal_handovers`:

- Salesperson block: `submitter_user_id`, `sp_name`, `sp_email`, `sp_team`, `handover_date`
- Client block: `company_name`, `industry`, `website`
- Documents: `sow_url` (required), `strategy_deck_url`, `keywords_url`, `geo_audit_url`, `fireflies_url`, `docs_notes`
- Deal block: `stage`, `bu`, `capability`, `deal_type`, `mrr`, `total_amount`, `duration_months`, `start_date`, `vsd_suggested`, `deal_notes`
- Contacts: `contacts jsonb` (array of `{name, role, email, phone}`)
- Completion fields (filled later):
  - `deal_id` (Priyanka), `deal_name` (Priyanka), `deal_id_filled_at`, `deal_id_filled_by`
  - `vsd_confirmed` (Anirudh), `vsd_filled_at`, `vsd_filled_by`
- Status: `status` text ∈ `submitted | partially_filled | created | cancelled`
- `created_deal_id` (FK-style text → `staffing_deals.id`), `created_at`, `updated_at`

RLS / GRANTs:
- `authenticated` may `INSERT` (anyone can submit) and `SELECT` (everyone tracks status).
- `UPDATE` restricted to admins + the three named handover-leads (via email match on `auth.users.email`).
- `service_role` full access for the edge function.
- `updated_at` trigger.

### 2. Auto-create deal trigger

DB trigger on `deal_handovers AFTER UPDATE`: when `deal_id IS NOT NULL AND deal_name IS NOT NULL AND vsd_confirmed IS NOT NULL` and `status <> 'created'`:
1. Insert into `clients` if `company_name` isn't already there → get `client_id`.
2. Insert into `staffing_deals` with: `id = deal_id`, `account = company_name`, `deal_name`, `vsd = vsd_confirmed`, `deal_status = stage` (mapped to a valid lifecycle status), MRR/total/duration/start, `client_id`, `created_at`.
3. Seed leadership `staffing_assignments` rows for VSD (matching existing wizard behaviour).
4. Update handover row: `status = 'created'`, `created_deal_id = deal_id`.

### 3. Edge function `handover-notify`

Triggered from the client after submit AND after each update. Sends emails via the existing `send-app-email` central mailbox to:
- `Arya.gada@peppercontent.io`, `Anirudh@peppercontent.io`, `Priyanka.sharma@peppercontent.io`

Event types:
- `handover.submitted` → all three
- `handover.deal_id_filled` → Anirudh (his turn) + sales submitter cc
- `handover.vsd_filled` → Priyanka + sales submitter cc
- `handover.completed` → all three + submitter, with link to the created deal

### 4. Frontend

New route `/deal-handover` + sidebar entry `Deal Handover` (icon: `ClipboardCheck`).

`src/pages/DealHandover.tsx` — two tabs:

**Tab "Submit"** — multi-step form mirroring the uploaded HTML (Salesperson → Client → Documents → Contacts → Deal). Re-built with our shadcn components + tailwind tokens (purple primary, flat borders). Validation: required marks, URL/email validators. SoW link required.

**Tab "Queue"** — table of handovers with columns: Company, Submitted by, Date, Deal ID (badge if missing), VSD (badge if missing), Status. Row click opens a side drawer:
- Read-only view of all submitted info.
- Inline editable: `Deal ID` + `Deal Name` (visible to Priyanka/admin), `VSD` (Anirudh/admin) — picker from staffing_people with VSD role.
- "Created" banner with deep-link to the deal once `status = 'created'`.

Permission gating on the editable fields done by email match against `auth.jwt() -> 'email'` + admin role.

### 5. Files to add/edit

- `supabase/migrations/<ts>_deal_handovers.sql` (table, grants, RLS, trigger fn, trigger)
- `supabase/functions/handover-notify/index.ts`
- `supabase/functions/send-app-email/index.ts` — add new event templates (`handover.*`)
- `src/pages/DealHandover.tsx`
- `src/components/handover/HandoverForm.tsx`
- `src/components/handover/HandoverQueueTable.tsx`
- `src/components/handover/HandoverDetailDrawer.tsx`
- `src/hooks/queries/useDealHandovers.ts`
- `src/components/layout/AppSidebar.tsx` — add nav item
- `src/App.tsx` — add route

### Open assumption
Handover edits map `stage` → a valid `staffing_deals.deal_status` (default "New Deal in SLA/PO"). Let me know if a different default is preferred.
