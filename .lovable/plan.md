

# MBR Tracker — Import Deal Data & Build Holistic Dashboard

## Overview

Import all active Retainer deals from the existing `staffing_deals` database table into the MBR Tracker. Add missing columns (Principal BOPM, Senior BOPM, BOPM, Customer Status, Customer Type, Service Line Tagging, Deal Value Lost, Net Deal Value) to the deals table. Create a new `mbr_entries` table for weekly MBR tracking per deal. Build a 3-tab dashboard matching the screenshot layout.

## Database Changes

### 1. Add missing columns to `staffing_deals`

New columns via migration:
- `principal_bopm` (text, default '')
- `senior_bopm` (text, default '')
- `bopm` (text, default '')
- `customer_status` (text, default '') — maps to "Customer Status" from sheet
- `customer_type` (text, default '') — maps to "Customer Type"
- `service_line_tagging` (text, default '')
- `deal_value_lost` (numeric, nullable)
- `net_deal_value` (numeric, nullable)

### 2. Create `mbr_entries` table

```text
mbr_entries
├── id (uuid, PK, default gen_random_uuid())
├── deal_id (text, FK → staffing_deals.id)
├── week_start (date) — Monday of MBR week
├── status (text: Done / Not Done / Not Required)
├── mode (text: In-Person / Virtual / null)
├── notes (text, nullable)
├── updated_by (text) — VSD or BOPM name
├── created_at, updated_at (timestamps)
└── UNIQUE(deal_id, week_start)
```

Public RLS policies (matching existing pattern). Enable realtime.

### 3. Seed deal data from Excel

Parse the uploaded XLSX "Live Revenue Tracker_Deal level" sheet using pandas, then upsert into `staffing_deals` — mapping the new columns (Principal BOPM, Senior BOPM, BOPM, Customer Status, Customer Type, Service Line Tagging, Deal Value Lost, Net Deal Value) plus updating existing fields (MRR, Duration, Deal Values) where they have data in the sheet.

## Frontend — MBR Tracker Page (3 Tabs)

### Tab 1: VSD Summary (default) — matches screenshot

- **Metric cards**: Total Retainer Accounts, MBRs Done, Not Done, Pending to Update
- **VSD summary table**: columns = VSD, Retainer Accounts, MBRs Done, Not Done, Pending to Update
- **Stacked horizontal bar chart** per VSD (green = Done, red = Not Done) built with CSS divs
- **Week selector** (defaults to current week, Monday-based)

### Tab 2: Deal-Level Tracker

- Table of all active Retainer deals from `staffing_deals`
- Columns: PC Code, Deal ID, Account, Deal Name, VSD, Sr. BOPM, BOPM, MRR, Status (dropdown), Mode, Notes
- Inline status update — upserts into `mbr_entries`
- Filters: VSD, Business Unit, Status

### Tab 3: History / Trends

- Week-over-week completion rate
- VSD-level heatmap across weeks

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add columns to `staffing_deals` + create `mbr_entries` table |
| Data seed (via exec) | Parse XLSX, upsert deal data with new columns |
| `src/data/staffingData.ts` | Add new fields to `Deal` interface |
| `src/hooks/useStaffingData.ts` | Update mappers for new Deal fields |
| `src/hooks/useMBRData.ts` | New hook: fetch MBR entries, upsert status |
| `src/pages/MBRTracker.tsx` | Complete rewrite with 3-tab dashboard |

## Technical Details

- MBR entries are per-deal per-week — deals without an entry for the selected week show as "Pending to Update"
- VSD grouping uses the `vsd` field already on `staffing_deals` (Aamir Khan, Aditya Shaw, Neema Jayadas, Sumit Shekhawat, etc.)
- The 121 active retainer deals already in the DB will be the base; the Excel import will update their financial fields and add the BOPM hierarchy
- Week picker auto-generates Mondays; current week is default

