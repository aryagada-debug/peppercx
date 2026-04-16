

# Populate People & Reporting from Google Sheet

## What Changes

Replace the hardcoded `DEFAULT_PEOPLE` array in `src/data/staffingData.ts` with the 185 people from the published Google Sheet. Update the `DEPARTMENTS` list to match the new department names. Update department-to-roleCategory mapping so existing staffing, deals, and assignment features continue to work.

## Data Mapping

The spreadsheet has 185 rows with columns: **Emp Code, Name, Department, Designation, Reporting Manager**. These map to the `Person` type as follows:

| Sheet Column | Person Field | Notes |
|---|---|---|
| Emp Code (e.g. P394) | `id` | Use as-is for stable IDs |
| Name | `name` | Direct |
| Department | `department` | Direct — replaces old department names |
| Designation | `designation` | Direct |
| Reporting Manager | `reportingManager` | Direct |

Fields not in the sheet will get sensible defaults:
- `roleCategory`: Derived from department (e.g. "Capability - SEO Team" → "SEO", "Delivery Ops and CS" → "Operations")
- `roleTitle`: Derived from designation using existing title-to-role mapping
- `pod`: Derived from reporting manager chain or set to department shortname
- `region`: "India" default (US team members identified by known names)
- `leaving`/`tbh`: `false`
- `band`: Empty string (not in sheet)

## Steps

### 1. Update `DEPARTMENTS` constant
Replace with the actual departments from the sheet:
- Capability - Creative Team
- Capability - Digital Strategy
- Capability - Quality Team
- Capability - SEO Team
- Capability - Video Production Team
- Central COE & Planning
- Delivery Ops and CS
- Engineering
- Finance, Legal and Admin
- HR & TA
- Leadership
- Marketing and Demand Generation
- Product - Design, Management
- Revenue - NN India Sales
- Revenue - NN India Demand Gen
- Revenue - NN US Sales
- Revenue - NN US Demand Gen
- Supply Acquisition and Operations

### 2. Replace `DEFAULT_PEOPLE` array
Generate all 185 Person entries from the CSV data with proper roleCategory mapping.

### 3. Update role category mapping
Add a `departmentToRoleCategory` function to map the new department names to existing `RoleCategory` values. Departments like "Engineering", "HR & TA", "Finance, Legal and Admin", "Leadership", etc. map to "Other".

### 4. Fix assignment references
The existing `MANUAL_ASSIGNMENTS` reference old person IDs (e.g. "p_neema"). Create an ID alias map so old IDs resolve to new emp-code-based IDs, or update the assignment references.

### 5. Clear and re-seed database
Since the `staffing_people` table data will change completely, the seeding logic will detect count=0 after we clear it, and re-seed with the new data. Add a version check or force re-seed.

### 6. Update assignee dropdowns across the app
Ensure that anywhere people names are used as dropdown options (deal assignees, CX task assignees, staffing views), they pull from the same `staffing_people` data source.

## Files Modified
- `src/data/staffingData.ts` — New DEPARTMENTS, DEFAULT_PEOPLE, updated mappings
- `src/hooks/useStaffingData.ts` — Force re-seed with new data (version bump)

## Files Unchanged
- Settings page, Staffing views, Deal detail — these already read from `useStaffingData()` hook and will automatically reflect the new people data.

