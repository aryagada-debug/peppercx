

# MBR Tracker — Enhanced Input Drawer, Sentiment, AI Summary, Scheduling & Anirudh Tracking

## Overview

When a VSD marks an MBR as "Done", a full-screen drawer opens to capture rich data: sentiment (R/G/Y), Fathom link, transcript, scheduled date, and whether Anirudh was added as optional. An AI summarizer generates actionable to-dos from the transcript. Anirudh gets a separate column to mark deals he wants to join.

## Database Changes

**Alter `mbr_entries` table** — add columns:
- `sentiment` (text: Red / Yellow / Green) — post-MBR sentiment tag
- `fathom_link` (text) — Fathom note-taker URL
- `transcript` (text) — call transcript paste
- `ai_summary` (text) — AI-generated summary
- `action_items` (jsonb, default '[]') — structured to-dos from AI
- `scheduled_date` (date) — mandatory future MBR date
- `anirudh_added` (boolean, default false) — VSD confirms Anirudh is optional attendee
- `anirudh_joining` (boolean, default false) — Anirudh marks he wants to join
- `input_recorded_at` (timestamptz) — when the drawer was submitted

## Edge Function: AI Summarizer

**New edge function `mbr-summarize`** that takes the transcript text, calls Lovable AI (gemini-3-flash-preview), and returns:
- A concise meeting summary
- Actionable to-dos with owners and deadlines

Called from the drawer when user clicks "Generate AI Summary" after pasting transcript.

## Frontend Changes

### 1. MBR Input Drawer (new component)

When status changes to "Done" in the Deal Tracker tab, instead of inline update, a **full Drawer** opens from the right with:

- **Deal info header** (Account, Deal Name, VSD — read-only)
- **Sentiment** — 3 color buttons: 🟢 Green, 🟡 Yellow, 🔴 Red (mandatory)
- **Fathom Link** — text input for note-taker URL (with view-access note)
- **Transcript** — large textarea to paste call transcript
- **"Generate AI Summary" button** — calls edge function, populates:
  - Summary text area (editable)
  - Action items list (editable, add/remove)
- **Scheduled Date for Next MBR** — date picker (mandatory)
- **Anirudh added as optional?** — checkbox (mandatory)
- **Mode** — In-Person / Virtual radio
- **Notes** — textarea
- **Submit button** — saves all fields, records `input_recorded_at = now()`

### 2. Deal Tracker Tab Updates

- Add **"Scheduled Date"** column showing next MBR date
- Add **"Sentiment"** column with colored dot (R/G/Y)
- Add **"Anirudh Joining"** column — checkbox that only Anirudh toggles
- Add **"Anirudh Added?"** column showing ✓/✗
- Clicking "Done" opens the drawer instead of inline dropdown
- Other statuses (Not Done, Not Required, Pending) remain inline

### 3. VSD Summary Tab Updates

- Add sentiment distribution per VSD (Green/Yellow/Red counts)
- Add "Scheduling Compliance" metric — % of deals with future MBR date filled

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add 8 new columns to `mbr_entries` |
| `supabase/functions/mbr-summarize/index.ts` | New edge function for AI summary |
| `src/components/mbr/MBRInputDrawer.tsx` | New full drawer component |
| `src/hooks/useMBRData.ts` | Expand MBREntry interface, update upsert to handle new fields |
| `src/pages/MBRTracker.tsx` | Integrate drawer, add new columns, sentiment display |

## Key Technical Details

- Drawer uses shadcn Sheet component (side="right", full height)
- Sentiment stored as text enum, rendered as colored circles
- AI summary via Lovable AI gateway through edge function — no API key needed from user
- `input_recorded_at` auto-set on submit to track when data was entered
- `scheduled_date` is mandatory when status = "Done" — drawer won't submit without it
- Action items stored as JSONB array: `[{task, owner, deadline, done}]`

