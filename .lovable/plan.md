# Show RGY Issue Form Only When Health Changes to Y/R

## Problem

The issue capture form is always visible whenever any dimension is currently Y or R. It should only appear when a user **changes** a dimension to Y or R (i.e., on save), not persist on every page load.

## Approach

Add a `showIssueForm` boolean state (default `false`) in the RGY Health tab section. Set it to `true` inside `handleRGYSave` only when the newly saved dimensions contain any Y or R value. Set it to `false` after the issue form is submitted or manually dismissed. The existing `hasNonGreen` check around `<RGYIssueForm>` will be replaced with `showIssueForm`.

## Changes — `src/pages/DealDetail.tsx`

1. Add state: `const [showIssueForm, setShowIssueForm] = useState(false);`
2. In `handleRGYSave`, after saving, check if any dimension is Y/R → `setShowIssueForm(true)`, otherwise `setShowIssueForm(false)`.
3. Replace the condition around `<RGYIssueForm>` (lines ~1087-1091) from the `hasNonGreen` check to simply `showIssueForm`.
4. After issue form submission (`onSaveIssue`), call `setShowIssueForm(false)`.
5. Add a small "Cancel" / dismiss button on the form to hide it without submitting.  
If Cancle is selected, don't change the account health. revert it to previous R,G or Y