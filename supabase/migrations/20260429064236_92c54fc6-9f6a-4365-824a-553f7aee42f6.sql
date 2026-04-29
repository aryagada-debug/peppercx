-- Allow grouping approval requests into a batch with sub-requests.
-- The batch "parent" row carries summary metadata; each child row is an independent
-- actionable sub-request (add/update/remove staffing) with its own status, so Central Cx
-- can approve or reject any individual sub-request without waiting for the others.

ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_batch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch_title text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_approval_requests_parent_id ON public.approval_requests(parent_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_deal_id ON public.approval_requests(deal_id);