

# Central Cx — ClickUp-Style Task UI + Google Calendar Integration

## What Changes

### 1. Redesigned Quick-Add Task Card (Board View)
Replace the simple text input with an expandable inline card matching screenshot 1:
- Title input with Save button
- Space name label below title
- Icon row: Add Assignee, Add Dates, Add Priority, Add Tag — each opens a small popover inline
- If assignee not set, show greyed-out avatar placeholder (screenshot 2 style)

### 2. Inline Popovers on Task Cards
After a task is created, the card shows action icons. Clicking them opens small popovers:
- **Assignee popover** — search/select from space members list (screenshot 2)
- **Date picker popover** — dual panel: quick options (Today, Tomorrow, This Weekend, Next Week, etc.) on left, calendar grid on right (screenshot 3)
- **Priority popover** — flag list: Urgent (red), High (orange), Normal (blue), Low (grey), Clear option (screenshot 4)
- **Tags popover** — search box, list existing tags, "Create tag" option to add new ones (screenshot 5)

### 3. Redesigned Task Detail Panel (Full-Page Dialog)
When clicking a task, open a full-width dialog matching screenshot 6:
- Breadcrumb: Space > Task
- Inline-editable title (large heading)
- Grid of metadata fields: Status, Assignees, Dates, Priority, Time Estimate, Track Time, Tags — all editable inline
- Rich text description area ("Add description")
- Subtasks section ("+ Add Task")
- Checklists section ("+ Create checklist") — stored in subtasks JSON with a `type: "checklist"` field
- Keep existing features: logged hours, auto-regen, urgency

### 4. Google Calendar Side Panel
- Add a collapsible right-side panel to the Central Cx page
- Panel shows an embedded Google Calendar iframe
- Toggle button (calendar icon) on the toolbar to show/hide the panel
- Panel can be minimized to a thin strip with the calendar icon

### 5. Google Calendar Sync
- This requires Google OAuth. The project already supports managed Google OAuth via Lovable Cloud.
- Add a "Connect Google Calendar" button in the side panel
- Once connected, use Google Calendar API to:
  - Create calendar events from tasks (with start/end dates)
  - Show meeting notifications
- Store the Google connection state in localStorage for the session

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `src/components/cx/CxBoardView.tsx` | Redesign quick-add card with icon row popovers. Enhance task card to show inline action icons on hover. |
| `src/components/cx/CxTaskFormDialog.tsx` | Full rewrite as a ClickUp-style detail panel: breadcrumb, inline-editable metadata grid, description, subtasks, checklists. |
| `src/components/cx/CxListView.tsx` | Add inline popover editing for assignee/priority/dates on row hover. |
| `src/pages/CentralCx.tsx` | Add Google Calendar side panel state. Add `cx_tags` state management (collect all unique tags from tasks). Layout: main content + collapsible right panel. |

### New Files

| File | Purpose |
|------|---------|
| `src/components/cx/CxCalendarPanel.tsx` | Collapsible right panel with Google Calendar embed and connect button. |
| `src/components/cx/CxDatePickerPopover.tsx` | Reusable date picker with quick-select options (Today, Tomorrow, Next Week, etc.) + calendar grid. |
| `src/components/cx/CxPriorityPopover.tsx` | Priority flag selector popover. |
| `src/components/cx/CxTagsPopover.tsx` | Tag search/create popover. |
| `src/components/cx/CxAssigneePopover.tsx` | Assignee search from space members. |

### Priority Levels (matching screenshots)
- Urgent — red flag
- High — orange flag
- Normal — blue flag
- Low — grey flag
- Clear — removes priority

### Date Picker Quick Options
Today, Later (4:12 pm), Tomorrow, This Weekend, Next Week, Next Weekend, 2 Weeks, 4 Weeks, Set Recurring

### Google Calendar Integration
- Uses Google OAuth via Lovable Cloud's managed provider
- Embeds calendar via Google Calendar iframe URL for the authenticated user
- Optional: Create events via Google Calendar API edge function

### No database changes needed
All new features (checklists, enhanced tags) fit within existing `subtasks` jsonb and `tags` text[] columns. Priority values change from Low/Medium/High/Critical to Urgent/High/Normal/Low but the column remains text.

