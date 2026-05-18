## Hide "Add Client" and "Add Deal" for Capability Lead and Capability IC

### Change
In `src/pages/Clients.tsx` (around lines 749–756), wrap the action buttons container so the two CTAs do not render when `isCapLead || isCapMember`.

```tsx
{!(isCapLead || isCapMember) && (
  <div className="flex items-center gap-2 ml-auto">
    <Button variant="outline" size="sm" onClick={() => setClientDialogOpen(true)}>
      <Plus className="h-4 w-4 mr-1" /> Add Client
    </Button>
    <Button size="sm" onClick={() => { setDealWizardClientId(undefined); setDealWizardOpen(true); }}>
      <Plus className="h-4 w-4 mr-1" /> Add Deal
    </Button>
  </div>
)}
```

### Scope
- VSD, BOPM, and Admin continue to see both buttons unchanged.
- Capability Lead and Capability IC see neither button.
- No other files changed; dialogs remain mounted but unreachable for these roles.