## Goal
Make horizontal scrolling in the Clients & Deals and RGY Health tables painless: block accidental browser back-navigation on overscroll, and add a one-click way to jump back to the first column.

## Changes

### 1. Block browser back-swipe on overscroll
`src/pages/Clients.tsx` (line 977 scroll container) and `src/pages/RGYHealth.tsx` (line 1501 scroll container)
- Add Tailwind class `overscroll-x-contain` to the `<div className="overflow-auto ...">` wrapper. This stops horizontal overscroll from bubbling to the browser and triggering back/forward navigation (the "another window" the user is hitting).

### 2. Floating "Jump to start" button
Create `src/components/ui/ScrollToStartButton.tsx` — a small reusable overlay button.

Behavior:
- Accepts a `scrollRef` (ref to the scrollable `<div>`).
- Listens to that container's `scroll` event and is visible only when `scrollLeft > 120px`.
- On click, calls `scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' })`.
- Positioned `sticky`/`absolute` at the bottom-left of the table container (`bottom-4 left-4`), `z-20`, with the existing primary color tokens, small rounded button, `ChevronsLeft` icon from lucide + label "Jump to start".
- Hidden on mobile by default to avoid covering rows; visible from `sm:` up.

### 3. Wire into both tables
- `Clients.tsx`: create a `tableScrollRef` via `useRef<HTMLDivElement>(null)`, attach to the scroll container, render `<ScrollToStartButton scrollRef={tableScrollRef} />` inside (or as a sibling positioned over) that container.
- `RGYHealth.tsx`: same pattern on its scroll container.
- Wrap each scroll container in `<div className="relative">` so the absolute-positioned button anchors correctly.

## Out of scope
- No changes to row/column rendering, frozen header logic, or filters.
- No changes to the tab strip scroller (line 894 / 1432) — that's a different scroller and not part of the complaint.
- No global overscroll changes outside these two pages.

## Verification
- Open Clients & Deals, scroll right far enough that "Jump to start" appears; click it — should smoothly snap back to column 1. Swipe-back / two-finger swipe at the leftmost edge should no longer navigate the browser.
- Repeat on RGY Health.
