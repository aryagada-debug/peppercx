

# Delete Client/Deal, Default Client on Add Deal, Editable Status, Tighter UI

## Changes

### 1. Delete client and delete deal (`src/pages/Clients.tsx` + `src/hooks/useClients.ts`)

- **Client delete**: Add a subtle trash icon button on the client row (right side, visible on hover or always muted). On click, show an `AlertDialog` confirmation ("Delete client and all associated deals?"). On confirm, delete from `clients` table and cascade-delete associated `staffing_deals` rows by `client_id`, then refresh.
- **Deal delete**: Add a small trash icon at the end of each deal row in the expanded table. Confirmation dialog, then delete from `staffing_deals` by `id`. Also delete related `deal_financials`, `deal_sow_items`, `deal_tasks`, `deal_onboarding_steps`, `deal_rgy_weekly`, `deal_revenue_monthly`, `deal_targets_monthly`, `mbr_entries` where `deal_id` matches.
- Add `deleteClient` to `useClients.ts` hook.

### 2. Default client when adding deal from within a client (`src/pages/Clients.tsx`)

The `openDealWizardForClient` function already sets `dealWizardClientId` and passes it as `preSelectedClientId` to `DealFormWizard`. This should already work — verify `DealFormWizard` respects `preSelectedClientId` and pre-selects the client. No change needed if it already does.

### 3. Editable deal status inline (`src/pages/Clients.tsx`)

Replace the static status badge in the deal table with a small `<Select>` dropdown (options: Active, Paused, Closed, Lost, etc.). On change, update `staffing_deals` table (`deal_status_cx` column) via supabase, and update local state. The change persists everywhere since all views read from the same table.

### 4. Tighter UI (`src/pages/Clients.tsx`)

- Reduce page padding from `p-8` to `p-5`
- Reduce `mb-5` gaps to `mb-3`
- Reduce KPI card gap from `gap-3` to `gap-2`
- Reduce client list `space-y-1` to `space-y-0.5`
- Reduce table row padding from `py-2.5 px-4` to `py-1.5 px-3`
- Reduce client header padding from `px-4 py-3` to `px-3 py-2`

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/useClients.ts` | Add `deleteClient` function |
| `src/pages/Clients.tsx` | Delete buttons + confirmation, inline status select, tighter spacing |

