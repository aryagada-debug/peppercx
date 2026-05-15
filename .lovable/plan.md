## Part 1 — Slack mentions: show real names

**Issue:** mention text contains raw `<@U06A6Q3YSZNJ>` Slack IDs, displayed as-is.

**Fix:** in `src/pages/Home.tsx` (mentions render around line 1455), post-process `m.text`:

1. Regex-extract every `<@U…>` token from the message.
2. Resolve each ID → name via `staffing_people` (we have `slack_user_id` after the recent backfill); cache results in component state to avoid refetching.
3. For unresolved IDs, fall back to the existing `slack-resolve-user` edge function (`users.info`) and upsert the name back into `staffing_people` so it sticks.
4. Replace each `<@U…>` with `@<Name>`, render as a subtle chip.
5. Same treatment for the message author (`m.user_name`) when missing.

No schema changes required.

## Part 2 — Activity tab

Per your decision: **remove the Activity tab entirely**. The card becomes "Slack mentions" only. Drop `useAccountActivity`, the `notifTab` state, and the tab chrome; render the mentions list directly.

---

## Part 3 — Weekly role-based summary email

### Format (one email, two columns)

```text
Subject:  Your week at Pepper · 18 May → 24 May

Hi <First name>,

═══ DONE THIS WEEK ═══
✅ Tasks completed              12
✅ MBRs scheduled                3
✅ MBRs recorded (notes saved)   2
✅ RGY updates                   7   (4 deals moved to Green)

═══ NEEDS YOUR ATTENTION ═══
⚠ Tasks overdue                 5   → [view]
⚠ MBRs to schedule              4   → [view]
⚠ MBRs to record (past date)    2   → [view]
⚠ RGY stale (>14 days)          6   → [view]

[Open dashboard]
```

Below the headline counts, an itemised section grouped by deal (top 10 items per bucket; "+N more" link).

### Scope per role


| Role               | Scope of data                                                                  |
| ------------------ | ------------------------------------------------------------------------------ |
| Admin              | All deals, all people. Top-level totals + breakdown by VSD and BOPM            |
| VSD                | All BOPMs reporting to them, and the deals those BOPMs own. Breakdown by BOPM. |
| P.BOPM / Sr BOPM   | Only the deals where they are tagged (BOPM/SR BOPM stakeholder or staffed).    |
| Content / SEO Lead | Same pattern — only deals they're tagged on (optional, future).                |


Scope resolution reuses the existing `useDealAccess` / staffing-hierarchy logic, executed server-side in the edge function.

### Data sources (read-only queries)

- **Tasks done / overdue:** `tasks` (status = done, completed_at within window) / (due_date < now() AND status ≠ done).
- **MBRs scheduled / recorded / to-schedule / to-record:** `mbr_sessions` (created_at, notes_saved_at) and the existing "MBR compliance" logic.
- **RGY updates / stale:** `deal_rgy_history` rows in window + `useStaleRgy` rule (>14 days).
- All filtered by the role-scoped deal-id list.

### Schedule

- **When:** Every Monday 10:00 IST.
- **Window:** Previous Mon 00:00 IST → Sun 23:59 IST.
- **Mechanism:** `pg_cron` row that POSTs to a new edge function `weekly-summary-email`. Cron expression `30 4 * * 1` (UTC = 10:00 IST).

### Sender / delivery

- **Custom domain** (e.g. `notify.peppercontent.io` — final subdomain to be confirmed).
- Lovable-managed email path: `email_domain--scaffold_transactional_email` after the domain is verified, then call `send-transactional-email` from the new edge function.
- Each user's address comes from `auth.users.email`. Suppression list and unsubscribe token come for free with the Lovable email infra.

### New pieces to build

1. **Edge function** `weekly-summary-email`
  - Input: `{ dryRun?: boolean, onlyEmail?: string }`.
  - Iterates active users, computes role + scope, builds payload, calls `send-transactional-email`.
  - Service-role client; chunked (50/run) to stay within timeout.
2. **Email template** (React Email) `weekly-summary.tsx` in `supabase/functions/_shared/email-templates/` matching the format above. Uses semantic tokens (purple primary, off-white bg) per project design memory.
3. **DB:** no new tables required for v1. Optional `email_send_log` row already exists via Lovable email infra.
4. **Cron:** SQL inserted via `supabase--insert` (project-specific URL + anon key — not a migration).
5. **Settings UI (small):** "Send me the weekly summary" toggle on Settings page → stores to `profiles.weekly_summary_opt_in BOOLEAN DEFAULT true`. Default ON, unsubscribe link in footer flips it off.

### Step-by-step rollout

1. Fix mentions name resolution + remove Activity tab (Part 1 & 2). Verify in preview.
2. Ask you to run the email-domain setup dialog for the custom subdomain (DNS records).
3. While DNS verifies, scaffold transactional email, build `weekly-summary-email` edge function and template.
4. Add the opt-in column + settings toggle.
5. Trigger a `dryRun=true` run, send a single test email to your address (`onlyEmail`).
6. Once you sign off, schedule the Monday 10:00 IST cron.

### Open items needing your input before build

- Final sender address (e.g. `weekly@notify.peppercontent.io` vs `nudges@…`). centralcx@peppercontent.io
- Should Content Lead / SEO Lead also receive the email in v1, or only Admin / VSD / BOPM? only Admin,VSD, BOPM
- For a VSD's email — do you want the per-BOPM breakdown inline, or just totals + a CSV attachment? per BOPM breakdown inline