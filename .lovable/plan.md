## Goal
Replace DM Sans with Inter as the primary font and tighten the visual system so the UI reads sharper and more modern.

## Changes

### 1. Font swap → Inter
`src/index.css`
- Replace the Google Fonts `@import` to load **Inter** (weights 400, 500, 600, 700) alongside the existing JetBrains Mono.
- Update the `body` `font-family` to `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.
- Enable Inter's modern OpenType features for crispness:
  - `font-feature-settings: 'cv11', 'ss01', 'ss03', 'cv02'` (stylistic alternates that give Inter its sharper, geometric look).
  - Keep `-webkit-font-smoothing: antialiased`.
- Drop body `font-weight` from 450 → **400** (Inter renders cleaner at 400; 450 is a DM Sans variable axis that won't apply to Inter).
- Tighten body `letter-spacing` to `-0.005em` and reduce body `line-height` from `1.6` → `1.5`.

### 2. Sharper typographic rhythm
`src/index.css` + `tailwind.config.ts`
- Add a global heading rule: headings get `letter-spacing: -0.02em` and `font-weight: 600` for a tighter, modern display feel.
- In `tailwind.config.ts` `fontSize` tokens, tighten tracking on `subhead` (`-0.01em`) and `heading` (`-0.025em`). Keep `metric` as-is (already tight).

### 3. Tighter geometry (sharper corners + crisper surfaces)
`src/index.css`
- Reduce `--radius` from `0.875rem` (14px) → **`0.5rem` (8px)** for a sharper, less rounded modern look across buttons, inputs, cards, popovers.
- Update `.data-card` `border-radius` from `14px` → `8px` to match.
- Replace the slightly soft `--shadow-sm` / `--shadow-md` with crisper, lower-spread shadows:
  - `--shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05)`
  - `--shadow-md: 0 2px 8px -2px rgba(0,0,0,0.08)`
- Make `--border` 1 step darker in light mode (e.g. `240 6% 84%`) so thin borders read crisper on the off-white background.

### 4. No component-level changes
All buttons, cards, inputs, dialogs already consume `--radius`, `--border`, `--shadow-*`, and body font tokens — so the above token changes propagate everywhere with zero component edits.

## Out of scope
- No color palette changes (purple primary, off-white bg preserved per project memory).
- No layout, spacing, or component structural changes.
- No changes to the mono font usage on metrics.

## Verification
- Reload preview, confirm Inter is loading (Network tab → `fonts.googleapis.com/...Inter`).
- Spot-check Dashboard, Clients & Deals, Deal Detail, RGY Health for: tighter corners on cards/buttons, crisper borders, sharper headings, and Inter rendering in body + tables.
