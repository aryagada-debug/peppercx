## Goal

Generate a detailed Excel file every day with **one row per deal** and **one column per staffing role**. Each role cell lists every person staffed on that deal in that role (with allocation %). Available for download from the app and refreshed automatically.

## What the Excel looks like

### Columns

**Deal identity (left side)**
- Deal ID • PC Code • Account • Deal Name • Pod • Geo • Deal Status • Staffing Status • MRR • Total Deal Value • Start Date • End Date

**Leadership (one column each)**
- VSD • Principal BOPM • Senior BOPM • BOPM

**Capability roles (one column each — derived from all role keys in `staffing_assignments`)**
- SEO Capability Leader • SEO Growth Lead • SEO Operations • Content Capability Leader • Content Lead • Content Editor • Video Capability Leader • Video Editor • Creative Producer • Creative Strategist • Copywriter • CD/SCD Copy • CD/SCD Design • ACD/AGH Design • Graphic Designer • AD Creative Producer • Influencer Team • Performance Marketing Team
- (Any new role keys auto-appear as new columns the next day.)

**Meta (right side)**
- # of People Staffed • Total Allocation % • Snapshot Date

### Cell format

If multiple people share a role on a deal, they're concatenated:
`Prithvi Pujari (2.5%), Asha Rao (10%)`
Empty roles show as blank.

### One reference row (real data from your DB right now)

```text
Deal ID:               id_332_wrrot
Account:               Akeyless
Deal Name:             Backlinking Upsell
Pod:                   US B2B
Deal Status:           Active Deal
MRR:                   —
VSD:                   Neema Jayadas
Principal BOPM:        (empty)
Senior BOPM:           Anshika Sharma, Vivek Teotia
BOPM:                  (empty)
SEO Growth Lead:       Prithvi Pujari (2.5%)
Content Lead:          Maleeha Mukhtar (2.5%)
(other role columns):  (empty)
# People Staffed:      4
Total Allocation %:    5.0
Snapshot Date:         2026-06-08
```

## How it works

1. **Edge function `staffing-daily-export`** queries `staffing_deals` + `staffing_assignments` + `staffing_people`, pivots assignments by normalized `role_key`, builds the workbook with `xlsx` (SheetJS via esm.sh), and uploads `staffing-export-YYYY-MM-DD.xlsx` to a new private storage bucket `staffing-exports/`.
2. **Daily cron** at 06:00 IST (00:30 UTC) calls the function. (Uses `pg_cron` + `pg_net`, same pattern as other scheduled jobs.)
3. **Settings → "Staffing exports" panel** (admins only) shows the last 14 snapshots from the bucket with date, size, and a Download button. A **"Generate now"** button runs the function on demand and refreshes the list.
4. Exports are kept for 30 days; older files auto-deleted by the same function on each run.

## Technical notes

- All active + closed deals included by default; a future filter can scope to active-only if you want.
- Role columns are built dynamically from a small allow-list of `normalize_staffing_role_key()` values so spelling variants ("Sr. BOPM" vs "senior bopm") collapse into the same column.
- Read-only operation — no writes to `staffing_deals` or `staffing_assignments`, so this can't repeat the June 8 incident.
- File download via signed URL (60 min expiry); bucket stays private.

## Out of scope (ask if you want them)

- Per-week / per-month historical comparison sheet.
- People-level pivot (one row per person, deals as columns).
- Email/Slack delivery of the daily file.
