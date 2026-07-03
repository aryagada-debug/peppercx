# Suggest designations only, no people

Right now the Deal Handover "Suggested staffing" card computes a "Common people" column from historical assignments and, on "Send all to Staffing", writes one suggestion row per suggested person. The Staffing "Suggested from handover" panel then shows those names and pre-fills the Add Staffing Member dialog with the person.

Change: suggestions become role-only. The admin picks the actual person in Staffing.

## Changes

**1. `src/components/handover/SuggestedStaffingCard.tsx`**
- Remove the "Common people" column from the table (keep Role, Typical %, Frequency, action).
- Stop computing `common` people; also drop the VSD-subtree/BOPM person filtering and the `nameById`/person fetch — no longer needed.
- Keep the "VSD locked to X" helper text (informational only).
- In `sendAllToStaffing`, write exactly one row per suggested role with `person_name: ""` (no fan-out per person). Upsert conflict key stays `staffing_deal_id,role_key,person_name`.
- Keep the auto-inserted VSD row as a role entry with no person.

**2. `src/components/staffing/SuggestedStaffingPanel.tsx`**
- Render suggestions as role-only rows: primary line shows the humanized role; secondary line shows "Suggested {pct}% · pick a person".
- Remove the "— {person_name}" suffix and the `initialPerson` prefill passed to `AddStaffingMemberDialog` (leave `initialPersonName` undefined so the admin selects).
- Keep Confirm/Edit and Dismiss actions and the applied/dismissed status updates unchanged.

## Out of scope
- No DB schema changes. Existing `staffing_suggestions` rows with `person_name` continue to render (the person suffix is simply hidden going forward).
- No changes to the notification email or handover form fields.
