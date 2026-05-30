
-- Auto-reset staffing when a deal moves out of the active set.
-- Active set: 'Active Deal', 'New Deal in SLA/PO', 'Deal Disputed'.
-- Any other non-empty status (e.g. 'Deal Churned / Lost',
-- 'Deal Completed Successfully') triggers a wipe of all
-- staffing_assignments for that deal. Empty/NULL statuses are
-- ignored so unsynced rows don't accidentally lose their staffing.

CREATE OR REPLACE FUNCTION public._is_active_staffing_status(_status text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(_status, ''))) IN (
    'active deal',
    'new deal in sla/po',
    'deal disputed'
  )
$$;

CREATE OR REPLACE FUNCTION public.reset_staffing_on_inactive_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status text := trim(coalesce(NEW.deal_status, ''));
  v_old_status text := trim(coalesce(OLD.deal_status, ''));
BEGIN
  -- Only act when status actually changed, is non-empty,
  -- and the new status is NOT in the active set.
  IF v_new_status = '' THEN
    RETURN NEW;
  END IF;
  IF v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;
  IF public._is_active_staffing_status(v_new_status) THEN
    RETURN NEW;
  END IF;

  -- Wipe all assignments for this deal. The existing
  -- sync_bopm_fields_from_assignment trigger will recompute the
  -- vsd / principal_bopm / senior_bopm / bopm columns to empty.
  DELETE FROM public.staffing_assignments
   WHERE deal_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_staffing_on_inactive_deal ON public.staffing_deals;
CREATE TRIGGER trg_reset_staffing_on_inactive_deal
AFTER UPDATE OF deal_status ON public.staffing_deals
FOR EACH ROW
EXECUTE FUNCTION public.reset_staffing_on_inactive_deal();

-- One-time backfill: clear staffing for deals already in a non-active,
-- non-empty status.
DELETE FROM public.staffing_assignments sa
USING public.staffing_deals d
WHERE sa.deal_id = d.id
  AND coalesce(trim(d.deal_status), '') <> ''
  AND NOT public._is_active_staffing_status(d.deal_status);
