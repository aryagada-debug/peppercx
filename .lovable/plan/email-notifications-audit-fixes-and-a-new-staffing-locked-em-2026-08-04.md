# Email notifications: audit, fixes, and a new "staffing locked" email

## What the audit found

**1. Nothing has been emailed since 30 July — the central mailbox is disconnected.**
Every app email is sent through the shared [centralcx@peppercontent.io](mailto:centralcx@peppercontent.io) mailbox. Google has revoked its refresh token, so the send function stops before it even tries. Four deals were created today (Whistic, Ema Unlimited, Pidilite, NPCI) and not a single email attempt was recorded for them. This is the reason "deal created" emails stopped working — nothing is wrong with the deal rule itself.

**2. The failure is completely silent.**
When the mailbox is dead, the app swallows the error: no toast, no entry in the email log, no warning in Settings. That is why it went unnoticed for a week.

**3. "Deal created" only fires from one of the three ways a deal can be created.**

- Created via the Clients & Deals wizard: email fires.
- Created from an approved handover: no email.
- Created through the staffing deal-add path: no email.

**4. Rule-by-rule status**


| Rule                                     | State | Notes                                                                       |
| ---------------------------------------- | ----- | --------------------------------------------------------------------------- |
| Deal created                             | On    | VSD + capability lead + Arya. Blocked by the mailbox only.                  |
| Deal unstaffed 7d                        | On    | Same recipients.                                                            |
| Handover received                        | On    | Arya, Anirudh, Priyanka.                                                    |
| MBR / RGY / NPS weekly digests           | On    | BOPM to, VSD cc. Last MBR digest 27 Jul, NPS 23 Jul — also mailbox-blocked. |
| Assignment created (per-person staffing) | Off   | Deliberately disabled.                                                      |
| RGY alert                                | Off   | Deliberately disabled.                                                      |


## Fixes

1. **Reconnect the central mailbox.** Needs one action from you in Settings → Notifications: "Set as central mailbox" while signed in as [centralcx@peppercontent.io](mailto:centralcx@peppercontent.io). Everything else stays blocked until this is done.
2. **Stop silent failures.** Failed sends (including a dead mailbox) get written to the email log with the reason, and Settings → Notifications shows a red "Central mailbox disconnected — emails are not sending" banner with a reconnect button.
3. **Close the deal-created gaps** so handover-created and staffing-created deals also trigger the email.

## New: "Staffing locked" email

A single email per deal, sent only at the moment staffing is locked (not on every assignment change).

- **To:** everyone currently staffed on that deal (all roles, active assignments only).
- **CC:** [anirudh@peppercontent.io](mailto:anirudh@peppercontent.io).
- **Content:** deal name and account, who locked it and when, plus a table of the full staffed team — name, role and allocation % — and a link to the deal with all the deal details like duration, start date, MRR, Total deal value, retainer/non retainer.
- Sent once per lock action; unlocking sends nothing, and re-locking sends a fresh email.
- Appears in Settings → Notifications as "Staffing locked — team notification", fully editable like the other rules: on/off toggle, recipient tokens, extra To/CC, subject and body templates, and a "Send test" button.

## Technical detail

- New `notification_rules` row `staffing.locked` (enabled, `to_tokens: {staffed_team}`, `extra_cc: anirudh@peppercontent.io`) plus a `{staffed_team}` token in the rules resolver that expands to every active assignee on the deal.
- New event `staffing_locked` in `src/lib/appEmail.ts`, mapped in `EVENT_TO_RULE`, with its own builder in `supabase/functions/send-app-email/index.ts` rendering the team table.
- Fired from the two lock call sites — `DealStaffingCard.tsx` and `BopmStaffingFlatTable.tsx` — after `toggle_staffing_lock` succeeds with `_lock = true`.
- The global staffing suppression of [anirudh@peppercontent.io](mailto:anirudh@peppercontent.io) stays for per-assignment emails but is bypassed for `staffing_locked`, since he is a required CC here.
- `send-app-email`: log a `failed` row per intended recipient when the mailbox is unavailable, and return the reason to the caller; `sendAppEmail` surfaces a toast instead of only a console warning.
- Deal-created coverage: fire the email from the staffing deal-add mutation, and from the handover approval path once the deal row exists.