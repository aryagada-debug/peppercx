# MBR Flags — Cleaner Insights + Standardized Not-Done / Not-Required Flags

## Problem
Today's Flags tab (in `src/pages/MBRTracker.tsx`, `flagInsights` memo + rendered table) shows each detected flag as a **60/120-char raw slice of the notes** around the matched keyword. Result: fragmented mid-sentence excerpts like *"HNI, salaried professional). Intent: Improve relevance…"* that read as noise, not insight.

Also, flags today only fire for **Done** MBRs (keyword scan) and one aggregate case ("MBR not held" for 3 straight misses). There is no first-class flag surface for **Not Done** or **Not Required** statuses, so deals that skip / defer / mark as N/A don't show up in the flags view in a standard way.

## Goals
1. Every flag row shows a **clean, sentence-level insight** — not a raw excerpt.
2. Add **standardized flags** for `Not Done` and `Not Required` MBRs across all retainer deals, with clear meaning and severity.
3. No changes to existing MBR data, table view, or logging drawer — Flags tab only.

## Changes

### 1. Insight text instead of raw snippets (keyword-detected flags)
Rework `scan()` inside `flagInsights` so each detected flag stores a **clean insight**, not a keyword-window slice.

- Split the MBR text (`aiSummary + notes + transcript`) into sentences via a simple splitter (`/(?<=[.!?])\s+/`), then trim leading bullet markers (`*`, `-`, `1.`) and section labels (`**Risks:**`, `Discussion Notes:`).
- For each keyword hit, pick the **full sentence** containing the match (or up to 2 sentences if the first is <40 chars), capped at ~180 chars with an ellipsis.
- Prefer sentences from `aiSummary` over `notes` over `transcript` when the same keyword appears in multiple sources — the AI summary is already condensed.
- Drop obvious noise sentences: those that are only headers (end with `:`), pure lists of numbers, or shorter than 25 chars.

Rendered row becomes:
`[Churn risk]  Client hinted at re-evaluating vendors in Q3 if content quality doesn't improve.`

### 2. Standardized Not Done / Not Required flags
Extend `flagInsights` with a second pass over `entriesByMonth` for **the current month and the immediately previous month** (retainer deals only, matching today's scope):

- **`Not Done` in current month** → severity `yellow`, type **"MBR skipped this month"**, detail = `Reason: <reason || "no reason logged">. Next scheduled: <scheduledDate || "not set">.`
- **`Not Done` in current AND previous month** → escalates to severity `red`, type **"MBR skipped 2 months in a row"** (replaces the yellow one for that deal).
- **`Not Required` in current month** → severity `info`, type **"MBR marked not required"**, detail = `Reason: <reason || "—">. Reconfirm next quarter.`
- **`Not Required` 3+ consecutive months** → severity `yellow`, type **"Prolonged 'Not Required' status"**, detail = `Marked not required for N consecutive months — reconfirm relationship health.`

These use the `MbrEntry` fields already loaded (`status`, `reason`/`notes`, `scheduledDate`, `weekStart`) — no new queries. Existing "MBR not held (3 misses)" logic is kept but deduped against the new 2-in-a-row red flag (only the higher-severity one shows per deal).

### 3. Header / count updates
The KPI tiles (Critical / Watch / Opportunity) already bucket by severity, so the new flags flow through automatically. No layout changes.

## Non-goals
- No changes to the Table, Insights, Compliance, or Reminders tabs.
- No AI/gateway call — the "insight" is deterministic sentence extraction from text the app already has (including `ai_summary` if the user ran the summarizer).
- No schema changes.

## Files touched
- `src/pages/MBRTracker.tsx` — only the `flagInsights` `useMemo` and the flag row rendering (title/detail formatting). Roughly ~80 lines changed, no new files.
