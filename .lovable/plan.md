

# Complete People Data with Editable Fields

## What needs to change

### 1. Extend Person interface (`staffingData.ts`)
Add new fields to match the provided data:
- `department` — e.g. "Delivery Ops", "Capability - SEO Team", "Creative Strategy Team"
- `designation` — e.g. "Vertical Service Delivery Leader", "Senior BOPM"
- `reportingManager` — e.g. "Priya Berde", "Aamir Khan"
- `band` — e.g. "L0" through "L8"

### 2. Replace/update DEFAULT_PEOPLE array (`staffingData.ts`)
Replace the entire people array with ~120 people from the pasted data, properly mapped:
- Department → `department` field + derive `roleCategory` from department mapping (e.g. "Delivery Ops" → "Operations", "Capability - SEO Team" → "SEO", "Capability - Quality Team" → "Content", "Creative Strategy Team" → "Creative Strategy", "Capability - Creative Team" → "Creative Art"/"Creative Copy", "Capability - Video Production Team" → "Video", "Content Strategy Team" → "Content")
- Designation → `designation` + derive `roleTitle` from designation (e.g. "Senior BOPM" → "Senior BOPM", "SEO - Practice Head" → "SEO Leader")
- Reporting Manager → `reportingManager`
- Band → `band`
- Derive `pod` from reporting manager chain (VSD association)

### 3. Update People by Role view (`Staffing.tsx`)
Replace the current table columns with the new fields and make them editable:
- **Name** — text, editable inline
- **Department** — dropdown with all unique departments from data
- **Designation** — dropdown with designations filtered by department
- **Reporting Manager** — dropdown showing all people as options
- **Band** — dropdown (L0–L8)
- **Deals** count and **Total Alloc.** — read-only, computed
- **Status** — existing (Active/Leaving/TBH)

Each cell in Department, Designation, Reporting Manager, and Band will be a click-to-edit dropdown. On click, it shows a `<select>` with the valid options; on change, it updates the person record in state.

### 4. Add Content Strategy as a category
The data includes "Content Strategy Team" as a distinct department. Add it to `ROLE_CATEGORIES` and map relevant role slots.

### Files modified
- `src/data/staffingData.ts` — Extended Person type, full people array with ~120 entries, new category
- `src/pages/Staffing.tsx` — People view table with editable dropdown columns

