# Set up 3 aggregated notification emails

Add three new scheduled notifications that send **one email per BOPM** with a list of their accounts (not one email per deal, unlike existing rules). Each mails the BOPM as `To` and their VSD as `Cc`.

## Triggers & schedules


| #   | Rule key                   | Schedule                                                                                             | Trigger condition                                                                              |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| T1  | `mbr.reminder_bopm_digest` | Daily; fires only on working days when ≤10 days remain in the month AND resends every 3 working days | Previous month's MBR not logged (`status ∉ {Done, Not Required, Not done}`) for an active deal |
| T2  | `rgy.weekly_bopm_digest`   | Weekly, Friday morning                                                                               | Deal has no RGY entry in last 7 days                                                           |
| T3  | `nps.weekly_bopm_digest`   | Weekly, Wednesday morning                                                                            | Deal has ≥1 NPS invite sent but not completed; list the specific POC names + days outstanding  |


Working days = Mon–Fri. T1 dedupe key encodes the working-day slot so it fires at T-10, T-7, T-4, T-1.

## Recipients (aggregated per BOPM)

For each rule and each active deal that matches:

1. Resolve the deal's Principal / Senior / BOPM → those emails go into a per-BOPM bucket.
2. Resolve the deal's VSD → added to that bucket's `Cc` set.
3. After grouping, send one email per BOPM containing the full list of their qualifying accounts.

Admin can still override `To`/`Cc` tokens and add `extra_to` / `extra_cc` in Settings → Notifications; those apply on top of the resolved BOPM/VSD.

## Content

Each email body renders an HTML table:

- T1: Account | Deal | Previous month | "Log MBR" link (`/mbr-tracker?deal=<id>`)  
Eg: <!--
    ============================================================
    T1 — MBR Reminder (BOPM Digest)
    Rule key:   mbr.reminder_bopm_digest
    Schedule:   Working days only; fires when ≤10 days remain in
                month; resends every 3 working days until logged
    Condition:  Previous month's MBR not logged
                (status ∉ {Done, Not Required, Not done}) for an
                active deal
    To:         {{bopm_email}}      CC: {{vsd_email}}
    From:       [centralcx@peppercontent.io](mailto:centralcx@peppercontent.io)
    Subject:    Action needed: {{pending_count}} MBR(s) pending for
                {{mbr_month}} — {{days_remaining}} days left
    ------------------------------------------------------------
    TOKENS
    {{bopm_first_name}}   e.g. "Rahul"
    {{vsd_name}}          e.g. "Aamir Khan"
    {{mbr_month}}         e.g. "June 2026"
    {{current_month}}     e.g. "July"
    {{days_remaining}}    working-day count, e.g. "8"
    {{pending_count}}     e.g. "3"
    {{account_rows}}      repeat the <tr> block marked below
    {{mbr_link}}          deep link to CX_OS MBR logging page
    {{reminder_ordinal}}  e.g. "first" / "second" / "third"
    ============================================================
  -->
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>MBR Reminder</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F6F5F1;">
    <!-- Preheader (hidden preview text) -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
      {{pending_count}} account(s) still need {{mbr_month}} MBRs logged. {{days_remaining}} working days left this month.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F6F5F1;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%;">
            <!-- Header -->
            <tr>
              <td style="background-color:#0C0359; border-radius:12px 12px 0 0; padding:20px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-family:Arial,Helvetica,sans-serif; font-size:18px; font-weight:bold; color:#FFFFFF; letter-spacing:0.2px;">
                      pepper
                    </td>
                    <td align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#B9B3E6; text-transform:uppercase; letter-spacing:1.5px;">
                      Central CX
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Countdown strip -->
            <tr>
              <td style="background-color:#FEF3C7; border-left:1px solid #E8E4DA; border-right:1px solid #E8E4DA; padding:10px 32px; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:#92400E;">
                &#9200;&nbsp; <strong>{{days_remaining}} working days</strong> left in {{current_month}} &mdash; {{mbr_month}} MBRs must be logged before month-end.
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="background-color:#FFFFFF; border-left:1px solid #E8E4DA; border-right:1px solid #E8E4DA; padding:28px 32px 8px 32px;">
                <p style="margin:0 0 6px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; color:#1F2937;">
                  Hi {{bopm_first_name}},
                </p>
                <p style="margin:0 0 20px 0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:22px; color:#4B5563;">
                  The following <strong>{{pending_count}} account(s)</strong> under you don't have their <strong>{{mbr_month}} MBR</strong> logged yet. Please update them in CX&nbsp;OS &mdash; it takes about two minutes per account.
                </p>
                <!-- Accounts table -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E4DA; border-radius:8px;">
                  <tr>
                    <td style="background-color:#F3F1FB; padding:10px 14px; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#4C1D95; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #E8E4DA;">Account</td>
                    <td style="background-color:#F3F1FB; padding:10px 14px; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#4C1D95; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #E8E4DA;">MBR month</td>
                    <td style="background-color:#F3F1FB; padding:10px 14px; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#4C1D95; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #E8E4DA;">Status</td>
                  </tr>
                  <!-- BEGIN {{account_rows}} — repeat this <tr> per pending account -->
                  <tr>
                    <td style="padding:12px 14px; font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#1F2937; border-bottom:1px solid #F0EEE8;"><strong>{{account_name}}</strong></td>
                    <td style="padding:12px 14px; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:#4B5563; border-bottom:1px solid #F0EEE8;">{{mbr_month}}</td>
                    <td style="padding:12px 14px; border-bottom:1px solid #F0EEE8;">
                      <span style="display:inline-block; background-color:#FEE2E2; color:#B91C1C; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; padding:3px 10px; border-radius:20px;">Pending</span>
                    </td>
                  </tr>
                  <!-- END {{account_rows}} -->
                </table>
              </td>
            </tr>
            <!-- CTA -->
            <tr>
              <td align="center" style="background-color:#FFFFFF; border-left:1px solid #E8E4DA; border-right:1px solid #E8E4DA; padding:24px 32px 28px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#6D28D9; border-radius:8px;">
                      <a href="{{mbr_link}}" style="display:inline-block; padding:12px 36px; font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:bold; color:#FFFFFF; text-decoration:none;">Log MBRs in CX OS &rarr;</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#9CA3AF;">
                  Marked as done already? This email will stop automatically once the status updates.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color:#FAFAF7; border:1px solid #E8E4DA; border-top:1px solid #F0EEE8; border-radius:0 0 12px 12px; padding:18px 32px;">
                <p style="margin:0 0 4px 0; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:17px; color:#9CA3AF;">
                  This is your {{reminder_ordinal}} reminder &mdash; it repeats every 3 working days until the MBR is logged. {{vsd_name}} is copied for visibility.
                </p>
                <p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#C4C0B4;">
                  Sent by Central CX &middot; [centralcx@peppercontent.io](mailto:centralcx@peppercontent.io) &middot; rule: mbr.reminder_bopm_digest
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
- T2: Account | Deal | Current RGY | Last RGY update (days ago) | "Update RGY" link (`/rgy-health?deal=<id>`)  
<!--
    ============================================================
    T2 — RGY Update Reminder (BOPM Digest)
    Rule key:   rgy.reminder_bopm_digest
    Schedule:   Weekly, every Friday (feeds Monday's RGY insight)
    Condition:  Active deal has no RGY entry in the last 7 days
    To:         {{bopm_email}}      CC: {{vsd_email}}
    From:       [centralcx@peppercontent.io](mailto:centralcx@peppercontent.io)
    Subject:    RGY refresh: {{stale_count}} account(s) not updated
                this week
    ------------------------------------------------------------
    TOKENS
    {{bopm_first_name}}   e.g. "Rahul"
    {{vsd_name}}          e.g. "Aamir Khan"
    {{week_label}}        e.g. "Week of 20–24 July"
    {{stale_count}}       e.g. "4"
    {{account_rows}}      repeat the <tr> block marked below
    {{rgy_link}}          deep link to CX_OS RGY page
    PER-ROW TOKENS (inside {{account_rows}})
    {{account_name}}      e.g. "Acme Retail Group"
    {{rgy_pill}}          render ONE of the three pill variants
                          below based on current status
    {{days_stale}}        e.g. "9"
    {{last_updated}}      e.g. "13 Jul"
    RGY PILL VARIANTS (swap bg/color per status)
      Green:  bg #DCFCE7  text #15803D  label "Green"
      Yellow: bg #FEF9C3  text #A16207  label "Yellow"
      Red:    bg #FEE2E2  text #B91C1C  label "Red"
      Never logged: bg #E5E7EB  text #4B5563  label "Not set"
    ============================================================
  -->
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>RGY Weekly Refresh</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F6F5F1;">
    <!-- Preheader (hidden preview text) -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
      {{stale_count}} account(s) have no RGY update in 7+ days. Refresh before Monday's insight goes out.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F6F5F1;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%;">
            <!-- Header -->
            <tr>
              <td style="background-color:#0C0359; border-radius:12px 12px 0 0; padding:20px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-family:Arial,Helvetica,sans-serif; font-size:18px; font-weight:bold; color:#FFFFFF; letter-spacing:0.2px;">
                      pepper
                    </td>
                    <td align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#B9B3E6; text-transform:uppercase; letter-spacing:1.5px;">
                      Central CX
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Weekly cadence strip -->
            <tr>
              <td style="background-color:#EDE9FE; border-left:1px solid #E8E4DA; border-right:1px solid #E8E4DA; padding:10px 32px; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:#4C1D95;">
                &#128260;&nbsp; <strong>Friday RGY refresh</strong> &middot; {{week_label}} &mdash; updates made now feed Monday's RGY insight.
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="background-color:#FFFFFF; border-left:1px solid #E8E4DA; border-right:1px solid #E8E4DA; padding:28px 32px 8px 32px;">
                <p style="margin:0 0 6px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; color:#1F2937;">
                  Hi {{bopm_first_name}},
                </p>
                <p style="margin:0 0 20px 0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:22px; color:#4B5563;">
                  <strong>{{stale_count}} account(s)</strong> under you have no RGY entry in the last 7 days. Their status below is the last one logged &mdash; please confirm it still holds, or update it if things have moved.
                </p>
                <!-- Accounts table -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E4DA; border-radius:8px;">
                  <tr>
                    <td style="background-color:#F3F1FB; padding:10px 14px; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#4C1D95; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #E8E4DA;">Account</td>
                    <td style="background-color:#F3F1FB; padding:10px 14px; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#4C1D95; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #E8E4DA;">Current RGY</td>
                    <td style="background-color:#F3F1FB; padding:10px 14px; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#4C1D95; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #E8E4DA;">Last updated</td>
                  </tr>
                  <!-- BEGIN {{account_rows}} — repeat this <tr> per stale account -->
                  <tr>
                    <td style="padding:12px 14px; font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#1F2937; border-bottom:1px solid #F0EEE8;"><strong>{{account_name}}</strong></td>
                    <td style="padding:12px 14px; border-bottom:1px solid #F0EEE8;">
                      <!-- {{rgy_pill}} : swap bg/text per status (see spec at top) -->
                      <span style="display:inline-block; background-color:#FEF9C3; color:#A16207; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; padding:3px 10px; border-radius:20px;">Yellow</span>
                    </td>
                    <td style="padding:12px 14px; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:#4B5563; border-bottom:1px solid #F0EEE8;">
                      {{last_updated}} <span style="color:#B91C1C; font-weight:bold;">&middot; {{days_stale}}d ago</span>
                    </td>
                  </tr>
                  <!-- END {{account_rows}} -->
                </table>
              </td>
            </tr>
            <!-- CTA -->
            <tr>
              <td align="center" style="background-color:#FFFFFF; border-left:1px solid #E8E4DA; border-right:1px solid #E8E4DA; padding:24px 32px 28px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#6D28D9; border-radius:8px;">
                      <a href="{{rgy_link}}" style="display:inline-block; padding:12px 36px; font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:bold; color:#FFFFFF; text-decoration:none;">Update RGY in CX OS &rarr;</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#9CA3AF;">
                  Even if nothing changed, re-confirming the status keeps your accounts out of this list.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color:#FAFAF7; border:1px solid #E8E4DA; border-top:1px solid #F0EEE8; border-radius:0 0 12px 12px; padding:18px 32px;">
                <p style="margin:0 0 4px 0; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:17px; color:#9CA3AF;">
                  Sent every Friday, only when one or more of your accounts has no RGY entry in the last 7 days. {{vsd_name}} is copied for visibility.
                </p>
                <p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#C4C0B4;">
                  Sent by Central CX &middot; [centralcx@peppercontent.io](mailto:centralcx@peppercontent.io) &middot; rule: rgy.reminder_bopm_digest
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
- T3: Account | Deal | Recipient name/email | Sent on | Days outstanding | "Resend" link (`/pulse-nps?deal=<id>`)  
<!--
    ============================================================
    T3 — NPS Chase (BOPM Digest)
    Rule key:   nps.reminder_bopm_digest
    Schedule:   Weekly, every Wednesday
    Condition:  Active deal has ≥1 NPS invite sent but not
                completed; lists specific POC names + days
                outstanding
    To:         {{bopm_email}}      CC: {{vsd_email}}
    From:       [centralcx@peppercontent.io](mailto:centralcx@peppercontent.io)
    Subject:    NPS pending: {{poc_count}} POC(s) across
                {{account_count}} account(s) haven't responded
    ------------------------------------------------------------
    TOKENS
    {{bopm_first_name}}   e.g. "Rahul"
    {{vsd_name}}          e.g. "Aamir Khan"
    {{poc_count}}         total pending POCs, e.g. "5"
    {{account_count}}     accounts affected, e.g. "3"
    {{account_groups}}    repeat the ACCOUNT GROUP block below
                          (one header row + one POC row per
                          pending POC)
    {{nps_link}}          deep link to CX_OS NPS tracker
    PER-GROUP TOKENS
    {{account_name}}      e.g. "Acme Retail Group"
    PER-POC-ROW TOKENS
    {{poc_name}}          e.g. "Priya Sharma"
    {{poc_role}}          e.g. "Marketing Head" (optional)
    {{sent_date}}         e.g. "8 Jul"
    {{days_outstanding}}  e.g. "14"
    DAYS-OUTSTANDING COLOR (swap on the days span)
      1–7 days:   #A16207 (amber)
      8–14 days:  #C2410C (orange)
      15+ days:   #B91C1C (red)
    ============================================================
  -->
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>NPS Pending Responses</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F6F5F1;">
    <!-- Preheader (hidden preview text) -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
      {{poc_count}} POC(s) haven't completed their NPS survey. A quick nudge from you converts best.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F6F5F1;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%;">
            <!-- Header -->
            <tr>
              <td style="background-color:#0C0359; border-radius:12px 12px 0 0; padding:20px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-family:Arial,Helvetica,sans-serif; font-size:18px; font-weight:bold; color:#FFFFFF; letter-spacing:0.2px;">
                      pepper
                    </td>
                    <td align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#B9B3E6; text-transform:uppercase; letter-spacing:1.5px;">
                      Central CX
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Cadence strip -->
            <tr>
              <td style="background-color:#E0F2FE; border-left:1px solid #E8E4DA; border-right:1px solid #E8E4DA; padding:10px 32px; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:#075985;">
                &#128172;&nbsp; <strong>Wednesday NPS check</strong> &mdash; a personal nudge from you gets far more responses than another automated email to the client.
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="background-color:#FFFFFF; border-left:1px solid #E8E4DA; border-right:1px solid #E8E4DA; padding:28px 32px 8px 32px;">
                <p style="margin:0 0 6px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; color:#1F2937;">
                  Hi {{bopm_first_name}},
                </p>
                <p style="margin:0 0 20px 0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:22px; color:#4B5563;">
                  <strong>{{poc_count}} POC(s)</strong> across <strong>{{account_count}} account(s)</strong> under you were sent an NPS survey but haven't completed it. Please give them a quick nudge on your next call or over Slack/email.
                </p>
                <!-- Accounts + POC table -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E4DA; border-radius:8px;">
                  <tr>
                    <td style="background-color:#F3F1FB; padding:10px 14px; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#4C1D95; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #E8E4DA;">POC</td>
                    <td style="background-color:#F3F1FB; padding:10px 14px; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#4C1D95; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #E8E4DA;">Invite sent</td>
                    <td align="right" style="background-color:#F3F1FB; padding:10px 14px; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; color:#4C1D95; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #E8E4DA;">Outstanding</td>
                  </tr>
                  <!-- BEGIN {{account_groups}} — repeat this whole block per account -->
                  <!-- account header row -->
                  <tr>
                    <td colspan="3" style="background-color:#FAFAF7; padding:8px 14px; font-family:Arial,Helvetica,sans-serif; font-size:12px; font-weight:bold; color:#0C0359; letter-spacing:0.3px; border-bottom:1px solid #F0EEE8;">
                      {{account_name}}
                    </td>
                  </tr>
                  <!-- BEGIN poc rows — repeat this <tr> per pending POC in the account -->
                  <tr>
                    <td style="padding:11px 14px 11px 22px; font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#1F2937; border-bottom:1px solid #F0EEE8;">
                      <strong>{{poc_name}}</strong>
                      <span style="font-size:12px; color:#9CA3AF;">&nbsp;&middot;&nbsp;{{poc_role}}</span>
                    </td>
                    <td style="padding:11px 14px; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:#4B5563; border-bottom:1px solid #F0EEE8;">{{sent_date}}</td>
                    <td align="right" style="padding:11px 14px; font-family:Arial,Helvetica,sans-serif; font-size:13px; border-bottom:1px solid #F0EEE8;">
                      <!-- swap color per days band: 1–7 #A16207, 8–14 #C2410C, 15+ #B91C1C -->
                      <span style="font-weight:bold; color:#C2410C;">{{days_outstanding}} days</span>
                    </td>
                  </tr>
                  <!-- END poc rows -->
                  <!-- END {{account_groups}} -->
                </table>
              </td>
            </tr>
            <!-- CTA -->
            <tr>
              <td align="center" style="background-color:#FFFFFF; border-left:1px solid #E8E4DA; border-right:1px solid #E8E4DA; padding:24px 32px 28px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#6D28D9; border-radius:8px;">
                      <a href="{{nps_link}}" style="display:inline-block; padding:12px 36px; font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:bold; color:#FFFFFF; text-decoration:none;">View NPS tracker &rarr;</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#9CA3AF;">
                  Survey links can be resent from the tracker. POCs drop off this list as soon as they respond.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color:#FAFAF7; border:1px solid #E8E4DA; border-top:1px solid #F0EEE8; border-radius:0 0 12px 12px; padding:18px 32px;">
                <p style="margin:0 0 4px 0; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:17px; color:#9CA3AF;">
                  Sent every Wednesday, only when one or more of your accounts has a pending NPS response. {{vsd_name}} is copied for visibility.
                </p>
                <p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#C4C0B4;">
                  Sent by Central CX &middot; [centralcx@peppercontent.io](mailto:centralcx@peppercontent.io) &middot; rule: nps.reminder_bopm_digest
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>

Subject and body templates remain fully editable in Settings → Notifications (existing UI). Defaults are seeded on first run.

## Technical details

1. **Migration** — insert 3 new rows into `notification_rules` with default `to_tokens=['{bopm}']`, `cc_tokens=['{vsd}']`, seed subjects/bodies, `enabled=true`.
2. `**send-app-email**` — add 3 new event handlers (`mbr_bopm_digest`, `rgy_bopm_digest`, `nps_bopm_digest`) that accept `{ bopmEmail, ccEmails[], rows[] }` and render the tabular body using the editable template (supports `{rows_table}` placeholder + existing tokens).
3. `**notification-cron**` — extend the daily cron:
  - Compute working-day countdown; on qualifying days, aggregate MBR-missing deals per BOPM and emit `mbr_bopm_digest` events (dedupe key `mbr_digest:<bopm>:<ym>:<slot>`).
  - On Friday UTC, aggregate stale-RGY deals per BOPM (dedupe `rgy_digest:<bopm>:<isoWeek>`).
  - On Wednesday UTC, join `survey_invites` (sent, not completed) → deals → BOPMs, aggregate per BOPM with POC list + days outstanding (dedupe `nps_digest:<bopm>:<isoWeek>`).
4. **Cron schedule** — verify `notification-cron` runs daily; no change needed (weekly rules gate themselves by weekday).
5. Existing per-deal rules (`mbr.missing_prev_month`, `rgy.stale_7d`) remain untouched so nothing regresses; admins can disable them in favour of the new digests if desired.

No UI changes required — the new rules appear automatically in the existing Notification Rules card and are editable there.