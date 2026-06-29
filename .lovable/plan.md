# Editable NPS/CSAT Email Body + Live Preview

Today the invitation email is hardcoded inside the `send-pulse-survey` edge function — you can't change wording without a code push, and there's no way to see what recipients receive. This adds an in-app editor with placeholders, a live preview that shows the rendered email with the survey link, and makes the edge function read whatever you save.

## What you'll see in the app

In **Pulse / NPS → Send**, a new collapsible panel **"Email template"** above the recipient picker:

- **Subject** (single line input) — supports placeholders
- **Greeting** (single line) — e.g. `Hi {{first_name}},`
- **Body** (multi-line rich text-ish textarea) — supports placeholders, line breaks become paragraphs
- **CTA button label** (default: *Share your feedback →*)
- **Footer note** (small print line at the bottom)
- Available placeholders chip row (click to insert): `{{recipient_name}}`, `{{first_name}}`, `{{account}}`, `{{deal_name}}`, `{{vsd}}`, `{{sender_name}}`, `{{link}}`
- **Save** / **Reset to default** buttons
- **Live preview** pane to the right (or below on narrow screens) showing the fully-rendered branded email exactly as Gmail will render it, with:
  - Sample recipient: *Ananya Sharma — HDFC Bank — SEO Retainer*
  - A real-looking sample survey URL `https://peppercx.lovable.app/survey.html?t=preview`
  - A purple **"Share your feedback →"** button that's clickable in preview (opens the survey in a new tab so you can click through end-to-end)
- "Last edited by … on …" stamp

When you click **Send Pulse**, each recipient gets your saved template, with their own first name and a unique tokenised link substituted in.

## Layout sketch

```text
┌─ Email template ─────────────────────────────────────────────┐
│ Subject:  [ How are we doing on {{account}} — {{deal_name}}? ] │
│ Greeting: [ Hi {{first_name}},                              ] │
│ Body:                                                         │
│ ┌────────────────────────────┐   ┌─ Live preview ──────────┐│
│ │ Your honest feedback…      │   │  [rendered email card]  ││
│ │                            │   │   ── header             ││
│ │ {{link}} appears as button │   │   ── greeting           ││
│ └────────────────────────────┘   │   ── body paragraphs    ││
│ CTA label: [ Share your feedback → ]   ── purple CTA      ││
│ Footer:    [ Sent by Pepper CS… ]      ── footer          ││
│ Placeholders: [recipient_name][first_name][account]…       ││
│ [Reset to default]                     [Save template]      ││
└──────────────────────────────────────────────────────────────┘
```

## Technical details

**New table** `pulse_email_templates` (singleton row, `id='default'`):
- columns: `subject`, `greeting`, `body`, `cta_label`, `footer_note`, `updated_by`, `updated_at`
- RLS: read for any authenticated user; update only for admins + leadership roles (VSD / Sr BOPM / Principal BOPM) — matches RGY edit gating already in the app
- GRANTs to `authenticated` and `service_role`

**Edge function** `send-pulse-survey/index.ts`:
- Before sending, load the template row; fall back to current hardcoded defaults if absent
- Add a small `renderTemplate(str, vars)` that swaps `{{key}}` tokens
- Reuse the existing branded HTML shell — only the subject, greeting, body paragraphs, CTA label, and footer text become variable; brand colors/structure stay fixed so emails always look on-brand
- Body: split on blank lines into `<p>` blocks; `{{link}}` inside body is removed (link is always the CTA button)

**Frontend**
- New `src/components/rgy/PulseEmailTemplateEditor.tsx`:
  - Loads/saves the template row
  - `renderPreview()` mirrors the edge function's render logic so what you see is what gets sent
  - Renders the preview inside a sandboxed `<iframe srcDoc>` so the email styles can't leak into the app
- Mounted at the top of `src/components/rgy/PulseSurveyTab.tsx`, collapsed by default with a "Edit email" toggle so the existing Send flow stays uncluttered
- A small **"Send me a test"** button that calls `send-pulse-survey` with the current user as the sole recipient and a throwaway preview deal selection — optional, only enabled once a deal is picked

**Non-goals (call out so we're aligned)**
- Per-deal or per-VSD template variants — single global template for now
- Rich text editor (bold/italic/lists) — plain text with paragraph breaks; we can add later if you want
- Editing the survey form itself (this plan is only the invitation email)

## Files touched

- `supabase/migrations/<new>.sql` — table + RLS + GRANTs + seed default row
- `supabase/functions/send-pulse-survey/index.ts` — load template, render with vars
- `src/components/rgy/PulseEmailTemplateEditor.tsx` — new editor + preview
- `src/components/rgy/PulseSurveyTab.tsx` — mount the editor panel
