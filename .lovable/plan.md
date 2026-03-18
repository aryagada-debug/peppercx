

# Staffing Module Enhancement Plan

## Overview
Six changes: (1) Revenue capacity per designation, (2) Auto-staff deals from VSD name matching, (3) Inline deal expand for staffing, (4) Remove BW Rules tab, (5) Full-field Add/Edit Person modal, (6) Tiered reporting-manager capacity view.

## 1. Revenue Capacity by Designation (not just Role Category)

**Current**: `RevenueCapacityTarget` only has `roleCategory` + `targetDealValuePerPerson`. One target per category.

**New**: Change model to `{ department, designation, targetDealValuePerPerson }` so every unique designation within a department has its own editable revenue capacity target. The table shows designations grouped under department headers, with roll-up totals to the department leader (derived from `reportingManager` chain). A "Leader Roll-up" summary section shows each VSD/capability leader's total actual vs total target across their direct + indirect reports.

**Files**: `staffingData.ts` (update `RevenueCapacityTarget` interface, seed defaults per designation), `RevenueCapacityTab.tsx` (rebuild table grouped by department → designation, add leader roll-up view).

## 2. Auto-Staff Deals from VSD Field + Name Matching

**Current**: ~396 deals in `allDeals.ts` have `vsd` field as a string name, but only ~20 deals (d1–d20) have actual `StaffingAssignment` entries. The rest show "Staff" buttons.

**New**: On app init, auto-generate VSD role assignments for every deal by fuzzy-matching `deal.vsd` to the closest person name in the people array (using normalized lowercase comparison, handling partial names like "Vanshika Khandelia" → `p_vanshika`). Also auto-generate BOPM assignments where the deal's VSD maps to a pod, and we pick the principal/senior BOPM from that pod. Set allocation to 0% as default (editable).

**Files**: `staffingData.ts` — add a `generateAutoAssignments(deals, people)` function that runs at export time and merges results into `DEFAULT_ASSIGNMENTS`. Uses string similarity (Levenshtein or normalized includes) to match `deal.vsd` name → person ID.

## 3. Inline Deal Expand for Staffing (Accounts Tab)

**Current**: Clicking "Staff" opens a modal to assign one person. No deal-level overview of all roles.

**New**: Clicking a deal row expands an inline panel below (like `CapacityTab`'s expandable rows). The expanded section shows a grid of all role categories, with each role slot showing:
- Currently assigned person + allocation %
- Available capacity (100% - their current total utilization)
- "Assign" button to pick from filtered people dropdown (inline, not modal)
- Editable allocation % input

State: `expandedDealId: string | null` — only one deal expanded at a time. The existing modal approach is replaced by this inline pattern.

**Files**: `Staffing.tsx` — replace `addModal` with `expandedDealId` state, add expanded row rendering in accounts table with role-grouped staffing grid.

## 4. Remove BW Rules Tab

Remove `bw_rules` from `TABS`, remove the `BWRulesTab` import/render, remove `bwRules` state. Keep the `BWRulesTab.tsx` component file (not deleting) but remove it from the page.

**Files**: `Staffing.tsx` — remove BW Rules tab entry, state, and render block.

## 5. Full-Field Add/Edit Person Modal

**Current**: "Add Person" modal only has Name, Role Category, Role Title, Pod, Region. Missing: Department, Designation, Reporting Manager, Band.

**New**: Add all fields to the Add Person modal matching the People table columns. Also add an "Edit Person" modal (triggered from People table row action) that pre-fills all fields and saves changes via `updatePerson`.

**Files**: `Staffing.tsx` — extend `newPerson` state to include `department`, `designation`, `reportingManager`, `band`. Add edit modal state and handler. Add an edit icon/button on each People table row.

## 6. Tiered Capacity View (Reporting Manager Hierarchy)

**Current**: `CapacityTab` shows a flat list sorted by utilization %, with pod summary cards.

**New**: Replace flat list with a tree structure based on `reportingManager`. Top-level nodes are people with no manager (or manager not in list) — these are the L6+ leaders. Their direct reports are nested under them (indented), and those reports' reports are nested further. Each node shows the person's utilization + deal count. Parent nodes show rolled-up averages. Expand/collapse per node.

The tree is built by:
1. Creating a map of `name → person` and `person → children` from `reportingManager`
2. Root nodes = people whose `reportingManager` is empty or not found in people list
3. Recursively render children with increasing indent

**Files**: `CapacityTab.tsx` — replace flat `personData` list with recursive tree rendering. Add `expandedNodes: Set<string>` state for collapse/expand.

## Files Summary
- `src/data/staffingData.ts` — Update `RevenueCapacityTarget`, add `generateAutoAssignments()`, update defaults
- `src/pages/Staffing.tsx` — Remove BW Rules tab, add expanded deal row, fix Add Person modal, add Edit Person
- `src/components/staffing/RevenueCapacityTab.tsx` — Rebuild for designation-level targets with leader roll-ups
- `src/components/staffing/CapacityTab.tsx` — Rebuild as tiered reporting-manager tree

