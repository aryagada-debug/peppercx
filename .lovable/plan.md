

# Autocomplete Client Selection in Deal Form Wizard

## Current State
The `DealFormWizard` Step 0 has a search input + a scrollable list of all clients. It works but feels like a manual browse — not a true autocomplete experience.

## Change
Replace the current search + list UI in Step 0 with a **Combobox-style autocomplete** using the existing shadcn `Command` component (already in the project via `GlobalSearch`). As the user types, matching clients appear in a dropdown. Selecting one highlights it. The "New Client" button remains accessible.

## File: `src/components/deals/DealFormWizard.tsx`

### Changes to Step 0 (lines 124-163):
- Replace the plain `Input` + scrollable div with a `Popover` + `Command` combobox pattern
- Show client suggestions as the user types (filtered by name, industry, geography)
- Highlight the selected client with a checkmark
- Keep the "New Client" button at the top
- Show client metadata (industry, geography) in each suggestion row
- Auto-open the dropdown when the input is focused
- If no matches, show "No clients found — Create one" prompt

### Technical approach:
```text
┌──────────────────────────────────┐
│  🔍 Type client name...    [+]  │
├──────────────────────────────────┤
│  ✓ Air India                    │
│    Enterprise • India           │
│  ─ PhonePe                      │
│    Fintech • India              │
│  ─ Godrej                       │
│    FMCG • India                 │
└──────────────────────────────────┘
```

- Uses `Popover` + `Command` from shadcn (already installed)
- `CommandInput` handles the search text
- `CommandItem` for each client with `onSelect` to set `selectedClientId`
- Check icon on the currently selected item
- Popover opens on focus, closes on selection
- Selected client shown as a highlighted card below the input when chosen

No new files. Single file edit to `DealFormWizard.tsx`.

