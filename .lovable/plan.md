## Problem

The "Live preview" in the Pulse email template editor (`src/components/rgy/PulseEmailTemplateEditor.tsx`) renders a different HTML layout than the actual email sent by `supabase/functions/send-pulse-survey/index.ts`. Different brand colors, header (no Pepper logo bar / "Pepper Pulse" tag), fonts, button styling, footer structure, and the "Thank you for taking a few moments…" block are all missing from the preview.

## Fix

Rewrite `buildPreviewHtml` in `PulseEmailTemplateEditor.tsx` so it mirrors the email produced by `emailHtml` in `send-pulse-survey/index.ts`:

- Replace brand tokens with the sent-email palette: `BRAND_PRIMARY #5B34DA`, `BRAND_HEADER_BG #0C0359`, `BRAND_HEADER_ACCENT #B7A9EE`, `BRAND_BG #F4F0EA`, `BRAND_BORDER #ECE7F5`, `BRAND_TEXT #1E1633`, `BRAND_BODY #4A4358`, `BRAND_MUTED #9089A0`.
- Use the same 600px rounded white container, dark header row with a "Pepper Pulse" uppercase accent label on the right (skip the logo image in the preview since it's a data URL only in the edge function; render a "Pepper" wordmark text instead so preview stays self-contained).
- Render the `greeting` as the large H1 headline (not as a paragraph), matching the sent email.
- Use `paragraphsHtml` with the sent-email typography (Segoe UI, 16px/1.6, `BRAND_BODY` color, 16px paragraph spacing).
- Left-align CTA button with sent-email styling (10px radius, 15px 38px padding, 16px/700, `BRAND_PRIMARY`).
- Add the "Thank you for taking a few moments…" closing paragraph block that the sent email includes.
- Footer section: divider line, `footer_note` in muted 13px, second divider, and the "If the button doesn't work, copy this link" fallback with the link — same order and styling as sent email.
- Keep the current "From / To / Subject" header strip above the email body so users still see the subject preview.

## Technical details

- File touched: `src/components/rgy/PulseEmailTemplateEditor.tsx` only.
- No changes to the edge function or DB — sent output is already correct.
- Keep sample vars and `render()`/`escapeHtml()` helpers; adjust `paragraphsHtml()` signature to match the new inline styles (drop the `color` param, hardcode `BRAND_BODY`).
- Preview iframe height can stay at 620px; adjust if content overflows.
