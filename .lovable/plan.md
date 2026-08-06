# NPS Responses: question columns + column picker

Make every survey question available as its own column in the Pulse/NPS Analytics → Responses table, with a Column Picker that groups the questions so you can switch them on and off.

## What you'll see

- A **Columns** button above the responses table. It opens a panel with grouped checkboxes:
  - **Core** — Deal, Account, Recipient, Status, Sent, Opened, Completed, Respondent, Campaign, Source (today's columns)
  - **Scores** — NPS, NPS category, CSAT average
  - **Outcomes** — creative success metrics, measurably moving metrics, on-brand consistency, craft rating, single winning outcome
  - **Experience (ratings)** — one column per rated dimension: quality of creative output, briefing & kickoff, revisions & feedback, turnaround & delivery, communication & updates, day-to-day collaboration, strategic partner, plus the experience comment
  - **Looking ahead** — renewal intent, what would change your mind
  - **Growth** — where the retainer could do more
  - **Recommendation** — main reason / holding back / value most (verbatims)
  - **Overall** — mood / how you feel about working with Pepper
- Group headers have "All / None" toggles; a "Reset to default" restores today's column set.
- Defaults stay as they are now, so nothing changes until you enable question columns.
- Your selection is remembered (saved locally per user).
- Question columns are sortable and included in the CSV export exactly as shown.
- Long text answers are truncated in-cell with the full text on hover; the existing "View" drill-in stays untouched.

Question columns apply to the **Flat** layout. In **Deal-wise** layout they appear on the expanded per-POC child rows, while the deal summary row keeps its aggregate columns.

## Technical notes

- New `src/components/pulse/responseColumns.ts`: a single `QUESTION_COLUMNS` registry — `{ id, group, label, accessor(row) }` — reusing the existing answer-extraction helpers from `GoogleFormResponseView.tsx` (`pick`, `toText`, `toArray`, `toNum`, `extractExperienceRatings`). Those helpers get exported from that file (or moved into a shared `pulseAnswers.ts` and re-imported there) so Google Form and native wizard payloads are read through one path.
- Accessors read `row.payload` and fall back to the native `PulseAnswers` shape (`capability_deep_dive`, `experience.ratings`, `retention`, `expansion`, `sentiment`) when `source !== "google_form"`, so both response types populate the same columns.
- New `src/components/pulse/ColumnPicker.tsx`: popover + grouped checkbox list, controlled by a `visible: Set<string>` state in `AnalyticsResponsesTable`, persisted to `localStorage` under `pulse-analytics-columns-v1`.
- `AnalyticsResponsesTable.tsx`: replace the hard-coded `<th>`/`<td>` lists with a render loop over the active column definitions; extend `toggleSort` to sort by accessor value, and rebuild `exportCsv`'s flat branch from the same active-column list. Table wrapper gets `overflow-x-auto` for the wider grid.
- No backend or schema changes.
