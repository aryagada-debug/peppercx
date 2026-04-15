# Tasks Tab — Phase-Based Left Pane with Auto-Regeneration

## Overview

Replace the current flat Kanban-only Tasks tab with a **two-pane layout**: a left sidebar showing onboarding phases, and a right pane showing tasks for the selected phase. Tasks are pre-populated from the PDF onboarding plan. When a task is marked complete, it can optionally auto-regenerate (toggle off by default).  
Save this as - Template v1. Make this template editable where tasks can be added or deleted and templatised.

## What Changes

### 1. Left Pane — Phase Navigation

- A vertical list of all phases extracted from the PDF (Sales Handover, Scope Definition, Staffing, Internal Alignment, Client Kick-off, Project Setup & Planning, Keyword Universe, Initial Competitor Research, Keyword Analysis, Initial Benchmarking, Page Creation, URL Taxonomy, Backlinking Audit, Content Team Project Initiation, Defining Timelines, Engagement Setup, Creator Pool Setup, Content Pilot)
- Each phase shows a completion indicator (e.g., "3/5 tasks done")
- By default, only the **current phase** (first incomplete phase) is selected
- Clicking a phase shows its tasks in the right pane  
Add a functionality where when clicked on the already visible phase, it shows all the tasks

### 2. Right Pane — Tasks for Selected Phase

- Uses the existing `TaskKanban` component (or a simplified list view) filtered to the selected phase's tasks
- Each task has: title, description, assignee (pre-populated from deal's VSD/BOPM/SEO Lead where applicable), due date, status
- Tasks are seeded from the PDF data when the deal has no phase-based tasks yet (similar to the existing "Generate Checklist" pattern)

### 3. Task Auto-Regeneration Toggle

- A toggle switch labeled "Auto-regenerate tasks on completion" — **off by default**
- When ON: marking a task as "Done" automatically creates a new copy of that task with status "To Do" for the next cycle
- The regenerated task keeps the same title, description, assignee, and phase but resets dates and status

### 4. Pre-populated Task Data from PDF

The phases and tasks are hardcoded as a template (like the existing `seedOnboarding` pattern). Assignee placeholders map to deal fields:

- "VSD" → `deal.vsd`
- "Senior BOPM" → `deal.seniorBopm`  
- "BOPM" → `deal.bopm`
- "SEO Lead/Manager/Analyst" → from staffing assignments
- "Group Head", "Practice Head", "Content Lead" → from staffing assignments

### 5. Database

- Reuse the existing `deal_tasks` table — add a `phase` text field to categorize tasks by phase
- No new tables needed  
  
6. Add tags such as SEO, etc signifying which team needs attention. 

## Implementation

### Migration

- Add `phase` column (text, default `''`) to `deal_tasks` table

### Files Modified/Created


| File                                      | Change                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/pages/DealDetail.tsx`                | Replace Tasks tab content with new two-pane PhaseTasksView component                        |
| `src/components/deals/PhaseTasksView.tsx` | **New** — Left pane (phase list) + right pane (task list per phase), auto-regen toggle      |
| `src/components/deals/TaskKanban.tsx`     | Keep as-is; PhaseTasksView delegates task rendering to a filtered task list                 |
| `src/hooks/useDealDetail.ts`              | Update `addTask` to include `phase`; add `seedPhaseTasks()` function with PDF template data |
| `src/components/deals/TaskFormDialog.tsx` | Add optional `phase` field to TaskData                                                      |


### Phase Template Data (from PDF)

```
Sales Handover → 3 tasks (Review proposal; Setup meeting with Sales; Conduct handover)
Scope Definition → 1 task (Review engagement model, strategy deck, briefs...)
Staffing → 2 tasks (Initiate staffing; Margin Deal Desk)
Supply Requisition → 1 task (Supply assessment and finalization)
Resource Onboarding → 1 task (Onboard freelancer/resource)
Internal Alignment → 5 tasks (Internal Kickoff; Account staffing review; Immersion session setup; Complete immersion; Internal SEO alignment)
Client Kick-off → 5 tasks (Prepare kickoff deck ×2; Complete client kickoff; Send MoM; ...)
Project Setup & Planning → 5 tasks (Project setup; Roadmap creation; Assign tasks; Create folders; Create trackers)
Keyword Universe → 3 tasks (Atlas setup; Finalize categories; Extract keywords)
Competitor Research → 2 tasks (Review client website; Review competitor website)
Keyword Analysis → 4 tasks (Keyword analysis; Mapping; Identify new pages; Prepare IA)
Benchmarking → 3 tasks (Pre-SEO ranking report; Monthly topics research; SEO content outline)
Page Creation → 3 tasks (Share content suggestions; Crawl website; Classify URLs)
URL Taxonomy → 1 task (URL taxonomy classification)
Backlinking Audit → 1 task (Compare off-page parameters)
Content Team Initiation → 1 task (Review keyword universe, create content calendar)
Defining Timelines → 1 task (Calendar sign-off, setup cadence)
Engagement Setup → 4 tasks (Prepare project brief; Share brief for approval; Customize platform; Set up platform)
Creator Pool Setup → 1 task (Initial creator briefing)
Content Pilot → ~10 tasks (Editorial briefing; Allotment; Edit outlines; Submit drafts; Review feedback ×3; Approvals; Quality escalations; Scale-up prep)
```

### Auto-Regeneration Logic

```typescript
// In PhaseTasksView — when task marked Done and toggle is ON:
if (autoRegen && newStage === "Done") {
  addTask({
    ...task,
    id: undefined, // new ID
    stage: "To Do",
    startDate: undefined,
    endDate: undefined,
    loggedHours: 0,
  });
}
```