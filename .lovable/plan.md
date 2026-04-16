

# Sync RGY Data from Google Sheet to Database

## What This Does
Extracts RGY health values for 8 dimensions (Overall Customer, Internal, Content, SEO, Supply, Copy, Design, Video) from the shared Google Sheet and upserts them into the `deal_rgy_weekly` table. This data already feeds both the **RGY Health** page and the **Deal Detail > RGY Health** tab.

## Data Mapping

Sheet values will be mapped as follows:
- "Green" → `G`
- "Yellow" → `Y`
- "Red" / "Hot red" / "Hot Red" → `R`
- "Not Applicable" / "Undetermined" / blank → `NA`

The sheet columns map to DB columns:
| Sheet Column | DB Column |
|---|---|
| Overall Customer RGY | `customer` |
| Internal RGY | `internal` |
| Content RGY | `content` |
| SEO RGY | `seo` |
| Supply RGY | `supply` |
| Copy | `copy` |
| Design | `design` |
| Video RGY | `video` |

## Implementation Steps

1. **Parse the CSV** — Run a script to parse the fetched CSV, extract deal IDs and 8 RGY columns
2. **Map values** — Convert sheet text values to G/Y/R/NA
3. **Upsert to `deal_rgy_weekly`** — For each deal, find the latest existing RGY entry and update the 8 dimensions. If no entry exists, insert one with a current `week_start` date
4. **Also sync issue tracking fields** — The sheet includes Issue Date, Issue Details, Discussed Action Plan, Action Plan, Resolution Due Date, and Status — these will be synced to corresponding columns in `deal_rgy_weekly`
5. **Verify** — Query the DB to confirm the sync count

## No Code Changes Needed
Both the RGY Health page and the Deal Detail RGY Health tab already read from `deal_rgy_weekly` and display these 8 dimensions. The sync is purely a data operation.

## Files Modified
- None (data-only operation via script + DB insert tool)

