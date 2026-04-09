

# Major Feature Expansion: Editable Clients, Deals, Tasks & Financials

Large build spanning new database tables, CRUD forms, a Kanban board, and editable data. Implementing in **4 phases** across multiple messages.

---

## Phase 1: Database Tables + Client & Deal CRUD

### New tables (migration)

**`clients`** — First-class client entity
- id (uuid), name, website, sales_poc, industry, pc_code, account_status, signing_entity, geography
- daily_poc_name/phone/linkedin, hom_poc_name/phone/linkedin
- lead_source (Inbound/Outbound/Referral), competitor_involved, notes
- Additional: billing_address, gst_number, contract_signed_date, nda_signed (boolean)

**`deal_tasks`** — Kanban task board per deal
- id (uuid), deal_id, title, description, stage (To Do/In Progress/In Review/Done/Dropped)
- assignee, start_date, end_date, urgency (Low/Medium/High/Critical)
- logged_hours (numeric), sort_order

**`deal_financials`** — Replaces separate Revenue+Targets tabs
- id (uuid), deal_id, month, contracted, consumption, planned_gm_pct, actual_gm_pct
- invoiced, received, outstanding, invoice_date, received_date, outstanding_date

**Alter `staffing_deals`**: Add start_date, end_date, payment_terms, pepper_business_unit, projected_outcomes (jsonb), success_metrics (jsonb), baseline_metrics

**Alter `deal_rgy_weekly`**: Add account_health, finance_billing, capability_seo, capability_creative, plan_of_action

**Alter `staffing_people`**: Add hourly_rate (numeric default 0)

### UI: Client creation
- "+ Add Client" button on Clients page → Dialog form with all fields listed in the request
- Saves to new `clients` table

### UI: Deal creation wizard (multi-step flow)
- Available from page header AND inside each expanded client
- If no client exists → client form first → then deal form (seamless flow)
- **Step 1**: Client select/create
- **Step 2**: Deal basics (name, type, start/end date, MRR, values, VSD, BOPMs, payment terms, Pepper BU dropdown: SEO/GEO+Content | Content | Creative | Integrated | Content Studio, POD)
- **Step 3**: SoW line items (scope, revenue share, team capability) — add multiple rows
- **Step 4**: Projected outcomes + success metrics (metric name, value, unit, frequency) + baseline text

---

## Phase 2: Editable Deal Detail + Financials

### All Deal Detail fields become editable
- Overview: click-to-edit on every metadata card, inline SoW row CRUD
- Staffing: "+ Add Team Member" with person search, allocation % (auto-calc hrs/week from 40hr base), cost = hrs × hourly_rate

### Revenue + Targets → single "Financials" tab
Editable monthly table: Contracted, Consumption, Planned GM%, Actual GM%, Invoiced, Received, Outstanding with dates

### Editable RGY in Overview section
- 5 dimensions: Account Health (VSD), Delivery (BOPM), Finance/Billing, Capability-SEO, Capability-Creative
- R/Y/G selector per dimension
- If Y or R → text field for Plan of Action appears
- Auto-saves to `deal_rgy_weekly` for current week

---

## Phase 3: Task Kanban (ClickUp-style)

### New "Tasks" tab in Deal Detail
- 5-column Kanban: To Do | In Progress | In Review | Done | Dropped
- "+ Add Task" per column
- Task card: title, assignee badge, urgency pill, date range, logged hours
- Task creation dialog: title, rich description (checkboxes supported), assignee (from deal's staffing), dates, urgency
- Hours logging per task → total displayed on card, feeds into timesheet data
- Drag-and-drop or click-to-move between stages

---

## Phase 4: Staffing & Onboarding Enhancements

- Hourly rate per person, cost calculations in deal staffing tab
- Group assigned people by team (Account Mgmt, SEO, Content, Creative, Ops)
- Revenue managed = deal MRR × allocation %
- Onboarding flow for new accounts (checklist auto-populated based on deal type)

---

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Create `clients`, `deal_tasks`, `deal_financials`; alter `staffing_deals`, `deal_rgy_weekly`, `staffing_people` |
| `src/pages/Clients.tsx` | Add client/deal creation dialogs, link to `clients` table |
| `src/pages/DealDetail.tsx` | Make all editable, add Financials + Tasks tabs, RGY in Overview |
| `src/hooks/useDealDetail.ts` | CRUD for financials, tasks, RGY, SoW |
| `src/hooks/useClients.ts` | New: clients table CRUD |
| `src/components/deals/ClientFormDialog.tsx` | Client creation/edit form |
| `src/components/deals/DealFormWizard.tsx` | Multi-step deal creation |
| `src/components/deals/TaskKanban.tsx` | Kanban board component |
| `src/components/deals/TaskCard.tsx` | ClickUp-style task card |
| `src/components/deals/TaskFormDialog.tsx` | Task creation/edit dialog |
| `src/components/deals/FinancialsTab.tsx` | Monthly financials table |
| `src/components/deals/EditableRGY.tsx` | Inline RGY editor with plan of action |
| `src/data/staffingData.ts` | Update Deal interface with new fields |
| `src/hooks/useStaffingData.ts` | Add hourly_rate, deal create support |

## Implementation Order
1. **Phase 1** — DB migration + client/deal creation forms (this message)
2. **Phase 2** — Editable detail + financials tab
3. **Phase 3** — Task kanban board
4. **Phase 4** — Staffing rate + onboarding enhancements

