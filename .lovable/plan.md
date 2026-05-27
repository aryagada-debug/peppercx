## Goal
Make the currently expanded deal card on the Staffing & Capacity list visually distinct from the collapsed rows around it, with a subtle touch of color.

## Change
Single file: `src/components/staffing/DealStaffingCard.tsx`

When `open` is true, style the root card and header to gently stand out; collapsed cards stay exactly as they are today.

### Root wrapper (line ~132)
Conditionally apply when `open`:
- Left accent bar: `border-l-4 border-l-primary` (vs. normal `border-l border-l-border`)
- Soft ring: `ring-1 ring-primary/15`
- Slightly stronger surface: keep `bg-card`, but add subtle `shadow-sm`

### Header band (line ~134)
When `open`, swap `bg-secondary/30` → `bg-primary/5` so the open card's header carries a faint primary tint. Collapsed cards keep `bg-secondary/30`.

### Chevron (line ~140)
When `open`, color the `ChevronUp` with `text-primary` instead of `text-muted-foreground` as a small accent cue.

No other visual changes — KPI strip, department tables, rows, buttons all stay identical. No logic, data, or layout changes.

## Out of scope
- Collapsed-row styling
- Any other staffing surfaces (Sheet view, Deal view, etc.)
- New tokens in `index.css` (uses existing `--primary` / `--border`)
