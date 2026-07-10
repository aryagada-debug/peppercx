## Problem

When creating a new deal via the "New Deal" wizard on Clients & Deals:

1. The **Deal Status** dropdown shows the wrong options — `Won / Negotiation / Pipeline / Lost` — which don't match the statuses used everywhere else in Clients & Deals (`Active Deal`, `New Deal in SLA/PO`, `Deal Disputed`, `Deal Completed Successfully`, `Deal Churned / Lost`). The default is also `Active Deal` which isn't even in the list, so the field looks blank.
2. There is no **Deal ID** field. The system auto-generates a placeholder like `D-0001`, but users can't enter the real Deal ID that should show in the Clients & Deals table's "Deal ID" column.

## Changes

### 1. `src/components/deals/DealFormWizard.tsx`
- Replace the local `DEAL_STATUSES` constant with the same 5-value list used on the Clients page:
  `["Active Deal", "New Deal in SLA/PO", "Deal Disputed", "Deal Completed Successfully", "Deal Churned / Lost"]`
- Keep the default `dealStatus: "Active Deal"` (now valid).
- Add a `dealId: string` field to `DealFormData` (default `""`).
- Add a "Deal ID" input in Step 1 (Deal Details), placed next to PC Code, e.g. placeholder `D-XXXX`. Optional field.

### 2. `src/pages/Clients.tsx` — `handleCreateDeal`
- If the user provided `data.dealId`, write it to `new_deal_id_formulated` (the field the Clients table reads first via `dbToDeal`).
- Keep the auto-generated `new_deal_id_temp` as a fallback so nothing regresses when the field is left blank.
- Also pass the entered Deal ID into the approval-request payload path (non-admin flow) so approvals carry it through.

## Result

- The Deal Status dropdown in the wizard mirrors the statuses shown in Clients & Deals, and the selected status actually appears in the table.
- Users can enter a Deal ID during creation, and it renders in the "Deal ID" column of Clients & Deals.
