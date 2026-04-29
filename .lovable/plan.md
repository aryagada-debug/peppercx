## Goal
On the Home → My Tasks Kanban, the "To Do" column currently grows tall and pushes content below it. Instead, give every column the same slightly taller fixed height and scroll within each column.

## Change
In `src/components/deals/TaskKanban.tsx`, update the compact-mode column styles in `DroppableColumn`:

- Replace `min-h-[120px] max-h-[280px] overflow-y-auto` with a fixed taller height that scrolls internally, e.g. `h-[440px] overflow-y-auto`.
- Update the outer columns wrapper (line 280) so `minHeight` for compact matches (≈ 460 incl. header) and remove the stretch behavior — use `items-start` on the flex row so a tall column can't drag the others taller.

## Result
- All 5 columns (To Do, In Progress, In Review, Done, Dropped) render at the same height (~440px).
- Each column scrolls vertically inside itself when it has more cards than fit.
- Nothing flows below the board; the section beneath ("Today's Calendar", "Smart Nudges") sits right under the Kanban.

## Files
- `src/components/deals/TaskKanban.tsx` (only)

No changes to Home.tsx, data, or behavior in non-compact (deal detail) usage.