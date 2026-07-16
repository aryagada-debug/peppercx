## Goal

Make a single, universal MBR form used everywhere (MBR Tracker table + Deal Detail) with strict conditional-required validation and inline error flagging. Fathom link + AI transcript summarizer included. Behavior applies only to MBRs logged going forward — no data migration.

## Problem today

There are three separate MBR entry surfaces, each with different fields/validation:

- `MBRInputDrawer` (Deal Detail "Record MBR") — has transcript + AI summary, validates most fields, but errors are toast-only, no inline flagging, and hard-codes `status = "Done"`.
- `MBRDetailDialog` (MBR Tracker table row + Deal Detail "View/Edit") — only validates `sentiment` when `status === "Done"`. No transcript, no AI summary, no inline flags. This is the form the user is complaining about.
- `ScheduleOnlyDialog` — quick-schedule shortcut (out of scope; kept as-is).

## Plan

### 1. Upgrade `MBRInputDrawer` into the universal form

- Add a **Status** selector at the top: `Done | Not Done | Pending | Not Required` (default from existing entry, else `Done` when opened from "Record MBR").
- Add **`anirudhJoining`** checkbox (currently only in `MBRDetailDialog`) so no field is lost when we retire that dialog.
- Keep existing Fathom link, transcript, "Generate AI Summary" (already wired to `mbr-summarize` edge function), action items, calendar sync — these become part of the universal form.
- Replace the "always Done" submit path with the status the user picked.

### 2. Conditional required-field rules (when `status === "Done"`)

Required: **Sentiment, Mode, MBR Date (conducted), Next MBR Scheduled Date, MBR PPT Link, Notes**.  
Optional: Fathom link, Transcript, AI Summary, Action Items, Anirudh flags.

For `Not Done` / `Pending` / `Not Required` → only Status is required (matches current lightweight behavior for those states).

### 3. Inline error flagging (replace toast-only validation)

- Track a `errors: Record<FieldKey, string>` state.
- On Save: compute errors from current values; if any exist, set state, scroll to the first invalid field, and abort — do **not** submit.
- Each field renders a red border + helper text when its key is in `errors`. Errors clear on change.
- Keep one summary toast ("Please complete the required fields") for accessibility, but the primary signal is inline.

### 4. Retire `MBRDetailDialog` in favor of the universal drawer

- `src/pages/MBRTracker.tsx`: swap `MBRDetailDialog` → `MBRInputDrawer` (pass the selected deal, its latest entry as `existingEntry`, and the same `onSave` that calls `upsertEntry`).
- `src/pages/DealDetail.tsx`: same swap for its `MBRDetailDialog` usage. The existing `MBRInputDrawer` usage there stays (now with the new status field).
- Delete `src/components/mbr/MBRDetailDialog.tsx` once both call sites are migrated.
- `ScheduleOnlyDialog` stays — it's a distinct "just schedule the next MBR" shortcut.

### 5. No data migration

Purely a UI/validation change. `mbr_entries` schema, `useMBRData.upsertEntry`, and the `mbr-summarize` edge function are unchanged. Existing rows with missing fields continue to render as-is; the new rules apply only when a user next saves an entry as `Done`.

## Files touched

- `src/components/mbr/MBRInputDrawer.tsx` — add Status select + `anirudhJoining`, inline error state, conditional validation, error styling.
- `src/pages/MBRTracker.tsx` — replace `MBRDetailDialog` with `MBRInputDrawer`.
- `src/pages/DealDetail.tsx` — replace `MBRDetailDialog` with `MBRInputDrawer`.
- `src/components/mbr/MBRDetailDialog.tsx` — deleted.
